#!/usr/bin/env python3
"""
Download NHANES 2021-2023 (cycle L) lab files and merge by participant ID.

Context — why NHANES matters for the health risk ML agent
─────────────────────────────────────────────────────────
ml_data.brfss_clean (387,566 rows) is the primary training source but three of
the seven target conditions are absent from that table and exist only in
ml_data.brfss_features:

  has_high_bp_bin         (~40.7%)  — blood pressure not captured in DEMO/labs
                                       here; would require BPX_L.xpt (add later)
  has_high_cholesterol_bin (~36.7%) — compensated here via LBXTC ≥ 200 mg/dL
  has_stroke_bin          (~4.2%)   — compensated partially via DIQ/MCQ self-
                                       report; full capture requires MCQ_L.xpt

NHANES also replaces self-reported proxies with objective lab markers:
  BRFSS reports "have diabetes" → NHANES measures glucose, HbA1c, insulin
  BRFSS reports "have high cholesterol" → NHANES measures LBXTC, LDL, HDL

Outputs
───────
  data/nhanes/nhanes_lab_merged.csv   — full left-join, all examined participants
  data/nhanes/nhanes_lab_fasting.csv  — subset: glucose (LBDGLUSI) AND insulin
                                        (LBDINSI) both non-null; fasting subsample
                                        for the diabetes clinical model
"""

import time
from pathlib import Path

import pandas as pd
import requests
from tqdm import tqdm

# ── Paths ──────────────────────────────────────────────────────────────────────

ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "data" / "nhanes" / "raw"
OUT_DIR = ROOT / "data" / "nhanes"

RAW_DIR.mkdir(parents=True, exist_ok=True)

# ── NHANES Cycle L (2021-2023) files ──────────────────────────────────────────

BASE_URL = "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2021/DataFiles/"

# Each tuple: (filename, join_key_present, description)
FILES = [
    ("DEMO_L.xpt",   "Demographics — age, gender, ethnicity; join key: SEQN"),
    ("GHB_L.xpt",    "Glycated hemoglobin (HbA1c)"),
    ("GLU_L.xpt",    "Fasting plasma glucose"),
    ("INS_L.xpt",    "Fasting serum insulin — smallest subsample (requires overnight fast)"),
    ("TCHOL_L.xpt",  "Total cholesterol"),
    ("HDL_L.xpt",    "HDL cholesterol"),
    ("TRIGLY_L.xpt", "LDL cholesterol + triglycerides"),
    ("DIQ_L.xpt",    "Diabetes questionnaire — self-reported diagnosis"),
]

# ── Lab column annotations ─────────────────────────────────────────────────────
# Original NHANES variable names are preserved after the merge for traceability.
# Units and clinical meaning documented here.
LAB_COLUMN_NOTES = {
    # GHB_L
    "LBXGH":    "HbA1c — glycated hemoglobin (%); reflects avg glucose over ~3 months",
    # GLU_L
    "LBXGLU":   "Fasting plasma glucose (mg/dL) — raw value",
    "LBDGLUSI": "Fasting plasma glucose (mmol/L) — SI unit; use this for models",
    # INS_L
    "LBXIN":    "Fasting serum insulin (µU/mL) — raw value",
    "LBDINSI":  "Fasting serum insulin (pmol/L) — SI unit; use this for models",
    # TCHOL_L
    "LBXTC":    "Total cholesterol (mg/dL); ≥200 → high cholesterol risk flag",
    # HDL_L
    "LBDHDD":   "HDL cholesterol (mg/dL); <40 (men) or <50 (women) → low HDL risk",
    # TRIGLY_L
    "LBDLDL":   "LDL cholesterol (mg/dL); calculated via Friedewald equation",
    "LBXTR":    "Triglycerides (mg/dL)",
    # DIQ_L
    "DIQ010":   "Ever told you have diabetes? (1=Yes, 2=No, 3=Borderline, 7=Refused, 9=DK)",
}

