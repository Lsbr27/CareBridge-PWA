"""
Step 1 & 2: Download and load all three health datasets.
Outputs raw files to Data/raw/ and processed CSVs to Data/processed/.
"""

import os
import io
import zipfile
import requests
import numpy as np
import pandas as pd

RAW_DIR = os.path.join(os.path.dirname(__file__), "..", "raw")
PROCESSED_DIR = os.path.join(os.path.dirname(__file__), "..", "processed")

os.makedirs(RAW_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)


# ─────────────────────────────────────────────────────────────
# 1. BRFSS 2023 (CDC)
# ─────────────────────────────────────────────────────────────

BRFSS_URL = "https://www.cdc.gov/brfss/annual_data/2023/files/LLCP2023XPT.zip"
BRFSS_XPT  = os.path.join(RAW_DIR, "LLCP2023.XPT")
BRFSS_CSV  = os.path.join(PROCESSED_DIR, "brfss_2023_raw.csv")

# Columns relevant to CareBridge health alerts
BRFSS_COLS = [
    "_STATE",        # State FIPS code
    "IYEAR",         # Interview year
    "SEX",           # Sex
    "_AGEG5YR",      # Age group (5-year)
    "_BMI5CAT",      # BMI category
    "SMOKE100",      # Smoked 100+ cigarettes lifetime
    "SMOKDAY2",      # Currently smokes
    "DRNKANY6",      # Had alcohol in past 30 days
    "_RFDRHV7",      # Heavy drinker (computed)
    "EXERANY2",      # Exercise in past 30 days
    "_PACAT3",       # Physical activity category
    "SLEPTIM1",      # Hours of sleep
    "MENTHLTH",      # Days of poor mental health (past 30)
    "PHYSHLTH",      # Days of poor physical health (past 30)
    "GENHLTH",       # General health (1=Excellent…5=Poor)
    "DIABETE4",      # Ever told diabetic
    "CVDCRHD4",      # Ever told coronary heart disease
    "CVDSTRK3",      # Ever told had stroke
    "CHCSCNC1",      # Ever told skin cancer
    "CHCOCNC1",      # Ever told other cancer
    "HAVARTH5",      # Ever told arthritis
    "ADDEPEV3",      # Ever told depressive disorder
    "CHCKDNY2",      # Ever told kidney disease
    "ASTHMA3",       # Ever told asthma
    "ASTHNOW",       # Still have asthma
    "BPHIGH6",       # Ever told high blood pressure
    "TOLDHI3",       # Ever told high cholesterol
    "WTKG3",         # Weight (kg × 100)
    "HTM4",          # Height (cm)
    "DRNK3GE5",      # Binge drinking occasions
    "STRENGTH",      # Strength training days/week
    "PA1MIN_",       # Total physical activity (min/week, computed)
    "PRIMINSK",      # Primary insurer
    "MEDCOST1",      # Could not see doctor due to cost
    "CHECKUP1",      # Last routine checkup
    "_EDUCAG",       # Education level
    "_INCOMG1",      # Income category
    "_RACEG21",      # Race/ethnicity (2-category)
    "_HISPANC",      # Hispanic origin
    "MARITAL",       # Marital status
    "EMPLOY1",       # Employment status
]


def download_brfss():
    if os.path.exists(BRFSS_XPT):
        print("BRFSS XPT already downloaded, skipping.")
        return

    print("Downloading BRFSS 2023 (~90 MB)…")
    resp = requests.get(BRFSS_URL, stream=True, timeout=300)
    resp.raise_for_status()

    zip_bytes = io.BytesIO(resp.content)
    with zipfile.ZipFile(zip_bytes) as zf:
        xpt_name = next(n for n in zf.namelist() if n.upper().strip().endswith(".XPT"))
        print(f"  Extracting {xpt_name}…")
        zf.extract(xpt_name, RAW_DIR)
        # Normalize filename
        extracted = os.path.join(RAW_DIR, xpt_name.strip())
        # Handle trailing space in zip entry name
        extracted_with_space = os.path.join(RAW_DIR, xpt_name)
        if os.path.exists(extracted_with_space) and extracted_with_space != extracted:
            os.rename(extracted_with_space, extracted)
        if extracted != BRFSS_XPT:
            os.rename(extracted, BRFSS_XPT)

    print(f"  Saved to {BRFSS_XPT}")


def load_brfss():
    download_brfss()

    if os.path.exists(BRFSS_CSV):
        print("BRFSS CSV already processed, loading from cache.")
        return pd.read_csv(BRFSS_CSV, low_memory=False)

    print("Reading BRFSS XPT (this may take ~30 s)…")
    df = pd.read_sas(BRFSS_XPT, format="xport", encoding="latin-1")
    df.columns = df.columns.str.upper()

    # Keep only the columns we care about (drop missing ones gracefully)
    available = [c for c in BRFSS_COLS if c in df.columns]
    missing   = [c for c in BRFSS_COLS if c not in df.columns]
    if missing:
        print(f"  Note: {len(missing)} requested columns not found: {missing}")

    df = df[available].copy()
    df.to_csv(BRFSS_CSV, index=False)
    print(f"  Saved {len(df):,} rows × {len(df.columns)} cols → {BRFSS_CSV}")
    return df


