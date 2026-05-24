"""
Orchestrator — runs all four pipeline steps in order.
Usage:  python3 run_pipeline.py
"""

import os
import sys
import time

# Add notebooks dir to path so imports work when called from anywhere
NOTEBOOKS = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, NOTEBOOKS)

from importlib import import_module


STEPS = [
    ("01_download_datasets",  "Download raw datasets"),
    ("02_clean_datasets",     "Clean & standardize"),
    ("03_eda",                "Exploratory data analysis"),
    ("04_feature_engineering","Feature engineering"),
]


def run():
    total_start = time.time()
    print("=" * 60)
    print("CareBridge Health Dataset Pipeline")
    print("=" * 60)

    for module_name, description in STEPS:
        print(f"\n>>> {description} ({module_name}.py)")
        print("-" * 60)
        t0 = time.time()

        # Each script uses  if __name__ == "__main__":  blocks,
        # so we import and call the relevant loader functions directly.
        # This avoids re-running the heavy XPT parse on every import.
        mod = import_module(module_name)

        if module_name == "01_download_datasets":
            brfss = mod.load_brfss()
            sleep = mod.load_sleep()
            pima  = mod.load_pima()
            print(f"\nShapes  →  BRFSS {brfss.shape}  |  Sleep {sleep.shape}  |  PIMA {pima.shape}")

        elif module_name == "02_clean_datasets":
            import pandas as pd
            import os as _os
            PROC = _os.path.join(NOTEBOOKS, "..", "processed")
            RAW  = _os.path.join(NOTEBOOKS, "..", "raw")
            brfss_raw = pd.read_csv(_os.path.join(PROC, "brfss_2023_raw.csv"), low_memory=False)
            sleep_raw = pd.read_csv(_os.path.join(RAW,  "sleep_health_and_lifestyle.csv"))
            pima_raw  = pd.read_csv(_os.path.join(RAW,  "pima_diabetes.csv"))
            mod.clean_brfss(brfss_raw)
            mod.clean_sleep(sleep_raw)
            mod.clean_pima(pima_raw)

        elif module_name == "03_eda":
            import pandas as pd
            import matplotlib.ticker
            PROC = os.path.join(NOTEBOOKS, "..", "processed")
            brfss = pd.read_csv(os.path.join(PROC, "brfss_2023_clean.csv"), low_memory=False)
            sleep = pd.read_csv(os.path.join(PROC, "sleep_clean.csv"))
            pima  = pd.read_csv(os.path.join(PROC, "pima_clean.csv"))
            mod.eda_brfss(brfss)
            mod.eda_sleep(sleep)
            mod.eda_pima(pima)
            mod.cross_dataset_notes()
            # Write text report
            import os as _os
            report_path = _os.path.join(NOTEBOOKS, "..", "reports", "eda_report.txt")
            with open(report_path, "w") as f:
                f.write("\n".join(mod.REPORT_LINES))
            print(f"  Report → {report_path}")

        elif module_name == "04_feature_engineering":
            brfss_c, sleep_c, pima_c = mod.load_clean()
            bf = mod.engineer_brfss(brfss_c)
            sf = mod.engineer_sleep(sleep_c)
            pf = mod.engineer_pima(pima_c)
            mod.build_unified(bf, sf, pf)

        elapsed = time.time() - t0
        print(f"\n  [{description}] completed in {elapsed:.1f}s")

    total = time.time() - total_start
    print("\n" + "=" * 60)
    print(f"Pipeline complete in {total:.1f}s")
    print("Outputs:")
    out_dir = os.path.join(NOTEBOOKS, "..", "processed")
    for f in sorted(os.listdir(out_dir)):
        size = os.path.getsize(os.path.join(out_dir, f)) / 1024
        print(f"  processed/{f:<40} {size:>8.1f} KB")
    rep_dir = os.path.join(NOTEBOOKS, "..", "reports")
    for f in sorted(os.listdir(rep_dir)):
        size = os.path.getsize(os.path.join(rep_dir, f)) / 1024
        print(f"  reports/{f:<42} {size:>8.1f} KB")
    print("=" * 60)


if __name__ == "__main__":
    run()
