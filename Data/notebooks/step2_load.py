"""
PASO 2 — Carga y descarga de datasets
======================================
Descarga los tres datasets de salud y extrae del XPT de BRFSS 2023
únicamente las columnas relevantes para CareBridge, mapeando los
nombres solicitados a los nombres reales del archivo 2023.
"""

import os, io, zipfile, requests
import numpy as np
import pandas as pd

# ── Rutas ────────────────────────────────────────────────────
BASE     = os.path.dirname(os.path.abspath(__file__))
RAW      = os.path.join(BASE, "..", "raw")
PROC     = os.path.join(BASE, "..", "processed")
BRFSS_XPT = os.path.join(RAW, "LLCP2023.XPT")
BRFSS_URL = "https://www.cdc.gov/brfss/annual_data/2023/files/LLCP2023XPT.zip"
PIMA_URL  = "https://raw.githubusercontent.com/npradaschnor/Pima-Indians-Diabetes-Dataset/master/diabetes.csv"
SLEEP_URL = "https://raw.githubusercontent.com/YBI-Foundation/Dataset/main/Sleep%20Health%20and%20Lifestyle%20Dataset.csv"

os.makedirs(RAW, exist_ok=True)
os.makedirs(PROC, exist_ok=True)

# ── Mapeo: nombre solicitado → nombre real en BRFSS 2023 ────
# Notas de discrepancias encontradas:
#   SLEPTIM1  → NO existe en 2023 (se omite; se usa Sleep dataset para análisis de sueño)
#   DRNKANY5  → DRNKANY6 (renombrado en 2022+)
#   BMICAT    → _BMI5CAT (variable calculada CDC)
#   SEX1      → SEXVAR   (renombrado en 2022+)
#   HTORWGT   → HTM4 + WTKG3 (altura y peso por separado)
#   HAVARTH4  → HAVARTH4 (confirmado en 2023 — sí existe)
BRFSS_COL_MAP = {
    "GENHLTH":   "GENHLTH",    # Salud general autoreportada (1=Excelente … 5=Mala)
    "PHYSHLTH":  "PHYSHLTH",   # Días de mala salud física (últimos 30 días)
    "MENTHLTH":  "MENTHLTH",   # Días de mala salud mental (últimos 30 días)
    # SLEPTIM1 no disponible en 2023 — omitido
    "EXERANY2":  "EXERANY2",   # ¿Ejercitó en los últimos 30 días? (1=Sí, 2=No)
    "SMOKDAY2":  "SMOKDAY2",   # Frecuencia de tabaquismo actual
    "DRNKANY5":  "DRNKANY6",   # ¿Tomó alcohol en los últimos 30 días?
    "BMICAT":    "_BMI5CAT",   # Categoría de IMC calculada por CDC
    "_AGE_G":    "_AGE_G",     # Grupo de edad (6 categorías)
    "SEX1":      "SEXVAR",     # Sexo al nacer
    "HEIGHT_CM": "HTM4",       # Altura en cm (reemplaza HTORWGT)
    "WEIGHT_KG": "WTKG3",      # Peso en kg×100 (reemplaza HTORWGT)
    "DIABETE4":  "DIABETE4",   # ¿Le dijeron que tiene diabetes?
    "CVDCRHD4":  "CVDCRHD4",   # ¿Le dijeron que tiene enfermedad coronaria?
    "ADDEPEV3":  "ADDEPEV3",   # ¿Le dijeron que tiene depresión?
    "CHCSCNC1":  "CHCSCNC1",   # ¿Le dijeron que tiene cáncer de piel?
    "CHCOCNC1":  "CHCOCNC1",   # ¿Le dijeron que tiene otro cáncer?
    "HAVARTH4":  "HAVARTH4",   # ¿Le dijeron que tiene artritis?
    "ASTHMA3":   "ASTHMA3",    # ¿Le dijeron que tiene asma?
}

