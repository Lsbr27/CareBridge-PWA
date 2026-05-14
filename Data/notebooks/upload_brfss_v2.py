"""
Upload BRFSS data to ml_data schema in Supabase.
Uses batch_size=2000 (vs 300 in v1) for ~7x faster uploads.
Full dataset: 387,566 rows × 2 tables.

Usage:
    /Users/lb/miniconda3/bin/python Data/notebooks/upload_brfss_v2.py
"""

import os, math, time
import pandas as pd
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
supabase     = create_client(SUPABASE_URL, SUPABASE_KEY)

PROCESSED  = os.path.join(os.path.dirname(__file__), "..", "processed")
BATCH_SIZE = 2000
SKIP_ROWS  = 0  # change to resume from a specific row on retry

DB_COLS = {
    "brfss_clean": [
        "salud_general","ejercicio_ultimo_mes","consumo_alcohol","categoria_imc",
        "grupo_edad","sexo","altura_cm","peso_kg","tiene_diabetes",
        "tiene_cardiopatia_coronaria","tiene_depresion","tiene_cancer_piel",
        "tiene_otro_cancer","tiene_artritis","tiene_asma","riesgo_salud",
        "riesgo_salud_label","ejercicio_ultimo_mes_enc","consumo_alcohol_enc",
        "categoria_imc_enc","grupo_edad_enc","sexo_enc","tiene_diabetes_enc",
        "tiene_cardiopatia_coronaria_enc","tiene_depresion_enc",
        "tiene_cancer_piel_enc","tiene_otro_cancer_enc","tiene_artritis_enc",
        "tiene_asma_enc",
    ],
    "brfss_features": [
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
    ],
}


def upload(table: str, df: pd.DataFrame, skip: int = 0) -> None:
    cols = DB_COLS[table]
    df   = df[cols].where(pd.notna(df[cols]), None)
    if skip:
        df = df.iloc[skip:]
        print(f"  Reanudando desde fila {skip:,}")

    records = df.to_dict(orient="records")
    total   = len(records)
    batches = math.ceil(total / BATCH_SIZE)
    t0      = time.time()
    print(f"  {total:,} filas → {batches} lotes de {BATCH_SIZE}")

    for i in range(batches):
        chunk = records[i * BATCH_SIZE : (i + 1) * BATCH_SIZE]
        try:
            supabase.schema("ml_data").table(table).insert(chunk).execute()
        except Exception as e:
            global_row = (skip or 0) + i * BATCH_SIZE
            print(f"\n  ERROR lote {i+1}/{batches} (fila ~{global_row:,}): {e}")
            print(f"  Para reanudar: SKIP_ROWS = {global_row}")
            raise

        done = min((i + 1) * BATCH_SIZE, total)
        if (i + 1) % 20 == 0 or done == total:
            elapsed = time.time() - t0
            rate    = done / elapsed
            eta_s   = (total - done) / rate if rate else 0
            print(
                f"    [{i+1}/{batches}]  {done:,}/{total:,} filas"
                f"  |  {rate:.0f} filas/s"
                f"  |  ETA {eta_s/60:.1f} min"
            )

    print(f"  ✓ {table} completado en {(time.time()-t0)/60:.1f} min\n")


# ── Connectivity test ────────────────────────────────────────────
print("=== Test de conectividad (10 filas) ===")
_test = pd.read_csv(os.path.join(PROCESSED, "brfss_clean.csv"), nrows=10)
_test = _test[DB_COLS["brfss_clean"]].where(pd.notna(_test[DB_COLS["brfss_clean"]]), None)
try:
    supabase.schema("ml_data").table("brfss_clean").insert(
        _test.to_dict(orient="records")
    ).execute()
    print("  Conexión OK — 10 filas de prueba insertadas\n")
    _skip_clean = 10   # ya se cargaron estas 10
except Exception as e:
    print(f"  FALLO: {e}")
    raise

# ── BRFSS Clean ─────────────────────────────────────────────────
print("=== BRFSS Clean (387,566 filas, 29 columnas) ===")
df_clean = pd.read_csv(os.path.join(PROCESSED, "brfss_clean.csv"))
print(f"  Leído: {len(df_clean):,} filas")
upload("brfss_clean", df_clean, skip=max(SKIP_ROWS, _skip_clean))

# ── BRFSS Features ──────────────────────────────────────────────
print("=== BRFSS Features (387,566 filas, 35 columnas) ===")
df_feat = pd.read_csv(os.path.join(PROCESSED, "brfss_features_with_risk.csv"))
print(f"  Leído: {len(df_feat):,} filas")
upload("brfss_features", df_feat, skip=SKIP_ROWS)

print("✓ Carga BRFSS completa")
