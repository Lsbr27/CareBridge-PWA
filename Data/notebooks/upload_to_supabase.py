"""
Carga los datasets procesados de ML al schema ml_data en Supabase.

Prerrequisitos:
    pip install supabase python-dotenv pandas

Uso:
    cd /Users/lb/Desktop/CareBridge
    python Data/notebooks/upload_to_supabase.py
"""

import os
import math
import pandas as pd
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

try:
    from supabase import create_client
except ImportError:
    raise SystemExit("Instala el cliente: pip install supabase")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

PROCESSED = os.path.join(os.path.dirname(__file__), "..", "processed")
BATCH = 400  # filas por request (PostgREST acepta hasta ~500)


def upload(table: str, df: pd.DataFrame) -> None:
    # Convierte NaN → None para JSON-serialización correcta
    df = df.where(pd.notna(df), None)
    records = df.to_dict(orient="records")
    total = len(records)
    batches = math.ceil(total / BATCH)
    print(f"\n  Subiendo ml_data.{table} ({total} filas, {batches} lotes)…")
    for i in range(batches):
        chunk = records[i * BATCH : (i + 1) * BATCH]
        supabase.schema("ml_data").table(table).insert(chunk).execute()
        print(f"    Lote {i + 1}/{batches} ✓  ({min((i+1)*BATCH, total)}/{total} filas)")
    print(f"  {table} completado ✓")


# ── PIMA Diabetes ─────────────────────────────────────────────
pima = pd.read_csv(os.path.join(PROCESSED, "pima_clean.csv"))
pima = pima.rename(columns={
    "Pregnancies":               "pregnancies",
    "Glucose":                   "glucose",
    "BloodPressure":             "blood_pressure",
    "SkinThickness":             "skin_thickness",
    "Insulin":                   "insulin",
    "BMI":                       "bmi",
    "DiabetesPedigreeFunction":  "diabetes_pedigree_function",
    "Age":                       "age",
    "tiene_diabetes":            "has_diabetes",
})
pima.drop(columns=["BMI_Category"], errors="ignore", inplace=True)
upload("pima_diabetes", pima)

# ── Sleep Health ──────────────────────────────────────────────
sleep = pd.read_csv(os.path.join(PROCESSED, "sleep_clean.csv"))
sleep = sleep.rename(columns={
    "Person_ID":               "person_id",
    "Age":                     "age",
    "Gender":                  "gender",
    "Occupation":              "occupation",
    "Sleep_Duration":          "sleep_duration",
    "Quality_of_Sleep":        "quality_of_sleep",
    "Physical_Activity_Level": "physical_activity_level",
    "Stress_Level":            "stress_level",
    "BMI_Category":            "bmi_category",
    "Heart_Rate":              "heart_rate",
    "Daily_Steps":             "daily_steps",
    "Sleep_Disorder":          "sleep_disorder",
    "presion_sistolica":       "systolic_bp",
    "presion_diastolica":      "diastolic_bp",
    "Gender_enc":              "gender_enc",
    "Occupation_enc":          "occupation_enc",
    "BMI_Category_enc":        "bmi_category_enc",
    "Sleep_Disorder_enc":      "sleep_disorder_enc",
    "riesgo_suenio":           "sleep_risk",
    "estres_alto":             "high_stress",
    "hipertension_proxy":      "hypertension_proxy",
})
# Eliminar columnas one-hot generadas en limpieza si existen
drop_cols = [c for c in sleep.columns if c.startswith("disorder_")]
sleep.drop(columns=drop_cols, errors="ignore", inplace=True)
upload("sleep_health", sleep)

# ── Unified Features ──────────────────────────────────────────
unified = pd.read_csv(os.path.join(PROCESSED, "unified_features.csv"))
upload("unified_features", unified)

print("\nTodos los datasets cargados exitosamente ✓")
