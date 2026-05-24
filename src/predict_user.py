#!/usr/bin/env python3
"""
Reads JSON from stdin:
  { "profile": {...}, "health_profile": {...}, "daily_logs": [...] }

Writes JSON to stdout:
  {
    "conditions": {
      "diabetes": { "probability": 0.23, "flag": false, "threshold": 0.65 },
      ...
    },
    "health_score": { "label": "medio", "class": 1, "probabilities": {...} }
  }
"""

import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
MODELS_DIR = ROOT / "models"

sys.path.insert(0, str(ROOT / "src" / "lib"))
from feature_mapper import map_to_model_features  # noqa: E402

CONDITIONS = [
    "diabetes", "high_bp", "heart_disease", "depression",
    "asthma", "high_cholesterol", "stroke",
]

HEALTH_LABELS = {0: "bajo", 1: "medio", 2: "alto"}


def _load_all():
    thresholds = json.loads((MODELS_DIR / "v2_multidisease_thresholds.json").read_text())

    models = {}
    for cond in CONDITIONS:
        p = MODELS_DIR / f"v2_multidisease_{cond}.joblib"
        if p.exists():
            models[cond] = joblib.load(p)

    hs_path = MODELS_DIR / "health_score_v2.joblib"
    health_model = joblib.load(hs_path) if hs_path.exists() else None

    return models, thresholds, health_model


def _make_row(features: dict, feature_names: list) -> pd.DataFrame:
    row = {col: features.get(col, 0) for col in feature_names}
    return pd.DataFrame([row])


def predict(payload: dict) -> dict:
    profile = payload.get("profile") or {}
    health_profile = payload.get("health_profile") or {}
    daily_logs = payload.get("daily_logs") or []

    features = map_to_model_features(profile, health_profile, daily_logs)
    models, thresholds, health_model = _load_all()

    conditions_out = {}
    for cond, model in models.items():
        names = model.get_booster().feature_names
        X = _make_row(features, names)
        prob = float(model.predict_proba(X)[0, 1])
        threshold = thresholds.get(cond, 0.5)
        conditions_out[cond] = {
            "probability": round(prob, 4),
            "flag": bool(prob >= threshold),
            "threshold": round(threshold, 4),
        }

    health_out = {}
    if health_model:
        names_hs = health_model.get_booster().feature_names
        X_hs = _make_row(features, names_hs)
        probs = health_model.predict_proba(X_hs)[0]
        pred_class = int(np.argmax(probs))
        health_out = {
            "label": HEALTH_LABELS[pred_class],
            "class": pred_class,
            "probabilities": {HEALTH_LABELS[i]: round(float(p), 4) for i, p in enumerate(probs)},
        }

    return {"conditions": conditions_out, "health_score": health_out}


if __name__ == "__main__":
    payload = json.load(sys.stdin)
    result = predict(payload)
    json.dump(result, sys.stdout)
