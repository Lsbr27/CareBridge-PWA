#!/usr/bin/env python3
"""
Model 3 — Perceived health classifier (multi:softprob on brfss_clean).

Predicts salud_general (self-rated health) as a 5-class ordinal problem.
No lab data needed — features are demographics, lifestyle, and chronic conditions.

Target encoding (derived at runtime from the text column salud_general):
  mala=0  regular=1  buena=2  muy_buena=3  excelente=4
  Ordinal order reflects true severity: higher = healthier.
  Rows whose salud_general value is outside this map are logged and dropped.

Source: data/processed/brfss_clean.csv (387,566 rows, no nulls in target)

Observed class distribution:
  mala      20,290   5.2%
  regular   61,370  15.8%
  buena    133,829  34.5%
  muy_buena 120,945  31.2%
  excelente  51,132  13.2%

Features (~15 numeric columns):
  Demographics / lifestyle:
    grupo_edad_enc, sexo_enc, categoria_imc_enc,
    ejercicio_ultimo_mes_enc, consumo_alcohol_enc,
    altura_cm, peso_kg
  Chronic conditions (all 4 are features here — none is the target):
    tiene_diabetes_enc, tiene_cardiopatia_coronaria_enc,
    tiene_depresion_enc, tiene_asma_enc,
    tiene_cancer_piel_enc, tiene_otro_cancer_enc, tiene_artritis_enc

Class imbalance: compute_sample_weight('balanced', y_train) passed as
sample_weight to model.fit() — no scale_pos_weight for multiclass.

Outputs:
  models/health_score.joblib          — 5-class softprob model
  models/health_score_shap_top5.json  — top-5 features by global SHAP importance
"""

import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import shap
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score
from sklearn.model_selection import train_test_split
from sklearn.utils.class_weight import compute_sample_weight
from xgboost import XGBClassifier

# ── Paths ──────────────────────────────────────────────────────────────────────

ROOT       = Path(__file__).resolve().parents[2]
DATA_PATH  = ROOT / "data" / "processed" / "brfss_clean.csv"
MODELS_DIR = ROOT / "models"
MODELS_DIR.mkdir(exist_ok=True)

SHAP_SAMPLE_SIZE = 2_000
TEST_SIZE        = 0.20
RANDOM_STATE     = 42
NULL_THRESHOLD   = 0.20

# ── Target encoding ────────────────────────────────────────────────────────────

HEALTH_MAP = {
    "mala":      0,
    "regular":   1,
    "buena":     2,
    "muy_buena": 3,
    "excelente": 4,
}
NUM_CLASSES = len(HEALTH_MAP)  # 5

# ── Columns always excluded from features ──────────────────────────────────────
# Mirrors train_multidisease.py — raw text columns and composite leakage scores.
# salud_general is text and also the target source; excluded here so it never
# ends up as a feature.

ALWAYS_EXCLUDE = {
    "id",
    "salud_general",
    "ejercicio_ultimo_mes",
    "consumo_alcohol",
    "categoria_imc",
    "grupo_edad",
    "sexo",
    "tiene_diabetes",
    "tiene_cardiopatia_coronaria",
    "tiene_depresion",
    "tiene_cancer_piel",
    "tiene_otro_cancer",
    "tiene_artritis",
    "tiene_asma",
    "riesgo_salud",
    "riesgo_salud_label",
}

# ── XGBoost parameters ─────────────────────────────────────────────────────────

XGB_PARAMS = dict(
    objective="multi:softprob",
    num_class=NUM_CLASSES,
    n_estimators=300,
    max_depth=6,
    learning_rate=0.05,
    subsample=0.8,
    colsample_bytree=0.8,
    eval_metric="mlogloss",
    early_stopping_rounds=20,
    random_state=RANDOM_STATE,
)


# ── Data loading ───────────────────────────────────────────────────────────────

