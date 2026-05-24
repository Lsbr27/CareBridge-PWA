"""
Step 3: Clean all three datasets.
Applies BRFSS code-to-label mapping, handles sentinel values,
fixes PIMA zero-as-missing, parses sleep BP strings, and outputs
clean CSVs to Data/processed/.
"""

import os
import numpy as np
import pandas as pd

PROCESSED_DIR = os.path.join(os.path.dirname(__file__), "..", "processed")
RAW_DIR       = os.path.join(os.path.dirname(__file__), "..", "raw")


# ─────────────────────────────────────────────────────────────
# BRFSS 2023
# ─────────────────────────────────────────────────────────────

def clean_brfss(df: pd.DataFrame) -> pd.DataFrame:
    print("Cleaning BRFSS…")
    df = df.copy()

    # ── Sentinel → NaN ──────────────────────────────────────
    # BRFSS uses 7=Don't know, 9=Refused, 77/99=same for 2-digit fields
    two_digit_refuse = [7, 9]
    for col in df.columns:
        if df[col].dtype in [np.float64, np.int64]:
            max_val = df[col].max()
            if max_val <= 9:
                df[col] = df[col].replace({7: np.nan, 9: np.nan})
            elif max_val <= 99:
                df[col] = df[col].replace({77: np.nan, 99: np.nan})

    # ── Computed variables (already recoded by CDC, keep as-is) ──

    # ── Label mappings ──────────────────────────────────────
    sex_map       = {1: "Male", 2: "Female"}
    genhlth_map   = {1: "Excellent", 2: "Very Good", 3: "Good", 4: "Fair", 5: "Poor"}
    yesno_map     = {1: "Yes", 2: "No"}
    bmi_map       = {1: "Underweight", 2: "Normal", 3: "Overweight", 4: "Obese"}
    educ_map      = {1: "No school", 2: "Elementary", 3: "Some high school",
                     4: "High school grad", 5: "Some college", 6: "College grad"}
    income_map    = {1: "<$15k", 2: "$15-25k", 3: "$25-35k", 4: "$35-50k",
                     5: "$50-100k", 6: "$100-200k", 7: ">$200k"}
    ageg_map      = {
        1: "18-24", 2: "25-29", 3: "30-34", 4: "35-39", 5: "40-44",
        6: "45-49", 7: "50-54", 8: "55-59", 9: "60-64", 10: "65-69",
        11: "70-74", 12: "75-79", 13: "80+",
    }
    pacat_map     = {1: "Highly Active", 2: "Active", 3: "Insufficiently Active", 4: "Inactive"}

    apply_map = {
        "SEX":      sex_map,
        "GENHLTH":  genhlth_map,
        "_BMI5CAT": bmi_map,
        "_AGEG5YR": ageg_map,
        "_EDUCAG":  educ_map,
        "_INCOMG1": income_map,
        "_PACAT3":  pacat_map,
        "DIABETE4": yesno_map,
        "CVDCRHD4": yesno_map,
        "CVDSTRK3": yesno_map,
        "BPHIGH6":  yesno_map,
        "TOLDHI3":  yesno_map,
        "ADDEPEV3": yesno_map,
        "CHCKDNY2": yesno_map,
        "ASTHMA3":  yesno_map,
        "HAVARTH5": yesno_map,
        "EXERANY2": yesno_map,
        "SMOKE100": yesno_map,
        "DRNKANY6": yesno_map,
    }

    for col, mapping in apply_map.items():
        if col in df.columns:
            df[col] = df[col].map(mapping)

    # ── Derived numeric features ─────────────────────────────
    if "WTKG3" in df.columns:
        df["weight_kg"] = df["WTKG3"] / 100.0  # stored as kg×100

    if "HTM4" in df.columns:
        df["height_cm"] = df["HTM4"]            # already in cm

    # Recalculate BMI from raw height/weight if available
    if "weight_kg" in df.columns and "height_cm" in df.columns:
        h_m = df["height_cm"] / 100.0
        df["bmi_computed"] = (df["weight_kg"] / (h_m ** 2)).round(1)

    # ── Sleep: cap at 24, values >24 are BRFSS codes for missing ─
    if "SLEPTIM1" in df.columns:
        df["SLEPTIM1"] = df["SLEPTIM1"].where(df["SLEPTIM1"] <= 24)

    # ── Rename to readable names ─────────────────────────────
    rename = {
        "SEX":      "sex",
        "GENHLTH":  "general_health",
        "_AGEG5YR": "age_group",
        "_BMI5CAT": "bmi_category",
        "SMOKE100": "ever_smoked",
        "SLEPTIM1": "sleep_hours",
        "MENTHLTH": "poor_mental_health_days",
        "PHYSHLTH": "poor_physical_health_days",
        "DIABETE4": "has_diabetes",
        "CVDCRHD4": "has_heart_disease",
        "CVDSTRK3": "has_stroke",
        "BPHIGH6":  "has_high_bp",
        "TOLDHI3":  "has_high_cholesterol",
        "ADDEPEV3": "has_depression",
        "ASTHMA3":  "has_asthma",
        "HAVARTH5": "has_arthritis",
        "EXERANY2": "exercises",
        "DRNKANY6": "drinks_alcohol",
        "_PACAT3":  "physical_activity_category",
        "_EDUCAG":  "education_level",
        "_INCOMG1": "income_level",
    }
    df.rename(columns={k: v for k, v in rename.items() if k in df.columns}, inplace=True)

    # ── Drop rows with no usable health data ─────────────────
    health_cols = [c for c in ["general_health", "has_diabetes", "has_high_bp"] if c in df.columns]
    before = len(df)
    df.dropna(subset=health_cols, how="all", inplace=True)
    print(f"  Dropped {before - len(df):,} fully-empty rows → {len(df):,} remaining")

    out = os.path.join(PROCESSED_DIR, "brfss_2023_clean.csv")
    df.to_csv(out, index=False)
    print(f"  Saved → {out}")
    return df