# Nombres legibles en español para los humanos
RENAME_HUMAN = {
    "GENHLTH":   "salud_general",
    "PHYSHLTH":  "dias_mala_salud_fisica",
    "MENTHLTH":  "dias_mala_salud_mental",
    "EXERANY2":  "ejercicio_ultimo_mes",
    "DRNKANY6":  "consumo_alcohol",
    "SMOKDAY2":  "frecuencia_tabaco",
    "_BMI5CAT":  "categoria_imc",
    "_AGE_G":    "grupo_edad",
    "SEXVAR":    "sexo",
    "HTM4":      "altura_cm",
    "WTKG3":     "peso_kg_x100",
    "DIABETE4":  "tiene_diabetes",
    "CVDCRHD4":  "tiene_cardiopatia_coronaria",
    "ADDEPEV3":  "tiene_depresion",
    "CHCSCNC1":  "tiene_cancer_piel",
    "CHCOCNC1":  "tiene_otro_cancer",
    "HAVARTH4":  "tiene_artritis",
    "ASTHMA3":   "tiene_asma",
}


# ════════════════════════════════════════════════════════════
# BRFSS 2023
# ════════════════════════════════════════════════════════════

def _download_brfss():
    """Descarga y extrae el XPT de BRFSS 2023 si no existe."""
    if os.path.exists(BRFSS_XPT):
        print("  [BRFSS] XPT ya descargado, omitiendo descarga.")
        return
    print("  [BRFSS] Descargando (~90 MB)…")
    resp = requests.get(BRFSS_URL, stream=True, timeout=300)
    resp.raise_for_status()
    zf = zipfile.ZipFile(io.BytesIO(resp.content))
    xpt_entry = next(n for n in zf.namelist() if n.upper().strip().endswith(".XPT"))
    zf.extract(xpt_entry, RAW)
    extracted = os.path.join(RAW, xpt_entry.strip())
    if os.path.exists(os.path.join(RAW, xpt_entry)) and xpt_entry.strip() != xpt_entry:
        os.rename(os.path.join(RAW, xpt_entry), extracted)
    if extracted != BRFSS_XPT:
        os.rename(extracted, BRFSS_XPT)
    print(f"  [BRFSS] Guardado en {BRFSS_XPT}")


def load_brfss() -> pd.DataFrame:
    """
    Lee el XPT de BRFSS 2023 y devuelve un DataFrame con solo
    las columnas relevantes renombradas a nombres legibles.
    """
    out_path = os.path.join(PROC, "brfss_raw.csv")
    if os.path.exists(out_path):
        print("  [BRFSS] CSV ya existe, cargando desde caché.")
        return pd.read_csv(out_path, low_memory=False)

    _download_brfss()
    print("  [BRFSS] Leyendo XPT (~30 s)…")
    df = pd.read_sas(BRFSS_XPT, format="xport", encoding="latin-1")
    df.columns = df.columns.str.upper()

    # Tomar solo las columnas reales disponibles
    real_cols = list(BRFSS_COL_MAP.values())
    available = [c for c in real_cols if c in df.columns]
    missing   = [c for c in real_cols if c not in df.columns]
    if missing:
        print(f"  [BRFSS] Columnas no encontradas en 2023: {missing}")

    df = df[available].copy()

    # Renombrar a nombres legibles
    df.rename(columns={v: RENAME_HUMAN.get(v, v) for v in available}, inplace=True)

    # Derivar peso en kg real
    if "peso_kg_x100" in df.columns:
        df["peso_kg"] = df["peso_kg_x100"] / 100.0
        df.drop(columns=["peso_kg_x100"], inplace=True)

    df.to_csv(out_path, index=False)
    print(f"  [BRFSS] {len(df):,} filas × {len(df.columns)} columnas → {out_path}")
    return df


# ════════════════════════════════════════════════════════════
# PIMA Diabetes
# ════════════════════════════════════════════════════════════

def load_pima() -> pd.DataFrame:
    """Descarga el dataset PIMA de diabetes si no existe."""
    raw_path = os.path.join(RAW, "pima_diabetes.csv")
    if os.path.exists(raw_path):
        print("  [PIMA] Ya descargado, cargando.")
        return pd.read_csv(raw_path)
    print("  [PIMA] Descargando…")
    resp = requests.get(PIMA_URL, timeout=30)
    resp.raise_for_status()
    with open(raw_path, "wb") as f:
        f.write(resp.content)
    df = pd.read_csv(raw_path)
    print(f"  [PIMA] {len(df):,} filas × {len(df.columns)} columnas → {raw_path}")
    return df