def load_data() -> pd.DataFrame:
    if not DATA_PATH.exists():
        print(f"ERROR: {DATA_PATH} not found.")
        print("  Run  python src/data/build_dataset.py  first.")
        sys.exit(1)

    print(f"Loading {DATA_PATH.name}…")
    df = pd.read_csv(DATA_PATH)
    print(f"  {df.shape[0]:,} rows × {df.shape[1]} cols")
    return df


# ── Target derivation ──────────────────────────────────────────────────────────

def derive_target(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    if "salud_general" not in df.columns:
        print("ERROR: column 'salud_general' not found in the CSV.")
        sys.exit(1)

    # Nulls
    n_null = int(df["salud_general"].isnull().sum())
    if n_null:
        print(f"  WARNING: {n_null:,} null values in salud_general — dropping.")
        df = df[df["salud_general"].notna()].copy()

    # Unknown values outside the map
    unknown = set(df["salud_general"].unique()) - set(HEALTH_MAP)
    if unknown:
        n_unknown = int(df["salud_general"].isin(unknown).sum())
        print(f"  WARNING: {n_unknown:,} rows have unmapped salud_general values: "
              f"{sorted(unknown)} — dropping.")
        df = df[~df["salud_general"].isin(unknown)].copy()

    y = df["salud_general"].map(HEALTH_MAP).astype("int8")
    return df, y


# ── Feature selection ──────────────────────────────────────────────────────────

def get_feature_columns(df: pd.DataFrame, high_null_cols: set) -> list[str]:
    exclude = ALWAYS_EXCLUDE | high_null_cols
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    return [c for c in numeric_cols if c not in exclude]


# ── SHAP — multiclass ──────────────────────────────────────────────────────────

def get_shap_top5(model: XGBClassifier, X_sample: pd.DataFrame) -> list[dict]:
    """
    Multiclass SHAP output formats across versions:
      - list of K arrays (n, f)  — one per class (old SHAP)  → stack to (n, f, K)
      - 3D array (n, f, K)       — new SHAP                  → use directly

    Global feature importance = mean |SHAP| over both samples and classes → (f,)
    """
    explainer = shap.TreeExplainer(model)
    raw = explainer.shap_values(X_sample)

    if isinstance(raw, list):
        arr = np.stack(raw, axis=2)             # (n, f, K)
    elif isinstance(raw, np.ndarray) and raw.ndim == 3:
        arr = raw                               # already (n, f, K)
    else:
        arr = np.array(raw)[:, :, np.newaxis]   # 2D fallback → (n, f, 1)

    mean_abs = np.abs(arr).mean(axis=(0, 2))    # → (f,)
    top5_idx = np.argsort(mean_abs)[::-1][:5]

    return [
        {
            "feature":   X_sample.columns[i],
            "mean_shap": round(float(mean_abs[i]), 6),
        }
        for i in top5_idx
    ]


# ── Training ───────────────────────────────────────────────────────────────────

def train(
    df: pd.DataFrame,
    y: pd.Series,
    feature_cols: list[str],
) -> dict:
    X = df[feature_cols].copy()
    print(f"\n  Features ({len(feature_cols)}): {feature_cols}")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, stratify=y, random_state=RANDOM_STATE
    )
    print(f"  Train: {len(y_train):,}  Test: {len(y_test):,}")

    sample_weights = compute_sample_weight("balanced", y_train)

    model = XGBClassifier(**XGB_PARAMS)
    model.fit(
        X_train, y_train,
        sample_weight=sample_weights,
        eval_set=[(X_test, y_test)],
        verbose=False,
    )

    best_iter = getattr(model, "best_iteration", XGB_PARAMS["n_estimators"] - 1) + 1
    print(f"  Best iteration: {best_iter} / {XGB_PARAMS['n_estimators']}")

    y_pred = model.predict(X_test)

    accuracy    = float(accuracy_score(y_test, y_pred))
    f1_macro    = float(f1_score(y_test, y_pred, average="macro",    zero_division=0))
    f1_weighted = float(f1_score(y_test, y_pred, average="weighted", zero_division=0))

    print(f"\n  Accuracy:    {accuracy:.4f}")
    print(f"  F1 macro:    {f1_macro:.4f}")
    print(f"  F1 weighted: {f1_weighted:.4f}")

    # Confusion matrix
    id_to_label = {v: k for k, v in HEALTH_MAP.items()}
    labels      = sorted(HEALTH_MAP.values())
    cm          = confusion_matrix(y_test, y_pred, labels=labels)
    col_w       = 12

    print(f"\n  Confusion matrix (rows=true, cols=predicted):")
    header = f"  {'True \\ Pred':<{col_w}}" + "".join(
        f"{id_to_label[l]:>{col_w}}" for l in labels
    )
    print(header)
    print("  " + "─" * (col_w * (1 + len(labels))))
    for i, l in enumerate(labels):
        row = f"  {id_to_label[l]:<{col_w}}" + "".join(
            f"{cm[i, j]:>{col_w},}" for j in range(len(labels))
        )
        print(row)

    # SHAP
    rng = np.random.default_rng(RANDOM_STATE)
    sample_size = min(SHAP_SAMPLE_SIZE, len(X_test))
    idx = rng.choice(len(X_test), size=sample_size, replace=False)
    X_shap = X_test.iloc[idx]

    top5 = get_shap_top5(model, X_shap)
    print(f"\n  Top-5 SHAP: {[item['feature'] for item in top5]}")

    out_path = MODELS_DIR / "health_score.joblib"
    joblib.dump(model, out_path)
    print(f"  Saved → {out_path.relative_to(ROOT)}")

    return {
        "accuracy":       accuracy,
        "f1_macro":       f1_macro,
        "f1_weighted":    f1_weighted,
        "shap_top5":      top5,
        "best_iteration": best_iter,
    }


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    df = load_data()

    df, y = derive_target(df)

    # Class distribution
    id_to_label = {v: k for k, v in HEALTH_MAP.items()}
    print("\n  Distribución de clases (salud_general):")
    for cls_idx in sorted(HEALTH_MAP.values()):
        n = int((y == cls_idx).sum())
        print(f"    {cls_idx}  {id_to_label[cls_idx]:<10}  {n:>7,}  ({n / len(y):.1%})")

    # High-null column exclusion
    null_pct       = df.isnull().mean()
    high_null_cols = set(null_pct[null_pct > NULL_THRESHOLD].index.tolist())
    if high_null_cols:
        print(f"\n  Excluding {len(high_null_cols)} high-null column(s) "
              f"(>{NULL_THRESHOLD:.0%}): {sorted(high_null_cols)}")

    feature_cols = get_feature_columns(df, high_null_cols)
    result       = train(df, y, feature_cols)

    # Save SHAP JSON
    shap_path = MODELS_DIR / "health_score_shap_top5.json"
    with open(shap_path, "w") as fh:
        json.dump({"health_score": result["shap_top5"]}, fh, indent=2)
    print(f"\n  SHAP saved → {shap_path.relative_to(ROOT)}")

    # Final summary
    top5_str = ", ".join(
        f"{item['feature']} ({item['mean_shap']:.4f})"
        for item in result["shap_top5"]
    )
    clases_str = "  ".join(
        f"{v}={k} ({int((y == v).sum() / len(y) * 100)}%)"
        for k, v in HEALTH_MAP.items()
    )
    print("\n")
    print("=== MODELO SALUD PERCIBIDA ===")
    print(f"  Clases: {clases_str}")
    print(f"  Accuracy:    {result['accuracy']:.3f}")
    print(f"  F1 macro:    {result['f1_macro']:.3f}")
    print(f"  F1 weighted: {result['f1_weighted']:.3f}")
    print(f"  Top features: {top5_str}")
    print("==============================")


if __name__ == "__main__":
    main()