# ─────────────────────────────────────────────────────────────
# 2. Sleep Health and Lifestyle  (synthetic if unavailable)
# ─────────────────────────────────────────────────────────────

SLEEP_CSV = os.path.join(RAW_DIR, "sleep_health_and_lifestyle.csv")
SLEEP_URL = (
    "https://raw.githubusercontent.com/YBI-Foundation/"
    "Dataset/main/Sleep%20Health%20and%20Lifestyle%20Dataset.csv"
)


def load_sleep():
    if os.path.exists(SLEEP_CSV):
        print("Sleep dataset already downloaded.")
        return pd.read_csv(SLEEP_CSV)

    # Try download first
    try:
        print("Downloading Sleep Health dataset…")
        resp = requests.get(SLEEP_URL, timeout=30)
        resp.raise_for_status()
        with open(SLEEP_CSV, "wb") as f:
            f.write(resp.content)
        df = pd.read_csv(SLEEP_CSV)
        # Normalize column names to expected schema
        col_map = {
            "Person ID": "Person_ID",
            "Sleep Duration": "Sleep_Duration",
            "Quality of Sleep": "Quality_of_Sleep",
            "Physical Activity Level": "Physical_Activity_Level",
            "Stress Level": "Stress_Level",
            "BMI Category": "BMI_Category",
            "Blood Pressure": "Blood_Pressure",
            "Heart Rate": "Heart_Rate",
            "Daily Steps": "Daily_Steps",
            "Sleep Disorder": "Sleep_Disorder",
        }
        df.rename(columns=col_map, inplace=True)
        print(f"  Downloaded {len(df):,} rows.")
        return df
    except Exception as e:
        print(f"  Download failed ({e}). Generating synthetic dataset…")

    # Synthetic fallback
    np.random.seed(42)
    n = 374

    occupations = [
        "Nurse", "Doctor", "Engineer", "Lawyer", "Teacher",
        "Accountant", "Salesperson", "Software Engineer", "Scientist", "Manager",
    ]
    bmi_cats   = ["Normal", "Normal Weight", "Overweight", "Obese"]
    disorders  = ["None", "Sleep Apnea", "Insomnia"]
    bp_sys = np.random.randint(100, 145, n)
    bp_dia = np.random.randint(65, 95, n)

    df = pd.DataFrame({
        "Person_ID":               range(1, n + 1),
        "Age":                     np.random.randint(18, 70, n),
        "Gender":                  np.random.choice(["Male", "Female"], n),
        "Occupation":              np.random.choice(occupations, n),
        "Sleep_Duration":          np.round(np.random.uniform(5.0, 9.5, n), 1),
        "Quality_of_Sleep":        np.random.randint(3, 10, n),
        "Physical_Activity_Level": np.random.randint(20, 90, n),
        "Stress_Level":            np.random.randint(1, 10, n),
        "BMI_Category":            np.random.choice(bmi_cats, n, p=[0.3, 0.2, 0.35, 0.15]),
        "Blood_Pressure":          [f"{s}/{d}" for s, d in zip(bp_sys, bp_dia)],
        "Heart_Rate":              np.random.randint(55, 100, n),
        "Daily_Steps":             np.random.randint(2000, 15000, n),
        "Sleep_Disorder":          np.random.choice(disorders, n, p=[0.58, 0.22, 0.20]),
    })
    df.to_csv(SLEEP_CSV, index=False)
    print(f"  Generated {len(df):,} synthetic rows → {SLEEP_CSV}")
    return df


# ─────────────────────────────────────────────────────────────
# 3. PIMA Diabetes Dataset
# ─────────────────────────────────────────────────────────────

PIMA_URL = (
    "https://raw.githubusercontent.com/npradaschnor/"
    "Pima-Indians-Diabetes-Dataset/master/diabetes.csv"
)
PIMA_CSV = os.path.join(RAW_DIR, "pima_diabetes.csv")


def load_pima():
    if os.path.exists(PIMA_CSV):
        print("PIMA dataset already downloaded.")
        return pd.read_csv(PIMA_CSV)

    print("Downloading PIMA Diabetes dataset…")
    resp = requests.get(PIMA_URL, timeout=30)
    resp.raise_for_status()
    with open(PIMA_CSV, "wb") as f:
        f.write(resp.content)
    df = pd.read_csv(PIMA_CSV)
    print(f"  Downloaded {len(df):,} rows → {PIMA_CSV}")
    return df


# ─────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("STEP 1 — Downloading datasets")
    print("=" * 60)

    brfss = load_brfss()
    sleep = load_sleep()
    pima  = load_pima()

    print("\nDataset shapes:")
    print(f"  BRFSS 2023 : {brfss.shape}")
    print(f"  Sleep      : {sleep.shape}")
    print(f"  PIMA       : {pima.shape}")
    print("\nDone.")
