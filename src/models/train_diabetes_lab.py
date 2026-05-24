#!/usr/bin/env python3
"""
Model 2 — Diabetes classifiers: clinical (NHANES lab) + screening (BRFSS).

Two complementary models for diabetes risk prediction:

  Mode "lab" (diabetes_lab)
  ─────────────────────────
  Source:   data/nhanes/nhanes_lab_fasting.csv  (NHANES 2021-2023, cycle L)
  Sample:   participants with both LBDGLUSI (glucose) AND LBDINSI (insulin)
  Features: LBDGLUSI, LBXGH, LBDINSI, LBXTC, LBDHDD, LBDLDL, age, gender, ethnicity
  Target:   DIQ010 == 1  (ever told you have diabetes; borderline/DK/refused dropped)
  Use case: user has lab results — highest-accuracy prediction

  Note: BMXBMI is not available because BMX_L.xpt was not included in the
  NHANES download list.  All remaining lab markers carry sufficient signal.

  Mode "screening" (diabetes_screening)
  ─────────────────────────────────────
  Source:   data/processed/brfss_clean.csv  (387,566 rows)
  Features: categoria_imc_enc, grupo_edad_enc, sexo_enc,
            ejercicio_ultimo_mes_enc, consumo_alcohol_enc,
            tiene_artritis_enc, tiene_cancer_piel_enc, tiene_otro_cancer_enc,
            tiene_cardiopatia_coronaria_enc, tiene_depresion_enc, tiene_asma_enc
  Target:   tiene_diabetes_enc == 2  (confirmed; pre-diabetes excluded)
  Use case: no lab data available — survey-based risk screening

  Why ml_data.unified_features was dropped for training
  ──────────────────────────────────────────────────────
  unified_features (1,142 rows) merges PIMA (768) with Sleep Health (374).
  The 768 PIMA rows lack Sleep-only columns, which are filled with medians:
  diastolic_bp→81, heart_rate→76, sleep_hours→7.4, physical_activity→52,
  daily_steps→0, stress_level→5.  These constants are identical for every
  PIMA row — they carry zero discriminative signal for diabetes prediction.
  With ~768 effective rows and artifically homogeneous features, unified_features
  would produce a noisier, less reliable model than brfss_clean's 387,566
  real survey responses. alert_hypertension, alert_sleep, and alert_heart were
  also excluded as features — they are alert targets for other conditions,
  and including them would introduce indirect leakage.

Outputs:
  models/diabetes_lab.joblib         — lab-based clinical model
  models/diabetes_screening.joblib   — survey-based screening model
  models/diabetes_shap_top5.json     — top-5 SHAP features per mode
"""

import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import shap
from sklearn.metrics import f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier

# ── Paths ──────────────────────────────────────────────────────────────────────

ROOT            = Path(__file__).resolve().parents[2]
LAB_PATH        = ROOT / "data" / "nhanes" / "nhanes_lab_fasting.csv"
SCREENING_PATH  = ROOT / "data" / "processed" / "brfss_clean.csv"
MODELS_DIR      = ROOT / "models"
MODELS_DIR.mkdir(exist_ok=True)

SHAP_SAMPLE_SIZE = 2_000
TEST_SIZE        = 0.20
RANDOM_STATE     = 42

# ── XGBoost base parameters (identical to train_multidisease.py) ───────────────

XGB_BASE_PARAMS = dict(
    n_estimators=300,
    max_depth=6,
    learning_rate=0.05,
    subsample=0.8,
    colsample_bytree=0.8,
    eval_metric="auc",
    early_stopping_rounds=20,
    random_state=RANDOM_STATE,
)

# ── Lab feature columns ────────────────────────────────────────────────────────
# gender arrives as string 'male'/'female' from download_nhanes.py → encoded below.
# ethnicity (RIDRETH3) is already numeric after the NHANES merge.
# BMXBMI not included — BMX_L.xpt not in download list.

LAB_FEATURES = [
    "LBDGLUSI",   # fasting plasma glucose (mmol/L)
    "LBXGH",      # HbA1c (%)
    "LBDINSI",    # fasting serum insulin (pmol/L)
    "LBXTC",      # total cholesterol (mg/dL)
    "LBDHDD",     # HDL cholesterol (mg/dL)
    "LBDLDL",     # LDL cholesterol (mg/dL)
    "age",
    "gender",     # string → encoded: male=0, female=1
    "ethnicity",  # RIDRETH3, already numeric
]

LAB_TARGET_COL = "DIQ010"

# ── Screening feature columns (from brfss_clean) ───────────────────────────────

SCREENING_FEATURES = [
    "categoria_imc_enc",
    "grupo_edad_enc",
    "sexo_enc",
    "ejercicio_ultimo_mes_enc",
    "consumo_alcohol_enc",
    "tiene_artritis_enc",
    "tiene_cancer_piel_enc",
    "tiene_otro_cancer_enc",
    "tiene_cardiopatia_coronaria_enc",
    "tiene_depresion_enc",
    "tiene_asma_enc",
]

SCREENING_TARGET_COL = "tiene_diabetes_enc"


