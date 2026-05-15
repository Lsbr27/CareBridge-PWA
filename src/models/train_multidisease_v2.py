#!/usr/bin/env python3
"""
Model v2 — 7 binary classifiers trained on brfss_features.csv.

Extends v1 (4 conditions on brfss_clean) with:
  - 3 additional conditions: high_bp, high_cholesterol, stroke
  - Richer features: poor_mental_health_days, poor_physical_health_days,
    bmi_computed, ever_smoked_enc, physical_activity_category_enc,
    education_level_enc, income_level_enc
  - F1-optimal threshold per condition

Source: data/processed/brfss_features.csv (387,566 rows, English column names)

Outputs:
  models/v2_multidisease_{condition}.joblib  — one model per condition
  models/v2_multidisease_thresholds.json     — F1-optimal threshold per condition
  models/v2_multidisease_shap_top5.json      — top-5 SHAP features per condition
"""

import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import shap
from sklearn.metrics import (
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier

# ── Paths ──────────────────────────────────────────────────────────────────────

ROOT       = Path(__file__).resolve().parents[2]
DATA_PATH  = ROOT / "data" / "processed" / "brfss_features.csv"
MODELS_DIR = ROOT / "models"
MODELS_DIR.mkdir(exist_ok=True)

SHAP_SAMPLE_SIZE = 2_000
TEST_SIZE        = 0.20
RANDOM_STATE     = 42
NULL_THRESHOLD   = 0.20

# ── Target definitions ─────────────────────────────────────────────────────────
#
# source_col:    binary target column (has_*_bin)
# extra_exclude: the encoded counterpart of the target (has_*_enc) — same info,
#                must be removed to avoid leakage

TARGETS = [
    {
        "name":          "diabetes",
        "source_col":    "has_diabetes_bin",
        "extra_exclude": ["has_diabetes_enc"],
    },
    {
        "name":          "high_bp",
        "source_col":    "has_high_bp_bin",
        "extra_exclude": ["has_high_bp_enc"],
    },
    {
        "name":          "heart_disease",
        "source_col":    "has_heart_disease_bin",
        "extra_exclude": ["has_heart_disease_enc"],
    },
    {
        "name":          "depression",
        "source_col":    "has_depression_bin",
        "extra_exclude": ["has_depression_enc"],
    },
    {
        "name":          "asthma",
        "source_col":    "has_asthma_bin",
        "extra_exclude": ["has_asthma_enc"],
    },
    {
        "name":          "high_cholesterol",
        "source_col":    "has_high_cholesterol_bin",
        "extra_exclude": ["has_high_cholesterol_enc"],
    },
    {
        "name":          "stroke",
        "source_col":    "has_stroke_bin",
        "extra_exclude": ["has_stroke_enc"],
    },
]

# ── Columns always excluded from features ──────────────────────────────────────
# All has_*_bin are direct labels — never use as features.
# Use has_*_enc counterparts (ordinal encodings) as features instead;
# the current target's _enc is removed via extra_exclude.

ALWAYS_EXCLUDE = {
    "has_diabetes_bin",
    "has_high_bp_bin",
    "has_heart_disease_bin",
    "has_depression_bin",
    "has_asthma_bin",
    "has_high_cholesterol_bin",
    "has_stroke_bin",
    # condition_count = sum(has_*_bin) — directly encodes all targets, pure leakage
    "condition_count",
}

# ── XGBoost base parameters ────────────────────────────────────────────────────

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
    return df


# ── Feature selection ──────────────────────────────────────────────────────────

def get_feature_columns(
    df: pd.DataFrame,
    target_config: dict,
    high_null_cols: set,
) -> list[str]:
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

    # Target vector — drop rows where target is null
    y_raw = df[target_config["source_col"]]
    n_null = int(y_raw.isnull().sum())
    if n_null:
        print(f"  WARNING: {n_null:,} null targets — dropping.")
        mask = y_raw.notna()
        df   = df[mask]
        y_raw = y_raw[mask]
    y = y_raw.astype("int8")

    pos = int(y.sum())
    neg = int((y == 0).sum())
    print(f"  Classes — positive: {pos:,} ({pos / len(y):.1%})  negative: {neg:,}")

    feature_cols = get_feature_columns(df, target_config, high_null_cols)
    X = df[feature_cols].copy()
    print(f"  Features ({len(feature_cols)}): {feature_cols}")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, stratify=y, random_state=RANDOM_STATE
    )

    train_pos = int(y_train.sum())
    train_neg = int((y_train == 0).sum())
    spw = train_neg / max(train_pos, 1)
    print(f"  scale_pos_weight: {spw:.3f}")

    model = XGBClassifier(**XGB_BASE_PARAMS, scale_pos_weight=spw)
    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=False,
    )
    best_iter = getattr(model, "best_iteration", XGB_BASE_PARAMS["n_estimators"] - 1) + 1
    print(f"  Best iteration: {best_iter} / {XGB_BASE_PARAMS['n_estimators']}")

    y_prob = model.predict_proba(X_test)[:, 1]

    # F1-optimal threshold
    precisions_pr, recalls_pr, thresholds_pr = precision_recall_curve(y_test, y_prob)
    f1_pr    = 2 * precisions_pr * recalls_pr / (precisions_pr + recalls_pr + 1e-9)
    best_thr = float(thresholds_pr[np.argmax(f1_pr[:-1])])
    y_pred   = (y_prob >= best_thr).astype(int)

    auc_roc   = float(roc_auc_score(y_test, y_prob))
    f1        = float(f1_score(y_test, y_pred, zero_division=0))
    precision = float(precision_score(y_test, y_pred, zero_division=0))
    recall    = float(recall_score(y_test, y_pred, zero_division=0))

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

    out_path = MODELS_DIR / f"v2_multidisease_{name}.joblib"
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
    shap_path = MODELS_DIR / "v2_multidisease_shap_top5.json"
    with open(shap_path, "w") as fh:
        json.dump(shap_data, fh, indent=2)
    print(f"\nSHAP summary saved → {shap_path.relative_to(ROOT)}")

    # Save per-condition optimal thresholds
    thresholds = {r["name"]: r["best_threshold"] for r in results}
    thr_path = MODELS_DIR / "v2_multidisease_thresholds.json"
    with open(thr_path, "w") as fh:
        json.dump(thresholds, fh, indent=2)
    print(f"Thresholds saved → {thr_path.relative_to(ROOT)}")

    # Summary table
    col_w = 18
    print("\n")
    print("=== RESULTADOS MULTI-ENFERMEDAD v2 ===")
    print(
        f"  {'Condición':<{col_w}} {'AUC-ROC':>8}  {'F1':>7}  "
        f"{'Precision':>10}  {'Recall':>7}  {'Threshold':>10}"
    )
    print("  " + "─" * 60)
    for r in results:
        print(
            f"  {r['name']:<{col_w}} {r['auc_roc']:>8.3f}  {r['f1']:>7.3f}  "
            f"{r['precision']:>10.3f}  {r['recall']:>7.3f}  {r['best_threshold']:>10.3f}"
        )
    print("=" * 42)


if __name__ == "__main__":
    main()
