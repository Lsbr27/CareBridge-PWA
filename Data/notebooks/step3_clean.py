"""
PASO 3 — Limpieza de datasets
==============================
Para cada dataset:
  - Maneja valores faltantes (imputa o elimina según % missing)
  - Elimina duplicados
  - Codifica variables categóricas
  - Normaliza/escala características numéricas
  - Documenta filas conservadas vs eliminadas
"""

import os
import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder, StandardScaler

BASE = os.path.dirname(os.path.abspath(__file__))
PROC = os.path.join(BASE, "..", "processed")


# ════════════════════════════════════════════════════════════
# BRFSS 2023
# ════════════════════════════════════════════════════════════

# Valores sentinel de BRFSS que significan "no sabe" o "rechazó responder"
BRFSS_SENTINEL = {
    "salud_general":              [7, 9],
    "dias_mala_salud_fisica":     [77, 88, 99],
    "dias_mala_salud_mental":     [77, 88, 99],
    "ejercicio_ultimo_mes":       [7, 9],
    "consumo_alcohol":            [7, 9],
    "frecuencia_tabaco":          [7, 9],
    "categoria_imc":              [9],
    "grupo_edad":                 [14],
    "sexo":                       [7, 9],
    "tiene_diabetes":             [7, 9],
    "tiene_cardiopatia_coronaria":[7, 9],
    "tiene_depresion":            [7, 9],
    "tiene_cancer_piel":          [7, 9],
    "tiene_otro_cancer":          [7, 9],
    "tiene_artritis":             [7, 9],
    "tiene_asma":                 [7, 9],
}

# Etiquetas para variables categóricas de BRFSS
BRFSS_LABELS = {
    "salud_general": {
        1: "excelente", 2: "muy_buena", 3: "buena", 4: "regular", 5: "mala",
    },
    "ejercicio_ultimo_mes": {1: "si", 2: "no"},
    "consumo_alcohol":      {1: "si", 2: "no"},
    "frecuencia_tabaco":    {1: "todos_los_dias", 2: "algunos_dias", 3: "nunca"},
    "categoria_imc": {
        1: "bajo_peso", 2: "normal", 3: "sobrepeso", 4: "obeso",
    },
    "grupo_edad": {
        1: "18-24", 2: "25-34", 3: "35-44",
        4: "45-54", 5: "55-64", 6: "65+",
    },
    "sexo":                       {1: "masculino", 2: "femenino"},
    "tiene_diabetes":             {1: "si", 2: "no", 3: "pre_diabetes", 4: "solo_embarazo"},
    "tiene_cardiopatia_coronaria":{1: "si", 2: "no"},
    "tiene_depresion":            {1: "si", 2: "no"},
    "tiene_cancer_piel":          {1: "si", 2: "no"},
    "tiene_otro_cancer":          {1: "si", 2: "no"},
    "tiene_artritis":             {1: "si", 2: "no"},
    "tiene_asma":                 {1: "si", 2: "no"},
}