# ── SHAP ───────────────────────────────────────────────────────────────────────

def get_shap_top5(model: XGBClassifier, X_sample: pd.DataFrame) -> list[dict]:
    """
    Compute top-5 features by mean absolute SHAP value using TreeExplainer.
    Handles SHAP output format variations across versions:
      - list [neg_class, pos_class] → take index 1
      - 3D array (n, f, 2)          → take [:, :, 1]
      - 2D array (n, f)             → use directly (positive class)
    """
    explainer = shap.TreeExplainer(model)
    raw = explainer.shap_values(X_sample)

    if isinstance(raw, list):
        arr = np.array(raw[1])
    elif isinstance(raw, np.ndarray) and raw.ndim == 3:
        arr = raw[:, :, 1]
    else:
        arr = np.array(raw)

    mean_abs = np.abs(arr).mean(axis=0)
    top5_idx = np.argsort(mean_abs)[::-1][:5]

    return [
        {
            "feature":   X_sample.columns[i],
            "mean_shap": round(float(mean_abs[i]), 6),
        }
        for i in top5_idx
    ]


# ── Lab mode ───────────────────────────────────────────────────────────────────

def load_lab_data() -> pd.DataFrame:
    if not LAB_PATH.exists():
        print(f"ERROR: {LAB_PATH} not found.")
        print("  Run  python src/data/build_dataset.py  first to download NHANES data.")
        sys.exit(1)

    print(f"Loading {LAB_PATH.name}…")
    df = pd.read_csv(LAB_PATH)
    print(f"  {df.shape[0]:,} rows × {df.shape[1]} cols")
    return df


def prepare_lab_data(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    df = df.copy()

    # Encode gender string → numeric (XGBoost requires numeric input)
    df["gender"] = df["gender"].map({"male": 0, "female": 1})

    # Warn about any feature columns absent in the CSV
    missing = [c for c in LAB_FEATURES if c not in df.columns]
    if missing:
        print(f"  WARNING: lab feature columns not found: {missing}")
        print("    These will be skipped — model trains on available columns only.")

    available = [c for c in LAB_FEATURES if c in df.columns]
    X = df[available].copy()

    if LAB_TARGET_COL not in df.columns:
        print(f"ERROR: target column '{LAB_TARGET_COL}' not found in {LAB_PATH.name}")
        sys.exit(1)

    # Keep only clear responses: 1=yes, 2=no, 3=borderline; drop 7=refused, 9=DK, NaN
    valid_mask = df[LAB_TARGET_COL].isin([1, 2, 3])
    X = X[valid_mask]
    y = (df.loc[valid_mask, LAB_TARGET_COL] == 1).astype("int8")
    y.index = X.index

    return X, y


def train_lab(df: pd.DataFrame) -> dict:
    sep = "─" * 38
    print(f"\n── lab (NHANES fasting) {sep}")

    X, y = prepare_lab_data(df)

    pos = int(y.sum())
    neg = int((y == 0).sum())
    print(f"  Rows after filtering DIQ010: {len(y):,}  "
          f"(pos: {pos:,} = {pos / len(y):.1%}  neg: {neg:,})")
    print(f"  Features ({len(X.columns)}): {list(X.columns)}")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, stratify=y, random_state=RANDOM_STATE
    )

    train_pos = int(y_train.sum())
    train_neg = int((y_train == 0).sum())
    spw = train_neg / max(train_pos, 1)
    print(f"  scale_pos_weight: {spw:.3f}")

    model = XGBClassifier(**XGB_BASE_PARAMS, scale_pos_weight=spw)
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

    best_iter = getattr(model, "best_iteration", XGB_BASE_PARAMS["n_estimators"] - 1) + 1
    print(f"  Best iteration: {best_iter} / {XGB_BASE_PARAMS['n_estimators']}")

    y_prob = model.predict_proba(X_test)[:, 1]
    y_pred = (y_prob >= 0.5).astype(int)

    auc_roc   = float(roc_auc_score(y_test, y_prob))
    f1        = float(f1_score(y_test, y_pred, zero_division=0))
    precision = float(precision_score(y_test, y_pred, zero_division=0))
    recall    = float(recall_score(y_test, y_pred, zero_division=0))

    print(
        f"  AUC-ROC: {auc_roc:.4f}  F1: {f1:.4f}  "
        f"Precision: {precision:.4f}  Recall: {recall:.4f}"
    )

    rng = np.random.default_rng(RANDOM_STATE)
    sample_size = min(SHAP_SAMPLE_SIZE, len(X_test))
    idx = rng.choice(len(X_test), size=sample_size, replace=False)
    X_shap = X_test.iloc[idx]

    top5 = get_shap_top5(model, X_shap)
    print(f"  Top-5 SHAP: {[item['feature'] for item in top5]}")

    out_path = MODELS_DIR / "diabetes_lab.joblib"
    joblib.dump(model, out_path)
    print(f"  Saved → {out_path.relative_to(ROOT)}")

    return {
        "mode":           "lab",
        "n_train":        len(y_train),
        "auc_roc":        auc_roc,
        "f1":             f1,
        "precision":      precision,
        "recall":         recall,
        "shap_top5":      top5,
        "best_iteration": best_iter,
    }


