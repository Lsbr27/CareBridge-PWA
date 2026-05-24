#!/usr/bin/env python3
"""
Model 1 — Multi-disease binary classifiers trained on brfss_clean.

One XGBClassifier per condition, fitted on ml_data.brfss_clean (387,566 rows).
Targets are binarized from the tiene_*_enc columns.

Conditions trained:
  diabetes      → tiene_diabetes_enc == 2   (confirmed; pre-diabetes excluded)
  heart_disease → tiene_cardiopatia_coronaria_enc
  depression    → tiene_depresion_enc
  asthma        → tiene_asma_enc

Missing targets (only in ml_data.brfss_features — not used here):
  has_high_bp_bin, has_high_cholesterol_bin, has_stroke_bin
  → partially compensated by NHANES data (nhanes_lab_merged.csv)

Outputs:
  models/multidisease_{condition}.joblib   — one model per condition
  models/multidisease_shap_top5.json       — top-5 SHAP features per condition
"""

import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import shap
from sklearn.metrics import f1_score, precision_recall_curve, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier

# ── Paths ──────────────────────────────────────────────────────────────────────

ROOT       = Path(__file__).resolve().parents[2]
DATA_PATH  = ROOT / "data" / "processed" / "brfss_clean.csv"
MODELS_DIR = ROOT / "models"
MODELS_DIR.mkdir(exist_ok=True)

SHAP_SAMPLE_SIZE = 2_000
TEST_SIZE        = 0.20
RANDOM_STATE     = 42
NULL_THRESHOLD   = 0.20   # exclude features with >20% null values

# ── Target definitions ─────────────────────────────────────────────────────────
#
# extra_exclude: columns to drop beyond the source_col when this is the target.
# For diabetes, tiene_diabetes_enc is ternary (0=no, 1=pre, 2=sí) — all three
# values encode information about the target, so the full column must go.

TARGETS = [
    {
        "name":          "diabetes",
        "source_col":    "tiene_diabetes_enc",
        "binarize":      lambda df: (df["tiene_diabetes_enc"] == 2).astype("int8"),
        "extra_exclude": ["tiene_diabetes_enc"],
    },
    {
        "name":          "heart_disease",
        "source_col":    "tiene_cardiopatia_coronaria_enc",
        "binarize":      lambda df: df["tiene_cardiopatia_coronaria_enc"].astype("int8"),
        "extra_exclude": [],
    },
    {
        "name":          "depression",
        "source_col":    "tiene_depresion_enc",
        "binarize":      lambda df: df["tiene_depresion_enc"].astype("int8"),
        "extra_exclude": [],
    },
    {
        "name":          "asthma",
        "source_col":    "tiene_asma_enc",
        "binarize":      lambda df: df["tiene_asma_enc"].astype("int8"),
        "extra_exclude": [],
    },
]

# ── salud_general encoding — added as numeric feature (not leakage for binary targets) ─

HEALTH_ENC = {
    "mala":      0,
    "regular":   1,
    "buena":     2,
    "muy_buena": 3,
    "excelente": 4,
}

# ── Columns always excluded from features ──────────────────────────────────────

ALWAYS_EXCLUDE = {
    "id",
    # Raw text columns — same information as their _enc counterparts;
    # XGBoost requires numeric input so these must be dropped regardless
    # salud_general (text) is excluded here; salud_general_enc is added in load_data()
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
    # Composite score derived from all condition columns — direct leakage
    "riesgo_salud",
    "riesgo_salud_label",
}

# ── XGBoost base parameters (shared across all conditions) ─────────────────────

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


# ── Data loading ───────────────────────────────────────────────────────────────

def load_data() -> pd.DataFrame:
    if not DATA_PATH.exists():
        print(f"ERROR: {DATA_PATH} not found.")
        print("  Run  python src/data/build_dataset.py  first.")
        sys.exit(1)

    print(f"Loading {DATA_PATH.name}…")
    df = pd.read_csv(DATA_PATH)
    print(f"  {df.shape[0]:,} rows × {df.shape[1]} cols")
    df["salud_general_enc"] = df["salud_general"].map(HEALTH_ENC).fillna(2)
    return df


# ── Feature selection ──────────────────────────────────────────────────────────

def get_feature_columns(
    df: pd.DataFrame,
    target_config: dict,
    high_null_cols: set,
) -> list[str]:
    """
    Return numeric feature columns for a given target, after exclusions.

    Excluded per model:
      - ALWAYS_EXCLUDE  (identifiers, raw text, leakage composite scores)
      - source_col      (the column used to derive the target)
      - extra_exclude   (e.g. full ternary tiene_diabetes_enc for diabetes)
      - high_null_cols  (>20% null values)

    Remaining ~13 features per model:
      altura_cm, peso_kg,
      ejercicio_ultimo_mes_enc, consumo_alcohol_enc, categoria_imc_enc,
      grupo_edad_enc, sexo_enc,
      tiene_cancer_piel_enc, tiene_otro_cancer_enc, tiene_artritis_enc,
      + the 3 chronic condition _enc columns that are not the current target
    """
    exclude = (
        ALWAYS_EXCLUDE
        | {target_config["source_col"]}
        | set(target_config["extra_exclude"])
        | high_null_cols
    )
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    return [c for c in numeric_cols if c not in exclude]


# ── SHAP ───────────────────────────────────────────────────────────────────────

