"""
Step 5: Feature engineering & final ML-ready dataset.
Combines PIMA + Sleep features, creates alert target labels,
and outputs a unified feature matrix for model training.
"""

import os
import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.model_selection import train_test_split

PROCESSED_DIR = os.path.join(os.path.dirname(__file__), "..", "processed")


# ─────────────────────────────────────────────────────────────
# Load clean datasets
# ─────────────────────────────────────────────────────────────

def load_clean():
    brfss = pd.read_csv(os.path.join(PROCESSED_DIR, "brfss_2023_clean.csv"), low_memory=False)
    sleep = pd.read_csv(os.path.join(PROCESSED_DIR, "sleep_clean.csv"))
    pima  = pd.read_csv(os.path.join(PROCESSED_DIR, "pima_clean.csv"))
    return brfss, sleep, pima


# ─────────────────────────────────────────────────────────────
# BRFSS feature matrix
# ─────────────────────────────────────────────────────────────

BRFSS_FEATURE_COLS = [
    "sex", "age_group", "bmi_category", "general_health",
    "sleep_hours", "poor_mental_health_days", "poor_physical_health_days",
    "exercises", "drinks_alcohol", "ever_smoked",
    "physical_activity_category", "education_level", "income_level",
    "weight_kg", "height_cm", "bmi_computed",
]

BRFSS_TARGET_COLS = [
    "has_diabetes", "has_high_bp", "has_heart_disease",
    "has_depression", "has_asthma", "has_high_cholesterol",
    "has_arthritis", "has_stroke",
]


def engineer_brfss(df: pd.DataFrame) -> pd.DataFrame:
    print("Engineering BRFSS features…")

    avail_feat   = [c for c in BRFSS_FEATURE_COLS if c in df.columns]
    avail_target = [c for c in BRFSS_TARGET_COLS  if c in df.columns]
    df = df[avail_feat + avail_target].copy()

    # ── Risk score: count of Yes conditions ─────────────────
    for col in avail_target:
        df[col + "_bin"] = (df[col] == "Yes").astype(float)
    bin_cols = [c + "_bin" for c in avail_target if c + "_bin" in df.columns]
    df["condition_count"] = df[bin_cols].sum(axis=1)

    # ── Sleep risk flag ──────────────────────────────────────
    if "sleep_hours" in df.columns:
        df["sleep_risk"] = ((df["sleep_hours"] < 6) | (df["sleep_hours"] > 9)).astype(int)

    # ── BMI numeric (use computed if available) ──────────────
    if "bmi_computed" not in df.columns and "bmi_category" in df.columns:
        bmi_num_map = {"Underweight": 17, "Normal": 22, "Overweight": 27, "Obese": 35}
        df["bmi_numeric"] = df["bmi_category"].map(bmi_num_map)

    # ── Encode categoricals ──────────────────────────────────
    cat_cols = df.select_dtypes(exclude=np.number).columns.tolist()
    for col in cat_cols:
        le = LabelEncoder()
        df[col + "_enc"] = le.fit_transform(df[col].astype(str))

    # Drop original string columns
    df.drop(columns=cat_cols, inplace=True)

    # ── Drop rows missing all features ───────────────────────
    feat_only = [c for c in df.columns if c not in bin_cols + ["condition_count"]]
    before = len(df)
    df.dropna(subset=feat_only, how="all", inplace=True)
    print(f"  Rows after drop: {len(df):,} (dropped {before - len(df):,})")

    # Fill remaining NaN with median
    for col in df.select_dtypes(include=np.number).columns:
        df[col].fillna(df[col].median(), inplace=True)

    out = os.path.join(PROCESSED_DIR, "brfss_features.csv")
    df.to_csv(out, index=False)
    print(f"  Saved → {out}  ({df.shape})")
    return df


# ─────────────────────────────────────────────────────────────
# Sleep feature matrix
# ─────────────────────────────────────────────────────────────