# ─────────────────────────────────────────────────────────────
# Sleep Health and Lifestyle
# ─────────────────────────────────────────────────────────────

def clean_sleep(df: pd.DataFrame) -> pd.DataFrame:
    print("Cleaning Sleep dataset…")
    df = df.copy()

    # ── Parse Blood_Pressure "120/80" → systolic, diastolic ─
    if "Blood_Pressure" in df.columns:
        bp_parts = df["Blood_Pressure"].str.split("/", expand=True)
        df["systolic_bp"]  = pd.to_numeric(bp_parts[0], errors="coerce")
        df["diastolic_bp"] = pd.to_numeric(bp_parts[1], errors="coerce")
        df.drop(columns=["Blood_Pressure"], inplace=True)

    # ── Standardize BMI labels ───────────────────────────────
    if "BMI_Category" in df.columns:
        df["BMI_Category"] = df["BMI_Category"].str.strip().str.title()
        df["BMI_Category"] = df["BMI_Category"].replace({"Normal Weight": "Normal"})

    # ── Encode Gender ────────────────────────────────────────
    if "Gender" in df.columns:
        df["gender_male"] = (df["Gender"].str.strip().str.lower() == "male").astype(int)

    # ── One-hot encode Sleep_Disorder ───────────────────────
    if "Sleep_Disorder" in df.columns:
        df["Sleep_Disorder"] = df["Sleep_Disorder"].fillna("None").str.strip()
        disorder_dummies = pd.get_dummies(df["Sleep_Disorder"], prefix="disorder")
        df = pd.concat([df, disorder_dummies], axis=1)

    # ── Numeric coercion ─────────────────────────────────────
    for col in ["Sleep_Duration", "Quality_of_Sleep", "Physical_Activity_Level",
                "Stress_Level", "Heart_Rate", "Daily_Steps", "Age"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # ── Cap outliers ─────────────────────────────────────────
    if "Sleep_Duration" in df.columns:
        df["Sleep_Duration"] = df["Sleep_Duration"].clip(0, 24)
    if "Heart_Rate" in df.columns:
        df["Heart_Rate"] = df["Heart_Rate"].clip(30, 250)
    if "Daily_Steps" in df.columns:
        df["Daily_Steps"] = df["Daily_Steps"].clip(0, 50000)

    before = len(df)
    df.dropna(subset=["Sleep_Duration", "Quality_of_Sleep"], inplace=True)
    print(f"  Dropped {before - len(df):,} rows missing key fields → {len(df):,} remaining")

    out = os.path.join(PROCESSED_DIR, "sleep_clean.csv")
    df.to_csv(out, index=False)
    print(f"  Saved → {out}")
    return df


# ─────────────────────────────────────────────────────────────
# PIMA Diabetes
# ─────────────────────────────────────────────────────────────

# Columns where 0 is biologically impossible → treat as missing
PIMA_ZERO_INVALID = ["Glucose", "BloodPressure", "SkinThickness", "Insulin", "BMI"]


def clean_pima(df: pd.DataFrame) -> pd.DataFrame:
    print("Cleaning PIMA Diabetes dataset…")
    df = df.copy()

    # ── Replace 0s with NaN for physiologically impossible fields ─
    before_zero = (df[PIMA_ZERO_INVALID] == 0).sum().sum()
    df[PIMA_ZERO_INVALID] = df[PIMA_ZERO_INVALID].replace(0, np.nan)
    print(f"  Replaced {before_zero} zero values with NaN in {PIMA_ZERO_INVALID}")

    # ── Impute with median (robust to remaining outliers) ────
    for col in PIMA_ZERO_INVALID:
        median_val = df[col].median()
        df[col].fillna(median_val, inplace=True)
        print(f"    {col}: imputed {(df[col].isna()).sum()} NaN → median {median_val:.1f}")

    # ── Clip physiological outliers ──────────────────────────
    clip_rules = {
        "Glucose":                (50, 300),
        "BloodPressure":          (40, 140),
        "BMI":                    (10, 70),
        "Age":                    (18, 100),
        "Insulin":                (0, 850),
        "DiabetesPedigreeFunction": (0, 3),
    }
    for col, (lo, hi) in clip_rules.items():
        if col in df.columns:
            df[col] = df[col].clip(lo, hi)

    # ── Add BMI category label ───────────────────────────────
    def bmi_label(b):
        if b < 18.5:  return "Underweight"
        if b < 25:    return "Normal"
        if b < 30:    return "Overweight"
        return "Obese"

    df["BMI_Category"] = df["BMI"].apply(bmi_label)

    # ── Rename Outcome for clarity ───────────────────────────
    df.rename(columns={"Outcome": "has_diabetes"}, inplace=True)

    print(f"  Final shape: {df.shape}")
    print(f"  Diabetes prevalence: {df['has_diabetes'].mean():.1%}")

    out = os.path.join(PROCESSED_DIR, "pima_clean.csv")
    df.to_csv(out, index=False)
    print(f"  Saved → {out}")
    return df


# ─────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("STEP 3 — Cleaning datasets")
    print("=" * 60)

    # Load raw CSVs produced by script 01
    brfss_raw = pd.read_csv(
        os.path.join(PROCESSED_DIR, "brfss_2023_raw.csv"), low_memory=False
    )
    sleep_raw = pd.read_csv(os.path.join(RAW_DIR, "sleep_health_and_lifestyle.csv"))
    pima_raw  = pd.read_csv(os.path.join(RAW_DIR, "pima_diabetes.csv"))

    brfss_clean = clean_brfss(brfss_raw)
    sleep_clean = clean_sleep(sleep_raw)
    pima_clean  = clean_pima(pima_raw)

    print("\nClean shapes:")
    print(f"  BRFSS : {brfss_clean.shape}")
    print(f"  Sleep : {sleep_clean.shape}")
    print(f"  PIMA  : {pima_clean.shape}")
    print("\nDone.")
