#!/usr/bin/env python3
"""
Build dataset pipeline — orchestrates Supabase load + NHANES download.

Usage:
  python build_dataset.py           # use cached CSVs if they exist
  python build_dataset.py --force   # re-run all steps regardless of cache

Exit codes:
  0 — all steps completed, 4 output CSVs verified
  1 — env validation failed, a step crashed, or an output file is missing
"""

import argparse
import os
import sys
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv

# ── Paths ──────────────────────────────────────────────────────────────────────

ROOT = Path(__file__).resolve().parents[2]

# Add src/data/ to path so we can import sibling scripts as modules
sys.path.insert(0, str(Path(__file__).parent))

PROCESSED_DIR = ROOT / "data" / "processed"
NHANES_DIR    = ROOT / "data" / "nhanes"

SUPABASE_OUTPUTS = {
    "brfss":   PROCESSED_DIR / "brfss_clean.csv",
    "unified": PROCESSED_DIR / "unified_features.csv",
}
NHANES_OUTPUTS = {
    "merged":  NHANES_DIR / "nhanes_lab_merged.csv",
    "fasting": NHANES_DIR / "nhanes_lab_fasting.csv",
}


# ── Step 0 — Environment validation ───────────────────────────────────────────

def check_env() -> None:
    """
    Fail fast if required Supabase credentials are missing from .env.
    Must run before any network call or import of load_from_supabase.
    """
    load_dotenv(ROOT / ".env")

    required = {
        "NEXT_PUBLIC_SUPABASE_URL":  "Supabase project URL",
        "SUPABASE_SERVICE_ROLE_KEY": "service role key (bypasses RLS to read ml_data schema)",
    }
    missing = [
        f"  {var:<32}  # {desc}"
        for var, desc in required.items()
        if not os.environ.get(var)
    ]
    if missing:
        print("ERROR: Missing required environment variables.\n")
        print(f"  Expected .env location: {ROOT / '.env'}")
        print(f"  Template:               {ROOT / '.env.example'}")
        print("\n  Missing variables:")
        for line in missing:
            print(line)
        sys.exit(1)


# ── Step 1 — Supabase load ─────────────────────────────────────────────────────

def step_supabase(force: bool) -> None:
    """
    Load ml_data.brfss_clean and ml_data.unified_features from Supabase.
    Skips if both CSVs already exist in data/processed/ (unless --force).
    """
    cached = all(p.exists() for p in SUPABASE_OUTPUTS.values())

    if cached and not force:
        print("\n[1/2] Supabase — CSVs cached, skipping.")
        for p in SUPABASE_OUTPUTS.values():
            print(f"  ↩  {p.name}  ({p.stat().st_size / 1_048_576:.1f} MB)")
        print("       Pass --force to reload from Supabase.")
        return

    action = "Forcing reload" if (cached and force) else "No cache found, loading"
    print(f"\n[1/2] Supabase — {action}…")

    import load_from_supabase
    load_from_supabase.main()


# ── Step 2 — NHANES download ───────────────────────────────────────────────────

def step_nhanes(force: bool) -> None:
    """
    Download the 8 NHANES cycle-L .xpt files and merge into two CSVs.
    Raw .xpt files are cached inside download_nhanes itself (per-file).
    The merged CSVs here are also cached unless --force.
    """
    cached = all(p.exists() for p in NHANES_OUTPUTS.values())

    if cached and not force:
        print("\n[2/2] NHANES — merged CSVs cached, skipping.")
        for p in NHANES_OUTPUTS.values():
            print(f"  ↩  {p.name}  ({p.stat().st_size / 1_048_576:.1f} MB)")
        print("       Pass --force to re-download and re-merge.")
        return

    action = "Forcing re-merge" if (cached and force) else "No cache found, downloading"
    print(f"\n[2/2] NHANES — {action}…")

    import download_nhanes
    download_nhanes.main()


# ── Summary ────────────────────────────────────────────────────────────────────

def print_summary() -> None:
    """
    Read all 4 output CSVs and print the final dataset summary.
    Raises FileNotFoundError (→ caught in main) if any file is missing.
    """
    brfss   = pd.read_csv(SUPABASE_OUTPUTS["brfss"],   nrows=0)   # schema only
    unified = pd.read_csv(SUPABASE_OUTPUTS["unified"],  nrows=0)
    merged  = pd.read_csv(NHANES_OUTPUTS["merged"],     nrows=0)
    fasting = pd.read_csv(NHANES_OUTPUTS["fasting"],    nrows=0)

    # Row counts via line count (fast, avoids loading 387K rows into memory)
    def row_count(path: Path) -> int:
        with open(path, "rb") as fh:
            return sum(1 for _ in fh) - 1  # subtract header

    brfss_rows   = row_count(SUPABASE_OUTPUTS["brfss"])
    unified_rows = row_count(SUPABASE_OUTPUTS["unified"])
    merged_rows  = row_count(NHANES_OUTPUTS["merged"])
    fasting_rows = row_count(NHANES_OUTPUTS["fasting"])

    # Source breakdown for unified_features (read only source column)
    unified_full = pd.read_csv(SUPABASE_OUTPUTS["unified"], usecols=["source"])
    sources = " / ".join(sorted(unified_full["source"].unique()))

    print("\n")
    print("=== DATASETS LISTOS ===")
    print(f"  brfss_clean:          {brfss_rows:>7,} filas · {len(brfss.columns):>2} columnas · 4 targets disponibles")
    print(f"  unified_features:     {unified_rows:>7,} filas · {len(unified.columns):>2} columnas · fuentes: {sources}")
    print(f"  nhanes_lab_merged:    {merged_rows:>7,} filas · {len(merged.columns):>2} columnas de lab")
    print(f"  nhanes_lab_fasting:   {fasting_rows:>7,} filas · glucosa + insulina disponibles")
    print()
    print("  Targets ausentes en brfss_clean (solo en brfss_features):")
    print("    - has_high_bp_bin")
    print("    - has_high_cholesterol_bin")
    print("    - has_stroke_bin")
    print()
    print("  Compensación parcial vía NHANES:")
    print("    - has_high_cholesterol_bin → LBXTC ≥ 200 mg/dL disponible")
    print("    - has_high_bp_bin          → requiere BPX_L.xpt (no descargado)")
    print("    - has_stroke_bin           → cobertura parcial en DIQ_L")
    print("=======================")


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build ML training datasets from Supabase and NHANES CDC.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "examples:\n"
            "  python build_dataset.py           # use cache if available\n"
            "  python build_dataset.py --force   # re-run everything\n"
        ),
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-run all steps even if output CSVs already exist.",
    )
    args = parser.parse_args()

    try:
        check_env()
        step_supabase(args.force)
        step_nhanes(args.force)
        print_summary()
        sys.exit(0)

    except KeyboardInterrupt:
        print("\nInterrupted.")
        sys.exit(1)

    except Exception as exc:
        print(f"\nERROR: Pipeline failed — {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