def get_shap_top5(model: XGBClassifier, X_sample: pd.DataFrame) -> list[dict]:
    """
    Compute top-5 features by mean absolute SHAP value using TreeExplainer.
    X_sample should be a random subset of the test set (≤2,000 rows).

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


# ── Per-condition training ─────────────────────────────────────────────────────

def train_one(
    df: pd.DataFrame,
    target_config: dict,
    high_null_cols: set,
) -> dict:
    name = target_config["name"]
    sep  = "─" * (44 - len(name))
    print(f"\n── {name} {sep}")

    # Target vector
    y = target_config["binarize"](df)
    pos = int(y.sum())
    neg = int((y == 0).sum())
    print(f"  Classes — positive: {pos:,} ({pos / len(y):.1%})  negative: {neg:,}")

    # Feature matrix
    feature_cols = get_feature_columns(df, target_config, high_null_cols)
    X = df[feature_cols].copy()
    print(f"  Features ({len(feature_cols)}): {feature_cols}")

    # 80/20 stratified split — the 20% serves as both test set and early-stopping set
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, stratify=y, random_state=RANDOM_STATE
    )

    # scale_pos_weight: ratio of negatives to positives in training set
    train_pos = int(y_train.sum())
    train_neg = int((y_train == 0).sum())
    spw = train_neg / max(train_pos, 1)
    print(f"  scale_pos_weight: {spw:.3f}")

    # Train
    model = XGBClassifier(**XGB_BASE_PARAMS, scale_pos_weight=spw)
    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=False,
    )
    best_iter = getattr(model, "best_iteration", XGB_BASE_PARAMS["n_estimators"] - 1) + 1
    print(f"  Best iteration: {best_iter} / {XGB_BASE_PARAMS['n_estimators']}")

    # Evaluation metrics
    y_prob = model.predict_proba(X_test)[:, 1]

    # F1-optimal threshold (imbalanced classes — 0.5 is rarely optimal)
    precisions_pr, recalls_pr, thresholds_pr = precision_recall_curve(y_test, y_prob)
    f1_pr = 2 * precisions_pr * recalls_pr / (precisions_pr + recalls_pr + 1e-9)
    best_thr = float(thresholds_pr[np.argmax(f1_pr[:-1])])
    y_pred_opt = (y_prob >= best_thr).astype(int)

    y_pred    = (y_prob >= 0.5).astype(int)
    auc_roc   = float(roc_auc_score(y_test, y_prob))
    f1        = float(f1_score(y_test, y_pred_opt, zero_division=0))
    precision = float(precision_score(y_test, y_pred_opt, zero_division=0))
    recall    = float(recall_score(y_test, y_pred_opt, zero_division=0))

    print(
        f"  AUC-ROC: {auc_roc:.4f}  F1: {f1:.4f}  "
        f"Precision: {precision:.4f}  Recall: {recall:.4f}  "
        f"Threshold: {best_thr:.3f}"
    )

    # SHAP on a random sample of the test set
    rng = np.random.default_rng(RANDOM_STATE)
    sample_size = min(SHAP_SAMPLE_SIZE, len(X_test))
    idx = rng.choice(len(X_test), size=sample_size, replace=False)
    X_shap = X_test.iloc[idx]

    top5 = get_shap_top5(model, X_shap)
    print(f"  Top-5 SHAP: {[item['feature'] for item in top5]}")

    # Save model
    out_path = MODELS_DIR / f"multidisease_{name}.joblib"
    joblib.dump(model, out_path)
    print(f"  Saved → {out_path.relative_to(ROOT)}")

    return {
        "name":           name,
        "auc_roc":        auc_roc,
        "f1":             f1,
        "precision":      precision,
        "recall":         recall,
        "best_threshold": best_thr,
        "shap_top5":      top5,
        "best_iteration": best_iter,
        "n_features":     len(feature_cols),
    }


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    df = load_data()

    # Compute high-null columns once — reused across all four models
    null_pct       = df.isnull().mean()
    high_null_cols = set(null_pct[null_pct > NULL_THRESHOLD].index.tolist())
    if high_null_cols:
        print(f"\nExcluding {len(high_null_cols)} high-null column(s) (>{NULL_THRESHOLD:.0%}): "
              f"{sorted(high_null_cols)}")

    results   = []
    shap_data = {}

    for target_config in TARGETS:
        result = train_one(df, target_config, high_null_cols)
        results.append(result)
        shap_data[result["name"]] = result["shap_top5"]

    # Save SHAP JSON
    shap_path = MODELS_DIR / "multidisease_shap_top5.json"
    with open(shap_path, "w") as fh:
        json.dump(shap_data, fh, indent=2)
    print(f"\nSHAP summary saved → {shap_path.relative_to(ROOT)}")

    # Save per-condition optimal thresholds
    thresholds = {r["name"]: r["best_threshold"] for r in results}
    thr_path = MODELS_DIR / "multidisease_thresholds.json"
    with open(thr_path, "w") as fh:
        json.dump(thresholds, fh, indent=2)
    print(f"Thresholds saved → {thr_path.relative_to(ROOT)}")

    # Summary table
    col_w = 16
    print("\n")
    print("=== RESULTADOS MULTI-ENFERMEDAD ===")
    print(
        f"  {'Condición':<{col_w}} {'AUC-ROC':>8}  {'F1':>7}  "
        f"{'Precision':>10}  {'Recall':>7}"
    )
    print("  " + "─" * 50)
    for r in results:
        print(
            f"  {r['name']:<{col_w}} {r['auc_roc']:>8.3f}  {r['f1']:>7.3f}  "
            f"{r['precision']:>10.3f}  {r['recall']:>7.3f}"
        )
    print("=" * 36)


if __name__ == "__main__":
    main()