# ── Screening mode ─────────────────────────────────────────────────────────────

def load_screening_data() -> pd.DataFrame:
    if not SCREENING_PATH.exists():
        print(f"ERROR: {SCREENING_PATH} not found.")
        print("  Run  python src/data/build_dataset.py  first to load Supabase data.")
        sys.exit(1)

    print(f"Loading {SCREENING_PATH.name}…")
    df = pd.read_csv(SCREENING_PATH)
    print(f"  {df.shape[0]:,} rows × {df.shape[1]} cols")
    return df


def prepare_screening_data(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    missing = [c for c in SCREENING_FEATURES if c not in df.columns]
    if missing:
        print(f"  WARNING: screening feature columns not found: {missing}")
        print("    These will be skipped — model trains on available columns only.")

    available = [c for c in SCREENING_FEATURES if c in df.columns]
    X = df[available].copy()

    if SCREENING_TARGET_COL not in df.columns:
        print(f"ERROR: target column '{SCREENING_TARGET_COL}' not found in {SCREENING_PATH.name}")
        sys.exit(1)

    y = (df[SCREENING_TARGET_COL] == 2).astype("int8")
    return X, y


def train_screening(df: pd.DataFrame) -> dict:
    sep = "─" * 36
    print(f"\n── screening (BRFSS) {sep}")

    X, y = prepare_screening_data(df)

    pos = int(y.sum())
    neg = int((y == 0).sum())
    print(f"  Classes — positive: {pos:,} ({pos / len(y):.1%})  negative: {neg:,}")
    print(f"  Features ({len(X.columns)}): {list(X.columns)}")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, stratify=y, random_state=RANDOM_STATE
    )

    train_pos = int(y_train.sum())
    train_neg = int((y_train == 0).sum())
    spw = train_neg / max(train_pos, 1)
    print(f"  scale_pos_weight: {spw:.3f}")

    model = XGBClassifier(**XGB_BASE_PARAMS, scale_pos_weight=spw)
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

    best_iter = getattr(model, "best_iteration", XGB_BASE_PARAMS["n_estimators"] - 1) + 1
    print(f"  Best iteration: {best_iter} / {XGB_BASE_PARAMS['n_estimators']}")

    y_prob = model.predict_proba(X_test)[:, 1]
    y_pred = (y_prob >= 0.5).astype(int)

    auc_roc   = float(roc_auc_score(y_test, y_prob))
    f1        = float(f1_score(y_test, y_pred, zero_division=0))
    precision = float(precision_score(y_test, y_pred, zero_division=0))
    recall    = float(recall_score(y_test, y_pred, zero_division=0))

    print(
        f"  AUC-ROC: {auc_roc:.4f}  F1: {f1:.4f}  "
        f"Precision: {precision:.4f}  Recall: {recall:.4f}"
    )

    rng = np.random.default_rng(RANDOM_STATE)
    sample_size = min(SHAP_SAMPLE_SIZE, len(X_test))
    idx = rng.choice(len(X_test), size=sample_size, replace=False)
    X_shap = X_test.iloc[idx]

    top5 = get_shap_top5(model, X_shap)
    print(f"  Top-5 SHAP: {[item['feature'] for item in top5]}")

    out_path = MODELS_DIR / "diabetes_screening.joblib"
    joblib.dump(model, out_path)
    print(f"  Saved → {out_path.relative_to(ROOT)}")

    return {
        "mode":           "screening",
        "n_train":        len(y_train),
        "auc_roc":        auc_roc,
        "f1":             f1,
        "precision":      precision,
        "recall":         recall,
        "shap_top5":      top5,
        "best_iteration": best_iter,
    }


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    results   = []
    shap_data = {}

    lab_df = load_lab_data()
    lab_result = train_lab(lab_df)
    results.append(lab_result)
    shap_data["lab"] = lab_result["shap_top5"]

    screening_df = load_screening_data()
    screening_result = train_screening(screening_df)
    results.append(screening_result)
    shap_data["screening"] = screening_result["shap_top5"]

    # Save SHAP JSON
    shap_path = MODELS_DIR / "diabetes_shap_top5.json"
    with open(shap_path, "w") as fh:
        json.dump(shap_data, fh, indent=2)
    print(f"\nSHAP summary saved → {shap_path.relative_to(ROOT)}")

    # Comparison table
    col_w = 11
    print("\n")
    print("=== RESULTADOS DIABETES ===")
    print(
        f"  {'Modo':<{col_w}} {'N train':>8}  {'AUC-ROC':>8}  {'F1':>7}  "
        f"{'Precision':>10}  {'Recall':>7}"
    )
    print("  " + "─" * 58)
    for r in results:
        print(
            f"  {r['mode']:<{col_w}} {r['n_train']:>8,}  {r['auc_roc']:>8.3f}  {r['f1']:>7.3f}  "
            f"{r['precision']:>10.3f}  {r['recall']:>7.3f}"
        )
    print("=" * 28)


if __name__ == "__main__":
    main()