def clean_brfss(df: pd.DataFrame) -> pd.DataFrame:
    """Limpia BRFSS 2023 y devuelve DataFrame limpio con codificaciones."""
    print("\n  [BRFSS] Limpiando…")
    df = df.copy()
    filas_inicio = len(df)

    # 1. Eliminar duplicados exactos
    dups = df.duplicated().sum()
    df.drop_duplicates(inplace=True)
    print(f"  [BRFSS] Duplicados eliminados: {dups:,}")

    # 2. Reemplazar valores sentinel con NaN
    for col, sentinels in BRFSS_SENTINEL.items():
        if col in df.columns:
            df[col] = df[col].replace(sentinels, np.nan)

    # 3. Documentar missing antes de imputación
    missing_pct = df.isnull().mean().sort_values(ascending=False)
    print("  [BRFSS] % missing por columna (>5%):")
    altos = missing_pct[missing_pct > 0.05]
    for col, pct in altos.items():
        print(f"    {col:<40} {pct:.1%}")

    # 4. Eliminar filas donde salud_general es NaN (variable objetivo)
    if "salud_general" in df.columns:
        antes = len(df)
        df.dropna(subset=["salud_general"], inplace=True)
        print(f"  [BRFSS] Filas sin salud_general eliminadas: {antes - len(df):,}")

    # 5. Columnas con >40% missing → eliminar la columna
    drop_cols = missing_pct[missing_pct > 0.40].index.tolist()
    if drop_cols:
        print(f"  [BRFSS] Columnas con >40% missing eliminadas: {drop_cols}")
        df.drop(columns=[c for c in drop_cols if c in df.columns], inplace=True)

    # 6. Aplicar etiquetas a variables categóricas
    for col, labels in BRFSS_LABELS.items():
        if col in df.columns:
            df[col] = df[col].map(labels)

    # 7. Imputar numéricos con mediana
    num_cols = df.select_dtypes(include=np.number).columns
    for col in num_cols:
        if df[col].isnull().sum() > 0:
            mediana = df[col].median()
            df[col].fillna(mediana, inplace=True)

    # 8. Imputar categóricos con moda
    cat_cols = df.select_dtypes(exclude=np.number).columns
    for col in cat_cols:
        if col == "salud_general":
            continue
        if df[col].isnull().sum() > 0:
            moda = df[col].mode()[0]
            df[col].fillna(moda, inplace=True)

    # 9. Crear variable objetivo triclase: riesgo_salud
    #    Excelente/Muy Buena → 0 (bajo), Buena → 1 (medio), Regular/Mala → 2 (alto)
    if "salud_general" in df.columns:
        mapa_riesgo = {
            "excelente": 0, "muy_buena": 0,
            "buena": 1,
            "regular": 2, "mala": 2,
        }
        df["riesgo_salud"] = df["salud_general"].map(mapa_riesgo)
        df["riesgo_salud_label"] = df["riesgo_salud"].map({0: "bajo", 1: "medio", 2: "alto"})

    # 10. Codificar variables categóricas con LabelEncoder para el modelo
    le = LabelEncoder()
    cat_features = [c for c in df.select_dtypes(exclude=np.number).columns
                    if c not in ["salud_general", "riesgo_salud_label"]]
    for col in cat_features:
        df[col + "_enc"] = le.fit_transform(df[col].astype(str))

    # 11. Derivar peso real en kg
    if "peso_kg" in df.columns:
        df["peso_kg"] = df["peso_kg"].clip(20, 300)
    if "altura_cm" in df.columns:
        df["altura_cm"] = df["altura_cm"].clip(100, 250)

    filas_fin = len(df)
    print(f"  [BRFSS] Filas inicio: {filas_inicio:,} → Filas finales: {filas_fin:,} "
          f"(conservadas: {filas_fin/filas_inicio:.1%})")

    out = os.path.join(PROC, "brfss_clean.csv")
    df.to_csv(out, index=False)
    print(f"  [BRFSS] Guardado → {out}")
    return df


# ════════════════════════════════════════════════════════════
# PIMA Diabetes
# ════════════════════════════════════════════════════════════

PIMA_ZERO_INVALID = ["Glucose", "BloodPressure", "SkinThickness", "Insulin", "BMI"]


def clean_pima(df: pd.DataFrame) -> pd.DataFrame:
    """Limpia el dataset PIMA de diabetes."""
    print("\n  [PIMA] Limpiando…")
    df = df.copy()
    filas_inicio = len(df)

    # 1. Eliminar duplicados
    dups = df.duplicated().sum()
    df.drop_duplicates(inplace=True)
    print(f"  [PIMA] Duplicados eliminados: {dups}")

    # 2. Reemplazar 0s imposibles con NaN
    ceros_total = (df[PIMA_ZERO_INVALID] == 0).sum().sum()
    df[PIMA_ZERO_INVALID] = df[PIMA_ZERO_INVALID].replace(0, np.nan)
    print(f"  [PIMA] Ceros imposibles reemplazados con NaN: {ceros_total}")

    # 3. Imputar con mediana por clase (mejor que mediana global)
    for col in PIMA_ZERO_INVALID:
        for clase in df["Outcome"].unique():
            mask = (df["Outcome"] == clase) & df[col].isnull()
            mediana_clase = df.loc[df["Outcome"] == clase, col].median()
            df.loc[mask, col] = mediana_clase
        # Si aún quedan NaN (e.g. toda la columna de una clase es NaN)
        df[col].fillna(df[col].median(), inplace=True)

    # 4. Clip de valores fisiológicamente imposibles
    clips = {
        "Glucose": (50, 300), "BloodPressure": (40, 140),
        "BMI": (10, 70), "Age": (18, 100),
        "Insulin": (0, 900), "SkinThickness": (0, 100),
        "DiabetesPedigreeFunction": (0, 3),
    }
    for col, (lo, hi) in clips.items():
        if col in df.columns:
            df[col] = df[col].clip(lo, hi)

    # 5. Renombrar Outcome
    df.rename(columns={"Outcome": "tiene_diabetes"}, inplace=True)

    # 6. Escalar numéricas (guardar scaler para inferencia)
    feature_cols = [c for c in df.columns if c != "tiene_diabetes"]
    scaler = StandardScaler()
    df_scaled = df.copy()
    df_scaled[feature_cols] = scaler.fit_transform(df[feature_cols])

    filas_fin = len(df)
    print(f"  [PIMA] Filas inicio: {filas_inicio} → Filas finales: {filas_fin} "
          f"(conservadas: {filas_fin/filas_inicio:.1%})")
    print(f"  [PIMA] Prevalencia diabetes: {df['tiene_diabetes'].mean():.1%}")

    df.to_csv(os.path.join(PROC, "pima_clean.csv"), index=False)
    df_scaled.to_csv(os.path.join(PROC, "pima_scaled.csv"), index=False)
    print(f"  [PIMA] Guardado → processed/pima_clean.csv y pima_scaled.csv")
    return df, scaler


