"""
PASO 5 — Análisis de Importancia de Variables
===============================================
Entrena un Random Forest sobre BRFSS para obtener las 20 variables
más predictoras del riesgo de salud general.
Guarda la lista ranqueada en: scripts/feature_ranking.json
Esta lista define las preguntas del formulario CareBridge.
"""

import os, json, warnings
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import cross_val_score
from sklearn.preprocessing import LabelEncoder

warnings.filterwarnings("ignore")

BASE    = os.path.dirname(os.path.abspath(__file__))
PROC    = os.path.join(BASE, "..", "processed")
SCRIPTS = os.path.join(BASE, "..", "scripts")
FIGURES = os.path.join(BASE, "figures")
os.makedirs(SCRIPTS, exist_ok=True)
os.makedirs(FIGURES, exist_ok=True)

# Nombres legibles para el reporte
NOMBRES_LEGIBLES = {
    "dias_mala_salud_fisica":          "Días de mala salud física (mes)",
    "dias_mala_salud_mental":          "Días de mala salud mental (mes)",
    "altura_cm":                       "Altura (cm)",
    "peso_kg":                         "Peso (kg)",
    "ejercicio_ultimo_mes_enc":        "Ejercicio en el último mes",
    "consumo_alcohol_enc":             "Consumo de alcohol",
    "frecuencia_tabaco_enc":           "Frecuencia de consumo de tabaco",
    "categoria_imc_enc":               "Categoría de IMC",
    "grupo_edad_enc":                  "Grupo de edad",
    "sexo_enc":                        "Sexo biológico",
    "tiene_diabetes_enc":              "Diagnóstico de diabetes",
    "tiene_cardiopatia_coronaria_enc": "Diagnóstico de cardiopatía coronaria",
    "tiene_depresion_enc":             "Diagnóstico de depresión",
    "tiene_artritis_enc":              "Diagnóstico de artritis",
    "tiene_asma_enc":                  "Diagnóstico de asma",
    "tiene_cancer_piel_enc":           "Diagnóstico de cáncer de piel",
    "tiene_otro_cancer_enc":           "Diagnóstico de otro cáncer",
}

# Mapa de variables a condiciones que predicen
PREDICE = {
    "dias_mala_salud_fisica":          ["cardiovascular_risk", "arthritis", "asthma"],
    "dias_mala_salud_mental":          ["mental_health", "depression", "stress"],
    "altura_cm":                       ["cardiovascular_risk", "diabetes"],
    "peso_kg":                         ["diabetes", "cardiovascular_risk", "arthritis"],
    "ejercicio_ultimo_mes_enc":        ["cardiovascular_risk", "diabetes", "mental_health"],
    "consumo_alcohol_enc":             ["cardiovascular_risk", "mental_health", "cancer"],
    "frecuencia_tabaco_enc":           ["cardiovascular_risk", "cancer", "asthma"],
    "categoria_imc_enc":               ["diabetes", "cardiovascular_risk", "arthritis"],
    "grupo_edad_enc":                  ["all_conditions"],
    "sexo_enc":                        ["cardiovascular_risk", "diabetes"],
    "tiene_diabetes_enc":              ["cardiovascular_risk", "kidney_disease"],
    "tiene_cardiopatia_coronaria_enc": ["cardiovascular_risk", "stroke"],
    "tiene_depresion_enc":             ["mental_health", "cardiovascular_risk"],
    "tiene_artritis_enc":              ["arthritis", "cardiovascular_risk"],
    "tiene_asma_enc":                  ["asthma", "respiratory"],
    "tiene_cancer_piel_enc":           ["cancer", "skin"],
    "tiene_otro_cancer_enc":           ["cancer"],
}