def engineer_sleep(df: pd.DataFrame) -> pd.DataFrame:
    print("Engineering Sleep features…")
    df = df.copy()

    # ── Risk flags ───────────────────────────────────────────
    if "Sleep_Duration" in df.columns:
        df["sleep_risk"] = ((df["Sleep_Duration"] < 6) | (df["Sleep_Duration"] > 9)).astype(int)
    if "Stress_Level" in df.columns:
        df["high_stress"] = (df["Stress_Level"] >= 7).astype(int)
    if "Quality_of_Sleep" in df.columns:
        df["poor_sleep_quality"] = (df["Quality_of_Sleep"] <= 5).astype(int)
    if "Physical_Activity_Level" in df.columns:
        df["low_activity"] = (df["Physical_Activity_Level"] < 40).astype(int)
    if "Daily_Steps" in df.columns:
        df["low_steps"] = (df["Daily_Steps"] < 5000).astype(int)

    # ── Hypertension proxy ───────────────────────────────────
    if "systolic_bp" in df.columns:
        df["high_bp_proxy"] = (df["systolic_bp"] >= 130).astype(int)

    # ── BMI numeric ──────────────────────────────────────────
    if "BMI_Category" in df.columns:
        bmi_map = {"Underweight": 17, "Normal": 22, "Overweight": 27, "Obese": 35}
        df["bmi_numeric"] = df["BMI_Category"].map(bmi_map)

    # ── Encode Gender ────────────────────────────────────────
    if "Gender" in df.columns and "gender_male" not in df.columns:
        df["gender_male"] = (df["Gender"].str.lower() == "male").astype(int)

    # ── Encode Occupation ────────────────────────────────────
    if "Occupation" in df.columns:
        le = LabelEncoder()
        df["occupation_enc"] = le.fit_transform(df["Occupation"].astype(str))

    # ── Drop non-numeric or already-encoded string cols ──────
    drop_cols = ["Person_ID", "Gender", "Occupation", "BMI_Category",
                 "Sleep_Disorder", "Blood_Pressure"]
    df.drop(columns=[c for c in drop_cols if c in df.columns], inplace=True)

    # Fill remaining NaN
    for col in df.select_dtypes(include=np.number).columns:
        df[col].fillna(df[col].median(), inplace=True)

    out = os.path.join(PROCESSED_DIR, "sleep_features.csv")
    df.to_csv(out, index=False)
    print(f"  Saved → {out}  ({df.shape})")
    return df


# ─────────────────────────────────────────────────────────────
# PIMA feature matrix  (already numeric, just add engineered cols)
# ─────────────────────────────────────────────────────────────

def engineer_pima(df: pd.DataFrame) -> pd.DataFrame:
    print("Engineering PIMA features…")
    df = df.copy()

    # ── Interaction features ─────────────────────────────────
    if "Glucose" in df.columns and "BMI" in df.columns:
        df["glucose_bmi_interaction"] = df["Glucose"] * df["BMI"] / 1000

    if "Age" in df.columns:
        df["age_risk"]     = (df["Age"] >= 45).astype(int)
        df["age_over_60"]  = (df["Age"] >= 60).astype(int)

    if "Glucose" in df.columns:
        df["prediabetes"]  = ((df["Glucose"] >= 100) & (df["Glucose"] < 126)).astype(int)
        df["high_glucose"] = (df["Glucose"] >= 126).astype(int)

    if "BloodPressure" in df.columns:
        df["high_bp"] = (df["BloodPressure"] >= 90).astype(int)

    if "BMI" in df.columns:
        df["obese"] = (df["BMI"] >= 30).astype(int)

    # ── BMI numeric label column (encoded) ───────────────────
    if "BMI_Category" in df.columns:
        le = LabelEncoder()
        df["bmi_cat_enc"] = le.fit_transform(df["BMI_Category"].astype(str))
        df.drop(columns=["BMI_Category"], inplace=True)

    # ── Train/test split ─────────────────────────────────────
    if "has_diabetes" in df.columns:
        X = df.drop(columns=["has_diabetes"])
        y = df["has_diabetes"]

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )

        scaler = StandardScaler()
        X_train_sc = pd.DataFrame(
            scaler.fit_transform(X_train), columns=X_train.columns
        )
        X_test_sc = pd.DataFrame(
            scaler.transform(X_test), columns=X_test.columns
        )

        X_train_sc["has_diabetes"] = y_train.values
        X_test_sc["has_diabetes"]  = y_test.values

        train_path = os.path.join(PROCESSED_DIR, "pima_train.csv")
        test_path  = os.path.join(PROCESSED_DIR, "pima_test.csv")
        X_train_sc.to_csv(train_path, index=False)
        X_test_sc.to_csv(test_path, index=False)
        print(f"  Train → {train_path}  ({X_train_sc.shape})")
        print(f"  Test  → {test_path}   ({X_test_sc.shape})")

    out = os.path.join(PROCESSED_DIR, "pima_features.csv")
    df.to_csv(out, index=False)
    print(f"  Features → {out}  ({df.shape})")
    return df


# ─────────────────────────────────────────────────────────────
# Unified alert feature matrix
# Combines features from all datasets into a common schema
# for the CareBridge health-alert model.
# ─────────────────────────────────────────────────────────────

