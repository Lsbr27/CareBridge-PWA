"""
Carga brfss_clean y brfss_features al schema ml_data en Supabase.
brfss_features incluye las columnas riesgo_* calculadas por compute_disease_risk.py.

Prerrequisitos:
    pip install supabase python-dotenv pandas

Uso:
    cd /Users/lb/Desktop/CareBridge
    python Data/notebooks/upload_brfss_to_supabase.py

Notas:
  - brfss_clean             → ~387k filas, 29 columnas
  - brfss_features_with_risk → ~387k filas, 35 columnas (incluye riesgo_*)
  - Se sube en lotes de 300 filas para no saturar PostgREST
  - Si se interrumpe, re-correr desde el lote indicado con SKIP_ROWS
"""

import os
import math
import pandas as pd
from dotenv import load_dotenv
import sys
sys.path.insert(0, os.path.dirname(__file__))
from compute_disease_risk import compute

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

try:
    from supabase import create_client
except ImportError:
    raise SystemExit("Instala el cliente: pip install supabase")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

PROCESSED = os.path.join(os.path.dirname(__file__), "..", "processed")
BATCH     = 300   # filas por request
SKIP_ROWS = 0     # cambia este valor para reanudar desde una fila específica


def upload(table: str, df: pd.DataFrame, skip: int = 0) -> None:
    df = df.where(pd.notna(df), None)
    if skip:
        df = df.iloc[skip:]
        print(f"  Reanudando desde fila {skip:,}")

    records = df.to_dict(orient="records")
    total   = len(records)
    batches = math.ceil(total / BATCH)
    print(f"\n  Subiendo ml_data.{table} ({total:,} filas, {batches} lotes)…")

    for i in range(batches):
        chunk = records[i * BATCH : (i + 1) * BATCH]
        try:
            supabase.schema("ml_data").table(table).insert(chunk).execute()
            done = min((i + 1) * BATCH, total)
            if (i + 1) % 50 == 0 or done == total:
                print(f"    Lote {i+1}/{batches}  ({done:,}/{total:,} filas)")
        except Exception as e:
            print(f"\n  ERROR en lote {i+1} (fila ~{(skip or 0) + i * BATCH:,}): {e}")
            print(f"  Para reanudar: cambia SKIP_ROWS = {(skip or 0) + i * BATCH}")
            raise

    print(f"  {table} completado ✓")


# ── BRFSS Clean ───────────────────────────────────────────────
print("=== BRFSS Clean ===")
df_clean = pd.read_csv(os.path.join(PROCESSED, "brfss_clean.csv"))
print(f"  Cargado: {len(df_clean):,} filas")
upload("brfss_clean", df_clean, skip=SKIP_ROWS)

# ── BRFSS Features + riesgo_* ─────────────────────────────────
print("\n=== BRFSS Features (con variables de riesgo) ===")
feat_path = os.path.join(PROCESSED, "brfss_features_with_risk.csv")

if os.path.exists(feat_path):
    print("  Usando archivo pre-calculado brfss_features_with_risk.csv")
    df_feat = pd.read_csv(feat_path)
else:
    print("  Calculando riesgo_* desde brfss_features.csv + brfss_clean.csv…")
    df_feat_raw = pd.read_csv(os.path.join(PROCESSED, "brfss_features.csv"))
    n = min(len(df_feat_raw), len(df_clean))
    df_feat = compute(
        df_feat_raw.iloc[:n].reset_index(drop=True),
        df_clean.iloc[:n].reset_index(drop=True),
    )
    df_feat.to_csv(feat_path, index=False)
    print(f"  Guardado en {feat_path}")

print(f"  Filas: {len(df_feat):,}  |  Columnas: {df_feat.shape[1]}")
upload("brfss_features", df_feat, skip=SKIP_ROWS)

print("\n✓ BRFSS cargado exitosamente en ml_data")
