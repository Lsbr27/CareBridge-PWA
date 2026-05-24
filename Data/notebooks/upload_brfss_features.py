"""
Carga brfss_features_with_risk → ml_data.brfss_features.
Fix: columnas *_bin vienen como float64 con NaN; las convierte a int nullable
antes de insertar (smallint en Postgres rechaza '0.0').
"""

import os, math, time
import pandas as pd
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
supabase = create_client(
    os.environ["NEXT_PUBLIC_SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"],
)

PROCESSED  = os.path.join(os.path.dirname(__file__), "..", "processed")
BATCH_SIZE = 2000
SKIP_ROWS  = 0

DB_COLS = [
    "poor_mental_health_days","poor_physical_health_days","weight_kg",
    "height_cm","bmi_computed","has_diabetes_bin","has_high_bp_bin",
    "has_heart_disease_bin","has_depression_bin","has_asthma_bin",
    "has_high_cholesterol_bin","has_stroke_bin","condition_count",
    "age_group_enc","bmi_category_enc","general_health_enc","exercises_enc",
    "drinks_alcohol_enc","ever_smoked_enc","physical_activity_category_enc",
    "education_level_enc","income_level_enc","has_diabetes_enc",
    "has_high_bp_enc","has_heart_disease_enc","has_depression_enc",
    "has_asthma_enc","has_high_cholesterol_enc","has_stroke_enc",
    "riesgo_diabetes","riesgo_hipertension","riesgo_cardiopatia",
    "riesgo_depresion","riesgo_asma","riesgo_colesterol",
]

# Estas columnas son smallint pero pandas las lee como float64 (tienen NaN)
FLOAT_TO_INT = [
    "has_diabetes_bin","has_high_bp_bin","has_heart_disease_bin",
    "has_depression_bin","has_asthma_bin","has_high_cholesterol_bin",
    "has_stroke_bin",
]

print("Leyendo brfss_features_with_risk.csv…")
df = pd.read_csv(os.path.join(PROCESSED, "brfss_features_with_risk.csv"))
df = df[DB_COLS]

# Convertir float→int (None para NaN) en columnas smallint
for col in FLOAT_TO_INT:
    df[col] = df[col].apply(lambda x: None if pd.isna(x) else int(x))

# NaN → None en el resto
df = df.where(pd.notna(df), None)

if SKIP_ROWS:
    df = df.iloc[SKIP_ROWS:]
    print(f"Reanudando desde fila {SKIP_ROWS:,}")

records = df.to_dict(orient="records")
total   = len(records)
batches = math.ceil(total / BATCH_SIZE)
t0      = time.time()
print(f"{total:,} filas → {batches} lotes de {BATCH_SIZE}\n")

for i in range(batches):
    chunk = records[i * BATCH_SIZE : (i + 1) * BATCH_SIZE]
    try:
        supabase.schema("ml_data").table("brfss_features").insert(chunk).execute()
    except Exception as e:
        row = (SKIP_ROWS or 0) + i * BATCH_SIZE
        print(f"\nERROR lote {i+1}/{batches} (fila ~{row:,}): {e}")
        print(f"Para reanudar: SKIP_ROWS = {row}")
        raise

    done = min((i + 1) * BATCH_SIZE, total)
    if (i + 1) % 20 == 0 or done == total:
        elapsed = time.time() - t0
        rate    = done / elapsed
        eta_s   = (total - done) / rate if rate else 0
        print(
            f"  [{i+1}/{batches}]  {done:,}/{total:,} filas"
            f"  |  {rate:.0f} filas/s"
            f"  |  ETA {eta_s/60:.1f} min"
        )

print(f"\n✓ brfss_features completado en {(time.time()-t0)/60:.1f} min")