UNIFIED_SCHEMA = {
    # Demographics
    "age":               "float",
    "gender_male":       "int",
    # Vitals / anthropometrics
    "bmi":               "float",
    "systolic_bp":       "float",
    "diastolic_bp":      "float",
    "heart_rate":        "float",
    "glucose":           "float",
    # Lifestyle
    "sleep_hours":       "float",
    "physical_activity": "float",  # minutes or level
    "daily_steps":       "int",
    "stress_level":      "float",
    # Risk flags (binary)
    "sleep_risk":        "int",
    "high_stress":       "int",
    "low_activity":      "int",
    "obese":             "int",
    "high_bp":           "int",
    "high_glucose":      "int",
    # Targets (for multi-label alert model)
    "alert_diabetes":    "int",
    "alert_hypertension":"int",
    "alert_sleep":       "int",
    "alert_heart":       "int",
}


def build_unified(brfss_feat, sleep_feat, pima_feat):
    """
    Build a unified ML-ready matrix aligned to UNIFIED_SCHEMA.
    BRFSS rows form the backbone; PIMA and Sleep provide
    supplemental training signal.
    """
    print("\nBuilding unified feature matrix…")

    rows = []

    # ── PIMA rows ────────────────────────────────────────────
    for _, r in pima_feat.iterrows():
        row = {
            "age":                r.get("Age", np.nan),
            "bmi":                r.get("BMI", np.nan),
            "systolic_bp":        r.get("BloodPressure", np.nan),
            "glucose":            r.get("Glucose", np.nan),
            "high_glucose":       int(r.get("high_glucose", r.get("Glucose", 0) >= 126)),
            "high_bp":            int(r.get("high_bp", r.get("BloodPressure", 0) >= 90)),
            "obese":              int(r.get("obese", r.get("BMI", 0) >= 30)),
            "alert_diabetes":     int(r.get("has_diabetes", 0)),
            "alert_hypertension": int(r.get("high_bp", r.get("BloodPressure", 0) >= 90)),
            "source":             "pima",
        }
        rows.append(row)

    # ── Sleep rows ───────────────────────────────────────────
    for _, r in sleep_feat.iterrows():
        row = {
            "age":                r.get("Age", np.nan),
            "gender_male":        int(r.get("gender_male", 0)),
            "bmi":                r.get("bmi_numeric", np.nan),
            "systolic_bp":        r.get("systolic_bp", np.nan),
            "diastolic_bp":       r.get("diastolic_bp", np.nan),
            "heart_rate":         r.get("Heart_Rate", np.nan),
            "sleep_hours":        r.get("Sleep_Duration", np.nan),
            "physical_activity":  r.get("Physical_Activity_Level", np.nan),
            "daily_steps":        r.get("Daily_Steps", np.nan),
            "stress_level":       r.get("Stress_Level", np.nan),
            "sleep_risk":         int(r.get("sleep_risk", 0)),
            "high_stress":        int(r.get("high_stress", 0)),
            "low_activity":       int(r.get("low_activity", 0)),
            "high_bp":            int(r.get("high_bp_proxy", 0)),
            "alert_sleep":        int(r.get("poor_sleep_quality", 0)),
            "alert_hypertension": int(r.get("high_bp_proxy", 0)),
            "source":             "sleep",
        }
        rows.append(row)

    unified = pd.DataFrame(rows)

    # Fill missing columns defined in schema
    for col in UNIFIED_SCHEMA:
        if col not in unified.columns:
            unified[col] = np.nan

    # Median imputation
    for col, dtype in UNIFIED_SCHEMA.items():
        if dtype == "float":
            unified[col].fillna(unified[col].median(), inplace=True)
        else:
            unified[col].fillna(0, inplace=True)
        unified[col] = unified[col].astype(float if dtype == "float" else int)

    out = os.path.join(PROCESSED_DIR, "unified_features.csv")
    unified.to_csv(out, index=False)
    print(f"  Unified matrix → {out}  ({unified.shape})")
    print(f"  Alert label prevalence:")
    for col in ["alert_diabetes", "alert_hypertension", "alert_sleep", "alert_heart"]:
        if col in unified.columns:
            print(f"    {col}: {unified[col].mean():.1%}")
    return unified


# ─────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("STEP 5 — Feature Engineering")
    print("=" * 60)

    brfss_raw, sleep_raw, pima_raw = load_clean()

    brfss_feat = engineer_brfss(brfss_raw)
    sleep_feat = engineer_sleep(sleep_raw)
    pima_feat  = engineer_pima(pima_raw)

    unified = build_unified(brfss_feat, sleep_feat, pima_feat)

    print("\nAll feature matrices saved to Data/processed/")
    print("Done.")