# ════════════════════════════════════════════════════════════
# Sleep Health & Lifestyle
# ════════════════════════════════════════════════════════════

def clean_sleep(df: pd.DataFrame) -> pd.DataFrame:
    """Limpia el dataset de sueño y estilo de vida."""
    print("\n  [SLEEP] Limpiando…")
    df = df.copy()
    filas_inicio = len(df)

    # 1. Duplicados
    dups = df.duplicated().sum()
    df.drop_duplicates(inplace=True)
    print(f"  [SLEEP] Duplicados eliminados: {dups}")

    # 2. Parsear presión arterial "120/80" → dos columnas
    if "Blood_Pressure" in df.columns:
        bp = df["Blood_Pressure"].str.split("/", expand=True)
        df["presion_sistolica"]  = pd.to_numeric(bp[0], errors="coerce")
        df["presion_diastolica"] = pd.to_numeric(bp[1], errors="coerce")
        df.drop(columns=["Blood_Pressure"], inplace=True)

    # 3. Normalizar BMI_Category
    if "BMI_Category" in df.columns:
        df["BMI_Category"] = (df["BMI_Category"]
                              .str.strip().str.title()
                              .replace({"Normal Weight": "Normal"}))

    # 4. Clip de valores extremos
    clips_sleep = {
        "Sleep_Duration":          (3, 12),
        "Quality_of_Sleep":        (1, 10),
        "Physical_Activity_Level": (0, 100),
        "Stress_Level":            (1, 10),
        "Heart_Rate":              (35, 200),
        "Daily_Steps":             (0, 40000),
    }
    for col, (lo, hi) in clips_sleep.items():
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").clip(lo, hi)

    # 5. Imputar faltantes
    for col in df.select_dtypes(include=np.number).columns:
        if df[col].isnull().sum() > 0:
            df[col].fillna(df[col].median(), inplace=True)
    for col in df.select_dtypes(exclude=np.number).columns:
        if df[col].isnull().sum() > 0:
            df[col].fillna(df[col].mode()[0], inplace=True)

    # 6. Codificar variables categóricas
    le = LabelEncoder()
    cat_cols = ["Gender", "Occupation", "BMI_Category", "Sleep_Disorder"]
    for col in cat_cols:
        if col in df.columns:
            df[col + "_enc"] = le.fit_transform(df[col].astype(str))

    # 7. Flags de riesgo
    if "Sleep_Duration" in df.columns:
        df["riesgo_suenio"] = ((df["Sleep_Duration"] < 6) | (df["Sleep_Duration"] > 9)).astype(int)
    if "Stress_Level" in df.columns:
        df["estres_alto"] = (df["Stress_Level"] >= 7).astype(int)
    if "presion_sistolica" in df.columns:
        df["hipertension_proxy"] = (df["presion_sistolica"] >= 130).astype(int)

    filas_fin = len(df)
    print(f"  [SLEEP] Filas inicio: {filas_inicio} → Filas finales: {filas_fin} "
          f"(conservadas: {filas_fin/filas_inicio:.1%})")

    out = os.path.join(PROC, "sleep_clean.csv")
    df.to_csv(out, index=False)
    print(f"  [SLEEP] Guardado → {out}")
    return df


# ════════════════════════════════════════════════════════════
# Entry point
# ════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("\n" + "="*60)
    print("PASO 3 — Limpieza de datasets")
    print("="*60)

    brfss_raw = pd.read_csv(os.path.join(PROC, "brfss_raw.csv"), low_memory=False)
    pima_raw  = pd.read_csv(os.path.join(os.path.dirname(BASE), "Data", "raw", "pima_diabetes.csv")
                            if False else os.path.join(BASE, "..", "raw", "pima_diabetes.csv"))
    sleep_raw = pd.read_csv(os.path.join(BASE, "..", "raw", "sleep_health_and_lifestyle.csv"))

    brfss_clean          = clean_brfss(brfss_raw)
    pima_clean, scaler   = clean_pima(pima_raw)
    sleep_clean          = clean_sleep(sleep_raw)

    print("\nFormas finales:")
    print(f"  BRFSS : {brfss_clean.shape}")
    print(f"  PIMA  : {pima_clean.shape}")
    print(f"  Sleep : {sleep_clean.shape}")
    print("\nPASO 3 completado ✓")
