#!/usr/bin/env python3
"""
Load BRFSS and Unified Features datasets from Supabase into local CSV files.

Pipeline tables (loaded here):
  - ml_data.brfss_clean      → data/processed/brfss_clean.csv
  - ml_data.unified_features → data/processed/unified_features.csv

Reference tables (not loaded — kept here for documentation):
  - ml_data.pima_diabetes   : 768 rows, PIMA Indians Diabetes Dataset
                              Columns: pregnancies, glucose, blood_pressure,
                              skin_thickness, insulin, bmi,
                              diabetes_pedigree_function, age, has_diabetes
  - ml_data.sleep_health    : 374 rows, Sleep Health and Lifestyle Dataset
                              Columns: age, gender, occupation, sleep_duration,
                              quality_of_sleep, physical_activity_level,
                              stress_level, bmi_category, heart_rate,
                              daily_steps, sleep_disorder, systolic_bp,
                              diastolic_bp, + encoded variants

Both reference tables are already merged and imputed in ml_data.unified_features
(source column: 'pima' | 'sleep').
"""

import os
import sys
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from supabase import create_client
from tqdm import tqdm

# ── Paths ──────────────────────────────────────────────────────────────────────

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")

OUTPUT_DIR = ROOT / "data" / "processed"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

PAGE_SIZE = 10_000

# ── Expected BRFSS 2023 national prevalences (±3 pp tolerance) ─────────────────
# Source: CDC BRFSS 2023 Prevalence & Trends Data.
#
# NOTE: 3 of 7 targets are NOT present in ml_data.brfss_clean:
#   has_high_bp_bin         (~40.7%) → only in ml_data.brfss_features
#   has_high_cholesterol_bin (~36.7%) → only in ml_data.brfss_features
#   has_stroke_bin          (~4.2%)  → only in ml_data.brfss_features
#
# The 4 targets that CAN be validated from brfss_clean:
PREVALENCE_TOLERANCE = 0.03

BINARY_TARGETS = {
    # derived_name: (source_column, derivation, expected_prevalence)
    "has_diabetes_bin":      ("tiene_diabetes_enc",           "eq2",    0.138),
    "has_depression_bin":    ("tiene_depresion_enc",          "binary", 0.203),
    "has_asthma_bin":        ("tiene_asma_enc",               "binary", 0.149),
    "has_heart_disease_bin": ("tiene_cardiopatia_coronaria_enc", "binary", 0.054),
}

NOT_IN_BRFSS_CLEAN = {
    "has_high_bp_bin":          0.407,
    "has_high_cholesterol_bin": 0.367,
    "has_stroke_bin":           0.042,
}

# Raw _enc disease columns in brfss_clean that must be strictly binary (0/1)
RAW_BINARY_ENC_COLS = [
    "tiene_cardiopatia_coronaria_enc",
    "tiene_depresion_enc",
    "tiene_cancer_piel_enc",
    "tiene_otro_cancer_enc",
    "tiene_artritis_enc",
    "tiene_asma_enc",
]


# ── Loaders ────────────────────────────────────────────────────────────────────

def load_brfss_clean(client) -> pd.DataFrame:
    """
    Load ml_data.brfss_clean with pagination (387,566 rows).

    Corrections applied:
      - 88 → 0 in poor_mental_health_days and poor_physical_health_days
        (BRFSS sentinel 88 = "Don't know / Not sure"; treated as 0 days).
        These columns exist only in ml_data.brfss_features; if absent here
        a warning is printed and the step is skipped.
    """
    print("\n── Loading ml_data.brfss_clean ─────────────────────────────")

    # Count rows without fetching data
    count_resp = (
        client.schema("ml_data")
        .table("brfss_clean")
        .select("id", count="exact")
        .limit(0)
        .execute()
    )
    total = count_resp.count
    print(f"  Remote row count: {total:,}")

    pages = []
    with tqdm(total=total, unit="rows", desc="  Fetching", ncols=72) as pbar:
        offset = 0
        while offset < total:
            resp = (
                client.schema("ml_data")
                .table("brfss_clean")
                .select("*")
                .range(offset, offset + PAGE_SIZE - 1)
                .execute()
            )
            if not resp.data:
                break
            batch = pd.DataFrame(resp.data)
            pages.append(batch)
            pbar.update(len(batch))
            offset += len(batch)

    df = pd.concat(pages, ignore_index=True)

    # Fix BRFSS sentinel: 88 → 0 in mental/physical health day columns
    SENTINEL_COLS = ("poor_mental_health_days", "poor_physical_health_days")
    for col in SENTINEL_COLS:
        if col in df.columns:
            n = (df[col] == 88).sum()
            df[col] = df[col].replace(88, 0)
            print(f"  88→0 in {col}: {n:,} cells replaced")
        else:
            print(f"  ⚠  {col} not found in brfss_clean (lives in brfss_features) — skipped")

    return df


