"""
PASO 8 — Función de Predicción de Alertas de Salud CareBridge
==============================================================
Carga el modelo entrenado y el scaler para hacer predicciones
sobre el perfil de un paciente.

Uso:
    from scripts.predict import predict_health_alert
    resultado = predict_health_alert(perfil_paciente)
"""

import os, pickle, json, warnings
import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

# ── Rutas relativas al archivo ────────────────────────────
_DIR    = os.path.dirname(os.path.abspath(__file__))
_MODELS = os.path.join(_DIR, "..", "models")
_SCRIPTS = _DIR

_MODEL_PATH   = os.path.join(_MODELS, "carebridge_health_alert_model.pkl")
_SCALER_PATH  = os.path.join(_MODELS, "scaler.pkl")
_SCHEMA_PATH  = os.path.join(_SCRIPTS, "patient_profile_schema.json")

# ── Lazy-loading del modelo (se carga solo cuando se necesita) ─
_model_cache  = None
_scaler_cache = None
_schema_cache = None


def _load_model():
    global _model_cache
    if _model_cache is None:
        if not os.path.exists(_MODEL_PATH):
            raise FileNotFoundError(
                f"Modelo no encontrado en {_MODEL_PATH}. "
                "Ejecuta primero: python notebooks/step7_train.py"
            )
        with open(_MODEL_PATH, "rb") as f:
            _model_cache = pickle.load(f)
    return _model_cache


def _load_scaler():
    global _scaler_cache
    if _scaler_cache is None:
        if not os.path.exists(_SCALER_PATH):
            raise FileNotFoundError(f"Scaler no encontrado en {_SCALER_PATH}.")
        with open(_SCALER_PATH, "rb") as f:
            _scaler_cache = pickle.load(f)
    return _scaler_cache


def _load_schema():
    global _schema_cache
    if _schema_cache is None and os.path.exists(_SCHEMA_PATH):
        with open(_SCHEMA_PATH, "r", encoding="utf-8") as f:
            _schema_cache = json.load(f)
    return _schema_cache


# ── Mapeos de encoding (deben coincidir con step3_clean.py) ──
_LABEL_ENCODINGS = {
    "ejercicio_ultimo_mes": {"si": 0, "no": 1},
    "consumo_alcohol":      {"si": 0, "no": 1},
    "frecuencia_tabaco":    {"nunca": 0, "algunos_dias": 1, "todos_los_dias": 2},
    "categoria_imc": {
        "bajo_peso": 0, "normal": 1, "sobrepeso": 2, "obeso": 3,
    },
    "grupo_edad": {
        "18-24": 0, "25-34": 1, "35-44": 2,
        "45-54": 3, "55-64": 4, "65+": 5,
    },
    "sexo":                          {"femenino": 0, "masculino": 1},
    "tiene_diabetes":                {"no": 0, "pre_diabetes": 1, "si": 2, "solo_embarazo": 3},
    "tiene_cardiopatia_coronaria":   {"no": 0, "si": 1},
    "tiene_depresion":               {"no": 0, "si": 1},
    "tiene_cancer_piel":             {"no": 0, "si": 1},
    "tiene_otro_cancer":             {"no": 0, "si": 1},
    "tiene_artritis":                {"no": 0, "si": 1},
    "tiene_asma":                    {"no": 0, "si": 1},
}

# Etiquetas de riesgo para los factores
_FACTOR_LABELS = {
    "dias_mala_salud_fisica":          "Días de mala salud física",
    "dias_mala_salud_mental":          "Días de mala salud mental",
    "altura_cm":                       "Altura",
    "peso_kg":                         "Peso",
    "ejercicio_ultimo_mes_enc":        "Falta de ejercicio",
    "consumo_alcohol_enc":             "Consumo de alcohol",
    "frecuencia_tabaco_enc":           "Consumo de tabaco",
    "categoria_imc_enc":               "Categoría de IMC elevada",
    "grupo_edad_enc":                  "Grupo de edad",
    "sexo_enc":                        "Sexo",
    "tiene_diabetes_enc":              "Diabetes",
    "tiene_cardiopatia_coronaria_enc": "Cardiopatía coronaria",
    "tiene_depresion_enc":             "Depresión",
    "tiene_artritis_enc":              "Artritis",
    "tiene_asma_enc":                  "Asma",
    "tiene_cancer_piel_enc":           "Cáncer de piel",
    "tiene_otro_cancer_enc":           "Otro cáncer",
}