def run_feature_analysis(brfss: pd.DataFrame) -> pd.DataFrame:
    """
    Entrena RF y calcula importancias. Retorna DataFrame ranqueado.
    """
    if "riesgo_salud" not in brfss.columns:
        raise ValueError("Variable objetivo 'riesgo_salud' no encontrada en BRFSS limpio.")

    # Seleccionar solo columnas de features (encoded + numéricas)
    feat_enc = [c for c in brfss.columns if c.endswith("_enc")]
    feat_num = [c for c in brfss.select_dtypes(include=np.number).columns
                if c not in ["riesgo_salud"] and not c.endswith("_enc")]
    all_feats = list(set(feat_enc + feat_num))
    all_feats = [c for c in all_feats if c in brfss.columns]

    # Muestra representativa para velocidad
    sub = brfss[all_feats + ["riesgo_salud"]].dropna().sample(
        min(100_000, len(brfss)), random_state=42
    )
    X = sub[all_feats].values
    y = sub["riesgo_salud"].values

    print(f"  Muestra de entrenamiento: {X.shape[0]:,} filas × {X.shape[1]} columnas")
    print(f"  Distribución de clases: bajo={( y==0).sum():,} | "
          f"medio={(y==1).sum():,} | alto={(y==2).sum():,}")

    # Validación cruzada rápida (3-fold)
    rf = RandomForestClassifier(n_estimators=200, max_depth=12,
                                random_state=42, n_jobs=-1, class_weight="balanced")
    scores = cross_val_score(rf, X, y, cv=3, scoring="accuracy")
    print(f"  CV Accuracy (3-fold): {scores.mean():.3f} ± {scores.std():.3f}")

    # Entrenamiento final
    rf.fit(X, y)

    # DataFrame de importancias
    df_imp = pd.DataFrame({
        "variable":         all_feats,
        "importancia":      rf.feature_importances_,
        "nombre_legible":   [NOMBRES_LEGIBLES.get(c, c) for c in all_feats],
        "predice":          [str(PREDICE.get(c, [])) for c in all_feats],
    }).sort_values("importancia", ascending=False).reset_index(drop=True)
    df_imp["rank"] = df_imp.index + 1

    return df_imp, rf, all_feats


def guardar_ranking(df_imp: pd.DataFrame):
    """Guarda el ranking como JSON y CSV."""
    # JSON legible
    ranking_json = []
    for _, row in df_imp.head(20).iterrows():
        ranking_json.append({
            "rank":           int(row["rank"]),
            "variable":       row["variable"],
            "nombre_legible": row["nombre_legible"],
            "importancia":    round(float(row["importancia"]), 5),
            "predice":        eval(row["predice"]) if isinstance(row["predice"], str) else row["predice"],
        })

    out_json = os.path.join(SCRIPTS, "feature_ranking.json")
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump({"top_20_variables": ranking_json}, f, ensure_ascii=False, indent=2)
    print(f"  Ranking guardado → {out_json}")

    out_csv = os.path.join(SCRIPTS, "feature_ranking.csv")
    df_imp.to_csv(out_csv, index=False)
    print(f"  Ranking guardado → {out_csv}")

    return ranking_json


def plot_top20(df_imp: pd.DataFrame):
    """Gráfica del top 20 ranqueado."""
    top20 = df_imp.head(20).copy()
    etiquetas = top20["nombre_legible"].tolist()
    vals      = top20["importancia"].tolist()

    # Colores por importancia: más importante → más oscuro
    from matplotlib.colors import LinearSegmentedColormap
    cmap  = LinearSegmentedColormap.from_list("cb", ["#D4C5E8", "#5B3FA6"])
    norm  = plt.Normalize(min(vals), max(vals))
    colores = [cmap(norm(v)) for v in vals]

    fig, ax = plt.subplots(figsize=(11, 9))
    bars = ax.barh(etiquetas[::-1], vals[::-1],
                   color=colores[::-1], edgecolor="white", linewidth=0.7)

    for bar, val in zip(bars, vals[::-1]):
        ax.text(val + 0.0005, bar.get_y() + bar.get_height() / 2,
                f"{val:.4f}", va="center", fontsize=8.5)

    ax.set_xlabel("Importancia Promedio (Gini)", fontsize=11)
    ax.set_title("Top 20 Variables Predictoras del Riesgo de Salud\n"
                 "(Random Forest — BRFSS 2023, n≈100k)",
                 fontsize=13, fontweight="bold")
    ax.spines[["top", "right"]].set_visible(False)
    ax.tick_params(axis="y", labelsize=9.5)

    out = os.path.join(FIGURES, "feature_importance_top20_full.png")
    plt.tight_layout()
    plt.savefig(out, dpi=130, bbox_inches="tight")
    plt.close()
    print(f"  Figura guardada → figures/feature_importance_top20_full.png")


# ════════════════════════════════════════════════════════════
# Entry point
# ════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("\n" + "="*60)
    print("PASO 5 — Análisis de Importancia de Variables")
    print("="*60)

    brfss = pd.read_csv(os.path.join(PROC, "brfss_clean.csv"), low_memory=False)

    df_imp, rf_model, features = run_feature_analysis(brfss)

    print("\n  TOP 20 VARIABLES PREDICTORAS:")
    print(f"  {'#':>3}  {'Variable':<45} {'Importancia':>11}  Predice")
    print("  " + "─"*80)
    for _, row in df_imp.head(20).iterrows():
        print(f"  {int(row['rank']):>3}. {row['variable']:<45} "
              f"{row['importancia']:>10.5f}  {row['predice']}")

    ranking = guardar_ranking(df_imp)
    plot_top20(df_imp)

    print("\nPASO 5 completado ✓")