MAX_RETRIES = 3
CHUNK_SIZE = 65_536          # 64 KB
FASTING_WARN_THRESHOLD = 2_000


# ── Download ───────────────────────────────────────────────────────────────────

def download_file(filename: str) -> Path:
    """
    Download a CDC .xpt file to RAW_DIR with retry and tqdm progress.
    Skips download if the file already exists on disk (local cache).
    """
    dest = RAW_DIR / filename

    if dest.exists():
        size_mb = dest.stat().st_size / 1_048_576
        print(f"  ↩  {filename:<16} already cached ({size_mb:.1f} MB) — skipping")
        return dest

    url = BASE_URL + filename

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = requests.get(url, stream=True, timeout=60)
            resp.raise_for_status()

            total_bytes = int(resp.headers.get("content-length", 0))

            with (
                open(dest, "wb") as fh,
                tqdm(
                    total=total_bytes or None,
                    unit="B",
                    unit_scale=True,
                    unit_divisor=1024,
                    desc=f"  {filename:<16}",
                    ncols=72,
                ) as pbar,
            ):
                for chunk in resp.iter_content(chunk_size=CHUNK_SIZE):
                    fh.write(chunk)
                    pbar.update(len(chunk))

            return dest

        except requests.RequestException as exc:
            if dest.exists():
                dest.unlink()  # remove partial download
            if attempt == MAX_RETRIES:
                raise RuntimeError(
                    f"Failed to download {filename} after {MAX_RETRIES} attempts: {exc}"
                ) from exc
            wait = 2 ** attempt
            print(f"  ⚠  {filename} attempt {attempt}/{MAX_RETRIES} failed ({exc}). "
                  f"Retrying in {wait}s…")
            time.sleep(wait)

    return dest  # unreachable; satisfies type checker


# ── Load XPT ──────────────────────────────────────────────────────────────────

def load_xpt(path: Path) -> pd.DataFrame:
    """Read an XPT (SAS transport) file into a DataFrame using pandas."""
    return pd.read_sas(path, format="xport", encoding="latin-1")


# ── Merge ──────────────────────────────────────────────────────────────────────

def build_merged(frames: dict[str, pd.DataFrame]) -> pd.DataFrame:
    """
    Left-join all lab/questionnaire frames onto DEMO_L using SEQN.

    Column renames applied to DEMO_L:
      SEQN     → participant_id   (unique participant identifier, present in all files)
      RIDAGEYR → age              (age in years at examination)
      RIAGENDR → gender           (1 → 'male', 2 → 'female')
      RIDRETH3 → ethnicity        (race/Hispanic origin with non-Hispanic Asian category)

    All other columns retain their original NHANES variable names.
    See LAB_COLUMN_NOTES above for lab column definitions.
    """
    base = frames["DEMO_L"].copy()

    # SEQN is stored as float64 in XPT; keep as-is for the join
    base = base.rename(columns={
        "SEQN":     "participant_id",
        "RIDAGEYR": "age",
        "RIAGENDR": "gender",
        "RIDRETH3": "ethnicity",
    })

    # Encode gender as readable string
    base["gender"] = base["gender"].map({1.0: "male", 2.0: "female"})

    merged = base

    for filename, _ in FILES:
        key = filename.replace(".xpt", "")
        if key == "DEMO_L":
            continue

        lab = frames[key].copy()
        lab = lab.rename(columns={"SEQN": "participant_id"})

        # Guard: skip columns already present (except join key) to prevent _x/_y suffixes
        already_present = set(merged.columns) - {"participant_id"}
        new_cols = ["participant_id"] + [
            c for c in lab.columns if c not in already_present and c != "participant_id"
        ]
        merged = merged.merge(lab[new_cols], on="participant_id", how="left")

    return merged


# ── Completeness report ────────────────────────────────────────────────────────

