"""
Entrenamiento — Alarma de Hipertensión (proxy)
=============================================

Este script entrena un detector de alerta de hipertensión usando BRFSS limpio.

Importante:
- El dataset actual NO incluye diagnóstico explícito de hipertensión.
- Se construye un target proxy binario `alert_hipertension` con reglas clínicas
  de riesgo (edad, IMC, sedentarismo, diabetes y cardiopatía).
"""

import json
import os
import pickle

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    classification_report,
    confusion_matrix,
    precision_recall_curve,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

BASE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(BASE, "..")
PROC = os.path.join(DATA, "processed")
MODELS = os.path.join(DATA, "models")
SCRIPTS = os.path.join(DATA, "scripts")

os.makedirs(MODELS, exist_ok=True)
os.makedirs(SCRIPTS, exist_ok=True)


def build_target_proxy(df: pd.DataFrame) -> pd.Series:
    """Construye target proxy de alerta de hipertensión (0/1)."""
    edad_45_plus = df["grupo_edad"].isin(["45-54", "55-64", "65+"])
    sobrepeso_obesidad = df["categoria_imc"].isin(["sobrepeso", "obeso"])
    sedentario = df["ejercicio_ultimo_mes"] == "no"
    diabetes_riesgo = df["tiene_diabetes"].isin(["si", "pre_diabetes"])
    cardiopatia = df["tiene_cardiopatia_coronaria"] == "si"
    alcohol = df["consumo_alcohol"] == "si"

    risk_score = (
        edad_45_plus.astype(int)
        + sobrepeso_obesidad.astype(int)
        + sedentario.astype(int)
        + diabetes_riesgo.astype(int)
        + cardiopatia.astype(int)
        + alcohol.astype(int)
    )

    # Alerta positiva:
    # - cardiopatía confirmada, o
    # - combinación fuerte de factores (score >= 4)
    target = ((cardiopatia) | (risk_score >= 4)).astype(int)
    return target


def prepare_features(df: pd.DataFrame):
    """Selecciona y escala features para entrenamiento."""
    feature_cols = [
        "altura_cm",
        "peso_kg",
        "sexo_enc",
        "grupo_edad_enc",
        "categoria_imc_enc",
        "ejercicio_ultimo_mes_enc",
        "consumo_alcohol_enc",
        "tiene_diabetes_enc",
        "tiene_cardiopatia_coronaria_enc",
        "tiene_artritis_enc",
        "tiene_asma_enc",
        "tiene_depresion_enc",
        "tiene_cancer_piel_enc",
        "tiene_otro_cancer_enc",
    ]

    missing = [c for c in feature_cols if c not in df.columns]
    if missing:
        raise ValueError(f"Faltan columnas requeridas: {missing}")

    X = df[feature_cols].copy()
    y = build_target_proxy(df)

    scaler = StandardScaler()
    X_scaled = pd.DataFrame(scaler.fit_transform(X), columns=feature_cols)
    return X_scaled, y, scaler, feature_cols


def evaluate_model(name, model, X_test, y_test):
    y_prob = model.predict_proba(X_test)[:, 1]
    y_pred = (y_prob >= 0.5).astype(int)

    metrics = {
        "roc_auc": float(roc_auc_score(y_test, y_prob)),
        "pr_auc": float(average_precision_score(y_test, y_prob)),
        "report": classification_report(y_test, y_pred, output_dict=True),
        "confusion_matrix": confusion_matrix(y_test, y_pred).tolist(),
    }
    return name, metrics, y_prob


def choose_threshold_for_recall(y_true, y_prob, target_recall=0.80):
    precision, recall, thresholds = precision_recall_curve(y_true, y_prob)
    # precision/recall tienen longitud n+1 y thresholds longitud n.
    # Para threshold[i], se asocian precision[i+1], recall[i+1].
    candidates = []
    for i, thr in enumerate(thresholds):
        p_i = precision[i + 1]
        r_i = recall[i + 1]
        if r_i >= target_recall:
            candidates.append((p_i, float(thr)))

    if not candidates:
        return 0.50

    # Elegimos el umbral con mayor precisión manteniendo recall objetivo.
    candidates.sort(key=lambda x: x[0], reverse=True)
    return candidates[0][1]


if __name__ == "__main__":
    print("\n" + "=" * 62)
    print("ALERTA HIPERTENSION (PROXY) — ENTRENAMIENTO")
    print("=" * 62)

    df = pd.read_csv(os.path.join(PROC, "brfss_clean.csv"), low_memory=False)
    X, y, scaler, features = prepare_features(df)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    print(f"Filas totales: {len(X):,}")
    print(f"Train/Test   : {len(X_train):,} / {len(X_test):,}")
    print(f"Prevalencia target proxy (1): {y.mean():.2%}")

    # Baseline interpretable
    lr = LogisticRegression(max_iter=2000, class_weight="balanced", random_state=42)
    lr.fit(X_train, y_train)
    n_lr, m_lr, yprob_lr = evaluate_model("LogisticRegression", lr, X_test, y_test)

    # Modelo no lineal
    rf = RandomForestClassifier(
        n_estimators=400,
        max_depth=14,
        min_samples_leaf=5,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )
    rf.fit(X_train, y_train)
    n_rf, m_rf, yprob_rf = evaluate_model("RandomForest", rf, X_test, y_test)

    results = {n_lr: m_lr, n_rf: m_rf}
    best_name = max(results, key=lambda k: results[k]["pr_auc"])
    best_model = lr if best_name == "LogisticRegression" else rf
    best_prob = yprob_lr if best_name == "LogisticRegression" else yprob_rf
    threshold = choose_threshold_for_recall(y_test, best_prob, target_recall=0.80)

    print(f"\nMejor modelo por PR-AUC: {best_name}")
    print(f"Threshold sugerido (recall>=0.80): {threshold:.4f}")

    model_out = os.path.join(MODELS, "carebridge_hypertension_alert_model.pkl")
    scaler_out = os.path.join(MODELS, "hypertension_scaler.pkl")
    metrics_out = os.path.join(SCRIPTS, "hypertension_model_metrics.json")
    feats_out = os.path.join(SCRIPTS, "hypertension_features_list.json")

    with open(model_out, "wb") as f:
        pickle.dump(
            {
                "model": best_model,
                "model_name": best_name,
                "feature_names": features,
                "target_name": "alert_hipertension_proxy",
                "target_mapping": {0: "sin_alerta", 1: "alerta"},
                "threshold_recall_80": threshold,
                "note": "Target proxy construido por reglas clínicas ante ausencia de etiqueta HTA real.",
            },
            f,
        )

    with open(scaler_out, "wb") as f:
        pickle.dump({"scaler": scaler, "feature_names": features}, f)

    payload = {
        "target_name": "alert_hipertension_proxy",
        "target_prevalence": float(y.mean()),
        "best_model": best_name,
        "recommended_threshold": threshold,
        "models": results,
    }
    with open(metrics_out, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    with open(feats_out, "w", encoding="utf-8") as f:
        json.dump(features, f, ensure_ascii=False, indent=2)

    print(f"Modelo guardado   -> {model_out}")
    print(f"Scaler guardado   -> {scaler_out}")
    print(f"Metricas guardadas-> {metrics_out}")
    print(f"Features guardadas-> {feats_out}")