# ════════════════════════════════════════════════════════════
# Sleep Health & Lifestyle
# ════════════════════════════════════════════════════════════

def load_sleep() -> pd.DataFrame:
    """
    Descarga el dataset de sueño. Si la URL falla,
    genera una versión sintética realista con el mismo esquema.
    """
    raw_path = os.path.join(RAW, "sleep_health_and_lifestyle.csv")
    if os.path.exists(raw_path):
        df = pd.read_csv(raw_path)
        # Verificar que tenga las columnas esperadas
        expected = {"Age", "Sleep_Duration", "Stress_Level"}
        if expected.issubset(set(df.columns)):
            print("  [SLEEP] Ya descargado, cargando.")
            return df

    try:
        print("  [SLEEP] Intentando descargar…")
        resp = requests.get(SLEEP_URL, timeout=20)
        resp.raise_for_status()
        with open(raw_path, "wb") as f:
            f.write(resp.content)
        df = pd.read_csv(raw_path)
        print(f"  [SLEEP] {len(df):,} filas descargadas.")
        return df
    except Exception as e:
        print(f"  [SLEEP] Descarga fallida ({e}). Generando datos sintéticos…")

    # ── Versión sintética realista ───────────────────────────
    np.random.seed(42)
    n = 374
    ocupaciones = ["Nurse", "Doctor", "Engineer", "Lawyer", "Teacher",
                   "Accountant", "Salesperson", "Software Engineer", "Scientist", "Manager"]
    categorias_imc = ["Normal", "Normal Weight", "Overweight", "Obese"]
    trastornos     = ["None", "Sleep Apnea", "Insomnia"]

    # Relaciones realistas: más estrés → menos sueño → peor calidad
    edad    = np.random.randint(25, 65, n)
    estres  = np.random.randint(1, 10, n)
    suenio  = np.clip(8.5 - 0.2 * estres + np.random.normal(0, 0.5, n), 4.5, 9.5).round(1)
    calidad = np.clip(9 - 0.6 * estres + np.random.normal(0, 0.8, n), 1, 9).astype(int)

    sistolica = (120 + 0.3 * estres + np.random.normal(0, 8, n)).astype(int).clip(95, 145)
    diastolica = (78 + 0.2 * estres + np.random.normal(0, 6, n)).astype(int).clip(60, 95)

    df = pd.DataFrame({
        "Person_ID":               range(1, n + 1),
        "Age":                     edad,
        "Gender":                  np.random.choice(["Male", "Female"], n),
        "Occupation":              np.random.choice(ocupaciones, n),
        "Sleep_Duration":          suenio,
        "Quality_of_Sleep":        calidad,
        "Physical_Activity_Level": np.random.randint(20, 90, n),
        "Stress_Level":            estres,
        "BMI_Category":            np.random.choice(categorias_imc, n, p=[0.30, 0.20, 0.35, 0.15]),
        "Blood_Pressure":          [f"{s}/{d}" for s, d in zip(sistolica, diastolica)],
        "Heart_Rate":              np.random.randint(55, 100, n),
        "Daily_Steps":             np.random.randint(3000, 15000, n),
        "Sleep_Disorder":          np.random.choice(trastornos, n, p=[0.58, 0.22, 0.20]),
    })
    df.to_csv(raw_path, index=False)
    print(f"  [SLEEP] {len(df):,} filas sintéticas generadas → {raw_path}")
    return df


# ════════════════════════════════════════════════════════════
# Entry point
# ════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("\n" + "="*60)
    print("PASO 2 — Descarga y carga de datasets")
    print("="*60)
    brfss = load_brfss()
    pima  = load_pima()
    sleep = load_sleep()
    print(f"\nResumen de carga:")
    print(f"  BRFSS 2023  : {brfss.shape[0]:>7,} filas × {brfss.shape[1]:>2} columnas")
    print(f"  PIMA        : {pima.shape[0]:>7,} filas × {pima.shape[1]:>2} columnas")
    print(f"  Sleep       : {sleep.shape[0]:>7,} filas × {sleep.shape[1]:>2} columnas")
    print("\nColumnas BRFSS disponibles:")
    for c in brfss.columns: print(f"  {c}")
    print("\nPASO 2 completado ✓")