def print_completeness(merged: pd.DataFrame) -> None:
    """Print how many participants have each key lab value available."""

    # Ordered by expected decreasing availability
    markers = [
        ("HbA1c",          "LBXGH"),
        ("Glucosa fasting", "LBDGLUSI"),
        ("Insulina",        "LBDINSI"),   # smallest subsample — overnight fast required
        ("LDL",             "LBDLDL"),
    ]

    base_n = len(merged)
    print("\n── Completeness report ─────────────────────────────────────")
    print(f"  DEMO_L (base):      {base_n:>6,} participantes examinados")

    for label, col in markers:
        if col in merged.columns:
            n = int(merged[col].notna().sum())
            pct = n / base_n * 100
            suffix = "  ← subsample más pequeño" if col == "LBDINSI" else ""
            print(f"  {label + ':':<20} {n:>6,} disponibles ({pct:.1f}%){suffix}")
        else:
            print(f"  {label + ':':<20}   N/A  ← columna no encontrada ({col})")


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    # 1. Download (skip if cached)
    print("── Downloading NHANES 2021-2023 cycle L ────────────────────")
    for filename, description in FILES:
        print(f"\n  [{description}]")
        download_file(filename)

    # 2. Load XPT → DataFrames
    print("\n\n── Loading XPT files ───────────────────────────────────────")
    frames: dict[str, pd.DataFrame] = {}
    for filename, _ in FILES:
        key = filename.replace(".xpt", "")
        df = load_xpt(RAW_DIR / filename)
        frames[key] = df
        print(f"  {filename:<16} → {len(df):>6,} rows × {df.shape[1]} cols")

    # 3. Merge all by SEQN → participant_id
    print("\n── Merging by SEQN (→ participant_id) ──────────────────────")
    merged = build_merged(frames)
    print(f"  Merged: {merged.shape[0]:,} rows × {merged.shape[1]} cols")

    # 4. Completeness report
    print_completeness(merged)

    # 5. Build fasting subset (glucose AND insulin both present)
    print("\n── Building fasting subset ─────────────────────────────────")
    glucose_col = "LBDGLUSI"
    insulin_col = "LBDINSI"

    missing = []
    if glucose_col not in merged.columns:
        missing.append(glucose_col)
    if insulin_col not in merged.columns:
        missing.append(insulin_col)

    if missing:
        print(f"  ⚠  Cannot build fasting subset — columns not found: {missing}")
        fasting = merged.iloc[0:0].copy()  # empty frame, same schema
    else:
        mask = merged[glucose_col].notna() & merged[insulin_col].notna()
        fasting = merged[mask].copy()
        print(f"  Rows with {glucose_col} AND {insulin_col}: {len(fasting):,}")

        if len(fasting) < FASTING_WARN_THRESHOLD:
            print(
                f"\n  ⚠  WARNING: fasting subsample has only {len(fasting):,} rows "
                f"(minimum recommended: {FASTING_WARN_THRESHOLD:,}).\n"
                "  This may be insufficient for a reliable diabetes clinical model.\n"
                "  Consider using HbA1c (LBXGH) as a glucose proxy, or supplementing\n"
                "  with PIMA data from ml_data.unified_features."
            )

    # 6. Save
    print("\n── Saving ──────────────────────────────────────────────────")
    merged_path  = OUT_DIR / "nhanes_lab_merged.csv"
    fasting_path = OUT_DIR / "nhanes_lab_fasting.csv"

    merged.to_csv(merged_path, index=False)
    fasting.to_csv(fasting_path, index=False)

    print(f"  nhanes_lab_merged.csv   → {merged.shape[0]:,} rows × {merged.shape[1]} cols")
    print(f"  nhanes_lab_fasting.csv  → {fasting.shape[0]:,} rows × {fasting.shape[1]} cols")
    print(f"\n  Output directory: {OUT_DIR}")
    print("\nDone.")


if __name__ == "__main__":
    main()
