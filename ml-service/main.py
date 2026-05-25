"""
CareBridge ML microservice — FastAPI wrapper around the XGBoost risk models.

POST /predict   { "userId": "<uuid>" }  → risk probabilities for 7 conditions + health score
GET  /health    → {"status": "ok", "models_loaded": 8}

Security: requires X-Api-Key header matching ML_SERVICE_API_KEY env var.
Models are loaded once at startup into module-level globals.
"""

import json
import os
import secrets
from contextlib import asynccontextmanager
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel
from supabase import Client, create_client

from feature_mapper import map_to_model_features

MODELS_DIR = Path(__file__).parent / "models"

CONDITIONS = [
    "diabetes", "high_bp", "heart_disease", "depression",
    "asthma", "high_cholesterol", "stroke",
]
HEALTH_LABELS = {0: "bajo", 1: "medio", 2: "alto"}

# Loaded once at startup
_models: dict = {}
_thresholds: dict = {}
_health_model = None
_sb: Client | None = None


def _load_models() -> None:
    global _models, _thresholds, _health_model
    _thresholds = json.loads((MODELS_DIR / "v2_multidisease_thresholds.json").read_text())
    for cond in CONDITIONS:
        p = MODELS_DIR / f"v2_multidisease_{cond}.joblib"
        if p.exists():
            _models[cond] = joblib.load(p)
    hs_path = MODELS_DIR / "health_score_v2.joblib"
    if hs_path.exists():
        _health_model = joblib.load(hs_path)


@asynccontextmanager
async def lifespan(app: FastAPI):
    _load_models()
    global _sb
    _sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    yield


app = FastAPI(lifespan=lifespan)

_API_KEY = os.environ.get("ML_SERVICE_API_KEY", "")


def _verify_key(x_api_key: str = Header(default=None)):
    if _API_KEY and not secrets.compare_digest(x_api_key or "", _API_KEY):
        raise HTTPException(status_code=403, detail="Invalid API key")


class PredictRequest(BaseModel):
    userId: str


@app.get("/health")
def health():
    return {"status": "ok", "models_loaded": len(_models)}


@app.post("/predict", dependencies=[Depends(_verify_key)])
def predict(req: PredictRequest):
    sb = _sb
    if sb is None:
        raise HTTPException(status_code=503, detail="Supabase not initialised")

    profile_res = sb.table("profiles").select(
        "date_of_birth, gender, diagnosis"
    ).eq("id", req.userId).maybe_single().execute()

    health_res = sb.table("health_profile").select(
        "physical_activity_frequency, mood_general, sleep_hours, weight_kg, height_cm"
    ).eq("profile_id", req.userId).maybe_single().execute()

    logs_res = sb.table("daily_logs").select("mood, pain").eq(
        "profile_id", req.userId
    ).order("date", desc=True).limit(30).execute()

    features = map_to_model_features(
        profile_res.data or {},
        health_res.data or {},
        logs_res.data or [],
    )

    conditions_out: dict = {}
    for cond, model in _models.items():
        names = model.get_booster().feature_names
        X = pd.DataFrame([{col: features.get(col, 0) for col in names}])
        prob = float(model.predict_proba(X)[0, 1])
        threshold = _thresholds.get(cond, 0.5)
        conditions_out[cond] = {
            "probability": round(prob, 4),
            "flag": bool(prob >= threshold),
            "threshold": round(threshold, 4),
        }

    health_out: dict = {}
    if _health_model is not None:
        names_hs = _health_model.get_booster().feature_names
        X_hs = pd.DataFrame([{col: features.get(col, 0) for col in names_hs}])
        probs = _health_model.predict_proba(X_hs)[0]
        pred_class = int(np.argmax(probs))
        health_out = {
            "label": HEALTH_LABELS[pred_class],
            "class": pred_class,
            "probabilities": {HEALTH_LABELS[i]: round(float(p), 4) for i, p in enumerate(probs)},
        }

    return {"conditions": conditions_out, "health_score": health_out}