def load_unified_features(client) -> pd.DataFrame:
    """
    Load ml_data.unified_features (1,142 rows — PIMA + Sleep joined and imputed).
    No pagination required at this size.
    """
    print("\n── Loading ml_data.unified_features ───────────────────────")

    pages = []
    offset = 0
    while True:
        resp = (
            client.schema("ml_data")
            .table("unified_features")
            .select("*")
            .range(offset, offset + PAGE_SIZE - 1)
            .execute()
        )
        if not resp.data:
            break
        pages.append(pd.DataFrame(resp.data))
        offset += len(resp.data)
    df = pd.concat(pages, ignore_index=True)
    print(f"  Rows fetched: {len(df):,}")

    sources = df["source"].value_counts().to_dict() if "source" in df.columns else {}
    for src, n in sorted(sources.items()):
        print(f"    source='{src}': {n} rows")

    return df


# ── Validation ─────────────────────────────────────────────────────────────────

def validate_brfss_targets(df: pd.DataFrame) -> None:
    """
    Validate 7 BRFSS binary condition flags against national prevalences.

    Step 1 — Check raw _enc columns are strictly binary (0/1).
    Step 2 — Derive the 4 mappable binary targets from brfss_clean and
              compare prevalences against BRFSS 2023 national estimates ±3pp.
    Step 3 — Report the 3 targets not available in brfss_clean.
    """
    print("\n── Validating BRFSS binary targets ─────────────────────────")
    all_pass = True

    # Step 1: raw binary _enc columns
    print("\n  Step 1 — Raw _enc columns (must be 0/1 only):")
    for col in RAW_BINARY_ENC_COLS:
        if col not in df.columns:
            print(f"    ⚠  {col}: NOT FOUND in DataFrame")
            all_pass = False
            continue
        unique_vals = sorted(df[col].dropna().unique().tolist())
        is_binary = set(unique_vals).issubset({0, 1})
        mark = "✓" if is_binary else "✗"
        print(f"    {mark} {col}: values={unique_vals}")
        if not is_binary:
            all_pass = False

    # Step 2: derived binary targets + prevalence check
    print(f"\n  Step 2 — Prevalence vs BRFSS 2023 national (±{PREVALENCE_TOLERANCE:.0%}):")
    print(f"  {'Target':<28} {'Observed':>9} {'Expected':>9} {'Diff':>7} {'Binary':>7} {'Pass':>5}")
    print("  " + "─" * 70)

    for name, (src_col, derivation, expected) in BINARY_TARGETS.items():
        if src_col not in df.columns:
            print(f"  ⚠  {name}: source column '{src_col}' NOT FOUND — skipping")
            all_pass = False
            continue

        col = df[src_col]

        # Derive binary flag
        if derivation == "eq2":
            # tiene_diabetes_enc: 0=no, 1=pre_diabetes, 2=si → confirmed diabetes only
            binary = (col == 2).astype("int8")
        else:
            binary = col.astype("int8")

        unique_vals = sorted(binary.dropna().unique().tolist())
        is_binary = set(unique_vals).issubset({0, 1})
        prevalence = float(binary.mean())
        diff = abs(prevalence - expected)
        within = diff <= PREVALENCE_TOLERANCE

        passed = is_binary and within
        if not passed:
            all_pass = False

        mark = "✓" if passed else "✗"
        binary_str = "ok" if is_binary else f"FAIL{unique_vals}"
        print(
            f"  {mark} {name:<28} {prevalence:>8.1%} {expected:>8.1%} "
            f"{diff:>6.1%}  {binary_str:>7}  {'✓' if within else '✗'}"
        )

    # Step 3: missing targets
    print(f"\n  Step 3 — Not available in brfss_clean (only in ml_data.brfss_features):")
    for name, expected in NOT_IN_BRFSS_CLEAN.items():
        print(f"    ⚠  {name:<28} expected {expected:.1%}")

    result = "PASS" if all_pass else "FAIL"
    print(f"\n  Overall validation: {result}")
    if not all_pass:
        print("  ⚠  One or more checks failed — review output above before training.")


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        print("ERROR: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set in .env")
        sys.exit(1)

    client = create_client(url, key)

    brfss = load_brfss_clean(client)
    unified = load_unified_features(client)

    validate_brfss_targets(brfss)

    # Save
    print("\n── Saving ──────────────────────────────────────────────────")
    brfss_path = OUTPUT_DIR / "brfss_clean.csv"
    unified_path = OUTPUT_DIR / "unified_features.csv"

    brfss.to_csv(brfss_path, index=False)
    unified.to_csv(unified_path, index=False)

    print(f"  brfss_clean.csv      → {brfss.shape[0]:,} rows × {brfss.shape[1]} cols")
    print(f"  unified_features.csv → {unified.shape[0]:,} rows × {unified.shape[1]} cols")
    print(f"\n  Output directory: {OUTPUT_DIR}")
    print("\nDone.")


if __name__ == "__main__":
    main()
