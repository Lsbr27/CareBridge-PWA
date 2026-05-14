"""
Calcula columnas riesgo_* por enfermedad a partir de BRFSS.

Reglas (basadas en criterios clínicos estándar):

  riesgo_diabetes
    2 alto   → diagnóstico confirmado de diabetes (tiene_diabetes == 'si')
    1 medio  → pre-diabetes, O (sin diabetes + obeso + sin ejercicio + edad ≥45)
    0 bajo   → resto

  riesgo_hipertension
    2 alto   → diagnóstico confirmado (has_high_bp_bin == 1)
    1 medio  → sin diagnóstico + (obeso O sobrepeso) + edad ≥45 + sin ejercicio
    0 bajo   → resto

  riesgo_cardiopatia
    2 alto   → diagnóstico confirmado (has_heart_disease_bin == 1)
    1 medio  → sin diagnóstico + (tiene hipertensión O diabetes) + edad ≥55
    0 bajo   → resto

  riesgo_depresion
    2 alto   → diagnóstico confirmado (has_depression_bin == 1)
    1 medio  → sin diagnóstico + días de mala salud mental ≥ 14/mes
    0 bajo   → resto

  riesgo_asma
    2 alto   → diagnóstico confirmado (has_asthma_bin == 1)
    1 medio  → sin diagnóstico + obeso + sin ejercicio
    0 bajo   → resto

  riesgo_colesterol
    2 alto   → diagnóstico confirmado (has_high_cholesterol_bin == 1)
    1 medio  → sin diagnóstico + (obeso O tiene diabetes) + edad ≥45
    0 bajo   → resto
"""

import os
import pandas as pd

PROCESSED = os.path.join(os.path.dirname(__file__), "..", "processed")


def compute(df_feat: pd.DataFrame, df_clean: pd.DataFrame) -> pd.DataFrame:
    df = df_feat.copy()

    # Helpers desde df_clean (mismo índice)
    obeso        = df_clean["categoria_imc"] == "obeso"
    sobrepeso    = df_clean["categoria_imc"].isin(["obeso", "sobrepeso"])
    sin_ejercicio = df_clean["ejercicio_ultimo_mes"] == "no"
    edad_45plus  = df_clean["grupo_edad"].isin(["45-54", "55-64", "65+"])
    edad_55plus  = df_clean["grupo_edad"].isin(["55-64", "65+"])
    pre_diabetes = df_clean["tiene_diabetes"] == "pre_diabetes"
    tiene_dm     = df_clean["tiene_diabetes"] == "si"

    # ── riesgo_diabetes ──────────────────────────────────────────
    cond_dm_medio = (
        pre_diabetes
        | (~tiene_dm & obeso & sin_ejercicio & edad_45plus)
    )
    df["riesgo_diabetes"] = 0
    df.loc[cond_dm_medio,              "riesgo_diabetes"] = 1
    df.loc[tiene_dm,                   "riesgo_diabetes"] = 2

    # ── riesgo_hipertension ──────────────────────────────────────
    cond_hta_medio = (
        (df["has_high_bp_bin"] == 0)
        & sobrepeso
        & edad_45plus
        & sin_ejercicio
    )
    df["riesgo_hipertension"] = 0
    df.loc[cond_hta_medio,             "riesgo_hipertension"] = 1
    df.loc[df["has_high_bp_bin"] == 1, "riesgo_hipertension"] = 2

    # ── riesgo_cardiopatia ───────────────────────────────────────
    tiene_hta_o_dm = (
        (df["has_high_bp_bin"] == 1) | (df["has_diabetes_bin"] == 1)
    )
    cond_cardio_medio = (
        (df["has_heart_disease_bin"] == 0)
        & tiene_hta_o_dm
        & edad_55plus
    )
    df["riesgo_cardiopatia"] = 0
    df.loc[cond_cardio_medio,                  "riesgo_cardiopatia"] = 1
    df.loc[df["has_heart_disease_bin"] == 1,   "riesgo_cardiopatia"] = 2

    # ── riesgo_depresion ─────────────────────────────────────────
    dias_mentales = pd.to_numeric(df["poor_mental_health_days"], errors="coerce")
    cond_dep_medio = (
        (df["has_depression_bin"] == 0)
        & (dias_mentales >= 14)
        & (dias_mentales <= 30)   # excluir 88 (no aplica)
    )
    df["riesgo_depresion"] = 0
    df.loc[cond_dep_medio,                 "riesgo_depresion"] = 1
    df.loc[df["has_depression_bin"] == 1,  "riesgo_depresion"] = 2

    # ── riesgo_asma ──────────────────────────────────────────────
    cond_asma_medio = (
        (df["has_asthma_bin"] == 0)
        & obeso
        & sin_ejercicio
    )
    df["riesgo_asma"] = 0
    df.loc[cond_asma_medio,            "riesgo_asma"] = 1
    df.loc[df["has_asthma_bin"] == 1,  "riesgo_asma"] = 2

    # ── riesgo_colesterol ────────────────────────────────────────
    obeso_o_dm = obeso | (df["has_diabetes_bin"] == 1)
    cond_col_medio = (
        (df["has_high_cholesterol_bin"] == 0)
        & obeso_o_dm
        & edad_45plus
    )
    df["riesgo_colesterol"] = 0
    df.loc[cond_col_medio,                      "riesgo_colesterol"] = 1
    df.loc[df["has_high_cholesterol_bin"] == 1, "riesgo_colesterol"] = 2

    return df


def summary(df: pd.DataFrame) -> None:
    targets = [
        "riesgo_diabetes", "riesgo_hipertension", "riesgo_cardiopatia",
        "riesgo_depresion", "riesgo_asma", "riesgo_colesterol",
    ]
    print(f"\n{'Variable':<25} {'bajo':>8} {'medio':>8} {'alto':>8}  total")
    print("-" * 60)
    for col in targets:
        vc   = df[col].value_counts().reindex([0, 1, 2], fill_value=0)
        total = vc.sum()
        pct0 = vc[0] / total * 100
        pct1 = vc[1] / total * 100
        pct2 = vc[2] / total * 100
        print(f"{col:<25} {pct0:>7.1f}% {pct1:>7.1f}% {pct2:>7.1f}%  {total:,}")


if __name__ == "__main__":
    print("Cargando datasets…")
    df_feat  = pd.read_csv(os.path.join(PROCESSED, "brfss_features.csv"))
    df_clean = pd.read_csv(os.path.join(PROCESSED, "brfss_clean.csv"))

    # brfss_features tiene más filas que brfss_clean (distintos filtros)
    # usamos solo las filas en común por índice
    n = min(len(df_feat), len(df_clean))
    df_feat  = df_feat.iloc[:n].reset_index(drop=True)
    df_clean = df_clean.iloc[:n].reset_index(drop=True)

    print(f"Filas procesadas: {n:,}")
    df_out = compute(df_feat, df_clean)

    summary(df_out)

    out_path = os.path.join(PROCESSED, "brfss_features_with_risk.csv")
    df_out.to_csv(out_path, index=False)
    print(f"\nGuardado en: {out_path}")