# Condiciones que vigiar según nivel de riesgo y features activos
_CONDITION_ALERTS = {
    "categoria_imc_enc":               ["Diabetes tipo 2", "Enfermedad cardiovascular", "Artritis"],
    "ejercicio_ultimo_mes_enc":        ["Enfermedad cardiovascular", "Diabetes tipo 2"],
    "frecuencia_tabaco_enc":           ["Cáncer de pulmón", "EPOC", "Enfermedad cardiovascular"],
    "consumo_alcohol_enc":             ["Daño hepático", "Hipertensión"],
    "dias_mala_salud_mental":          ["Depresión clínica", "Trastorno de ansiedad"],
    "dias_mala_salud_fisica":          ["Enfermedad crónica no controlada"],
    "tiene_diabetes_enc":              ["Neuropatía diabética", "Enfermedad renal", "Retinopatía"],
    "tiene_cardiopatia_coronaria_enc": ["Infarto al miocardio", "Insuficiencia cardíaca"],
    "tiene_depresion_enc":             ["Trastorno depresivo mayor", "Ansiedad generalizada"],
    "tiene_artritis_enc":              ["Osteoartritis avanzada", "Limitación funcional"],
    "tiene_asma_enc":                  ["Crisis asmática", "Bronquitis crónica"],
    "peso_kg":                         ["Síndrome metabólico", "Apnea del sueño"],
}


def _encode_profile(patient_profile: dict) -> pd.DataFrame:
    """
    Convierte el diccionario del perfil a un vector de features
    con los mismos nombres y encodings usados en entrenamiento.
    """
    encoded = {}

    for key, val in patient_profile.items():
        if key in _LABEL_ENCODINGS:
            enc_val = _LABEL_ENCODINGS[key].get(str(val).lower(), 0)
            encoded[key + "_enc"] = enc_val
        else:
            # Variable numérica directa
            encoded[key] = float(val) if val is not None else 0.0

    return encoded


def predict_health_alert(patient_profile: dict) -> dict:
    """
    Predice el nivel de alerta de salud para un paciente de CareBridge.

    Parameters
    ----------
    patient_profile : dict
        Perfil del paciente con variables definidas en patient_profile_schema.json.
        Ejemplo:
        {
            "dias_mala_salud_fisica":       5,
            "dias_mala_salud_mental":       8,
            "altura_cm":                    165,
            "peso_kg":                      80,
            "ejercicio_ultimo_mes":         "no",
            "consumo_alcohol":              "si",
            "frecuencia_tabaco":            "nunca",
            "categoria_imc":                "sobrepeso",
            "grupo_edad":                   "35-44",
            "sexo":                         "femenino",
            "tiene_diabetes":               "no",
            "tiene_cardiopatia_coronaria":  "no",
            "tiene_depresion":              "si",
            "tiene_cancer_piel":            "no",
            "tiene_otro_cancer":            "no",
            "tiene_artritis":               "no",
            "tiene_asma":                   "no",
        }

    Returns
    -------
    dict con:
        risk_level          : "low" | "medium" | "high"
        risk_score          : float (0–1, probabilidad de alto riesgo)
        risk_probabilities  : {"low": float, "medium": float, "high": float}
        top_risk_factors    : lista de los factores que más contribuyen al riesgo
        conditions_to_watch : lista de condiciones a vigilar
        recommendation      : texto de recomendación personalizada en español
    """
    # ── Cargar modelo y scaler ───────────────────────────────
    model_data  = _load_model()
    scaler_data = _load_scaler()

    model         = model_data["model"]
    feature_names = model_data["feature_names"]
    label_map     = model_data["label_map"]
    scaler        = scaler_data["scaler"]

    # ── Codificar perfil ─────────────────────────────────────
    encoded = _encode_profile(patient_profile)

    # Construir vector de features en el mismo orden que el entrenamiento
    row = {}
    for feat in feature_names:
        row[feat] = encoded.get(feat, 0.0)

    X = pd.DataFrame([row], columns=feature_names)
    X_scaled = pd.DataFrame(scaler.transform(X), columns=feature_names)

    # ── Predicción ───────────────────────────────────────────
    pred_class = int(model.predict(X_scaled)[0])
    pred_proba = model.predict_proba(X_scaled)[0]

    risk_level_es = label_map[pred_class]            # "bajo" | "medio" | "alto"
    risk_level_en = {"bajo": "low", "medio": "medium", "alto": "high"}[risk_level_es]

    # Probabilidad de "alto riesgo"
    risk_score = float(pred_proba[2]) if len(pred_proba) > 2 else float(pred_proba[-1])

    risk_probabilities = {
        "low":    round(float(pred_proba[0]), 4),
        "medium": round(float(pred_proba[1]), 4) if len(pred_proba) > 1 else 0.0,
        "high":   round(float(pred_proba[2]), 4) if len(pred_proba) > 2 else 0.0,
    }

    # ── Top factores de riesgo ───────────────────────────────
    # Usar importancias del modelo para rankear qué features del paciente
    # tienen mayor peso
    if hasattr(model, "feature_importances_"):
        importancias = dict(zip(feature_names, model.feature_importances_))
    else:
        # XGBoost
        importancias = dict(zip(feature_names,
                                model.feature_importances_
                                if hasattr(model, "feature_importances_")
                                else [1.0 / len(feature_names)] * len(feature_names)))

    # Factores presentes en el perfil del paciente, ordenados por importancia
    factores_paciente = {}
    for feat in feature_names:
        val = row.get(feat, 0)
        imp = importancias.get(feat, 0)
        # Consideramos "activo" si es mayor que 0 (categórico) o supera umbral (numérico)
        if val > 0:
            factores_paciente[feat] = imp

    top_risk_factors = [
        _FACTOR_LABELS.get(feat, feat)
        for feat, _ in sorted(factores_paciente.items(),
                               key=lambda x: -x[1])[:5]
    ]

    # ── Condiciones a vigilar ────────────────────────────────
    conditions_set = set()
    for feat in feature_names:
        val = row.get(feat, 0)
        if val > 0 and feat in _CONDITION_ALERTS:
            conditions_set.update(_CONDITION_ALERTS[feat])

    conditions_to_watch = list(conditions_set)[:6]

    # ── Recomendación personalizada ──────────────────────────
    recomendaciones = {
        "low": (
            "Tu perfil de salud es favorable. Mantén tus hábitos saludables: "
            "ejercicio regular, alimentación equilibrada y chequeos anuales."
        ),
        "medium": (
            "Tienes algunos factores de riesgo que conviene atender. "
            "Te recomendamos consultar con tu médico sobre los factores identificados "
            "y considerar cambios en tu estilo de vida."
        ),
        "high": (
            "Tu perfil indica un riesgo elevado de problemas de salud. "
            "Es importante que consultes con un médico pronto. "
            "Presta especial atención a los factores de riesgo identificados."
        ),
    }

    return {
        "risk_level":          risk_level_en,
        "risk_score":          round(risk_score, 4),
        "risk_probabilities":  risk_probabilities,
        "top_risk_factors":    top_risk_factors,
        "conditions_to_watch": conditions_to_watch,
        "recommendation":      recomendaciones[risk_level_en],
    }


# ════════════════════════════════════════════════════════════
# Demo / prueba de la función
# ════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("\n" + "="*60)
    print("PASO 8 — Demo de predict_health_alert()")
    print("="*60)

    # Perfil de prueba: mujer 40 años, sedentaria, sobrepeso, depresión
    perfil_alto_riesgo = {
        "dias_mala_salud_fisica":      12,
        "dias_mala_salud_mental":      15,
        "altura_cm":                   162,
        "peso_kg":                     85,
        "ejercicio_ultimo_mes":        "no",
        "consumo_alcohol":             "si",
        "frecuencia_tabaco":           "algunos_dias",
        "categoria_imc":               "obeso",
        "grupo_edad":                  "35-44",
        "sexo":                        "femenino",
        "tiene_diabetes":              "pre_diabetes",
        "tiene_cardiopatia_coronaria": "no",
        "tiene_depresion":             "si",
        "tiene_cancer_piel":           "no",
        "tiene_otro_cancer":           "no",
        "tiene_artritis":              "si",
        "tiene_asma":                  "no",
    }

    # Perfil de bajo riesgo: hombre joven, activo, peso normal
    perfil_bajo_riesgo = {
        "dias_mala_salud_fisica":      0,
        "dias_mala_salud_mental":      2,
        "altura_cm":                   178,
        "peso_kg":                     72,
        "ejercicio_ultimo_mes":        "si",
        "consumo_alcohol":             "no",
        "frecuencia_tabaco":           "nunca",
        "categoria_imc":               "normal",
        "grupo_edad":                  "25-34",
        "sexo":                        "masculino",
        "tiene_diabetes":              "no",
        "tiene_cardiopatia_coronaria": "no",
        "tiene_depresion":             "no",
        "tiene_cancer_piel":           "no",
        "tiene_otro_cancer":           "no",
        "tiene_artritis":              "no",
        "tiene_asma":                  "no",
    }

    for nombre, perfil in [("Alto Riesgo", perfil_alto_riesgo),
                            ("Bajo Riesgo", perfil_bajo_riesgo)]:
        print(f"\n  Perfil: {nombre}")
        print("  " + "─"*50)
        resultado = predict_health_alert(perfil)
        print(f"  risk_level          : {resultado['risk_level']}")
        print(f"  risk_score          : {resultado['risk_score']:.4f}")
        print(f"  risk_probabilities  : {resultado['risk_probabilities']}")
        print(f"  top_risk_factors    : {resultado['top_risk_factors']}")
        print(f"  conditions_to_watch : {resultado['conditions_to_watch']}")
        print(f"  recommendation      : {resultado['recommendation'][:80]}…")

    print("\nPASO 8 completado ✓")
