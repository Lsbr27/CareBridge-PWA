"""
PASO 4 — Análisis Exploratorio de Datos (EDA)
===============================================
Genera y guarda en notebooks/figures/ las siguientes visualizaciones:
  1. condition_distribution.png   — Distribución de condiciones de salud
  2. correlation_heatmap.png      — Correlación estilo de vida vs resultados
  3. feature_importance_top15.png — Top 15 características predictoras
  4. age_health_conditions.png    — Distribución de edad por condición
  5. sleep_stress_health.png      — Sueño vs estrés vs salud
  6. bmi_conditions.png           — IMC por condición de salud
"""

import os, warnings
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import seaborn as sns
from sklearn.ensemble import RandomForestClassifier

warnings.filterwarnings("ignore")
sns.set_theme(style="whitegrid", font_scale=1.1)

BASE    = os.path.dirname(os.path.abspath(__file__))
PROC    = os.path.join(BASE, "..", "processed")
FIGURES = os.path.join(BASE, "figures")
os.makedirs(FIGURES, exist_ok=True)

# Paleta de colores de CareBridge (morado/lila)
CB_PALETTE = ["#7C5CBF", "#9B7DBF", "#B89FD4", "#D4C5E8", "#5B3FA6"]
CB_CMAP    = "BuPu"


def guardar(nombre: str):
    ruta = os.path.join(FIGURES, nombre)
    plt.tight_layout()
    plt.savefig(ruta, dpi=130, bbox_inches="tight")
    plt.close()
    print(f"  Figura guardada → figures/{nombre}")


# ════════════════════════════════════════════════════════════
# 1. DISTRIBUCIÓN DE CONDICIONES DE SALUD
# ════════════════════════════════════════════════════════════

def plot_condition_distribution(brfss: pd.DataFrame):
    """Prevalencia de cada condición crónica en BRFSS 2023."""
    condiciones = {
        "tiene_diabetes":             "Diabetes",
        "tiene_cardiopatia_coronaria": "Cardiopatía\nCoronaria",
        "tiene_depresion":             "Depresión",
        "tiene_cancer_piel":           "Cáncer\nde Piel",
        "tiene_otro_cancer":           "Otro\nCáncer",
        "tiene_artritis":              "Artritis",
        "tiene_asma":                  "Asma",
    }

    prevalencias = {}
    for col, etiqueta in condiciones.items():
        if col in brfss.columns:
            pct_si = (brfss[col] == "si").mean()
            prevalencias[etiqueta] = pct_si

    if not prevalencias:
        print("  [EDA1] No hay columnas de condiciones. Omitiendo.")
        return

    fig, ax = plt.subplots(figsize=(11, 5))
    cols = list(prevalencias.keys())
    vals = [v * 100 for v in prevalencias.values()]
    barras = ax.bar(cols, vals, color=CB_PALETTE[0], edgecolor="white", linewidth=0.8)

    # Etiquetas encima de cada barra
    for bar, val in zip(barras, vals):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.3,
                f"{val:.1f}%", ha="center", va="bottom", fontsize=10, fontweight="bold")

    ax.set_title("Prevalencia de Condiciones Crónicas — BRFSS 2023",
                 fontsize=14, fontweight="bold", pad=15)
    ax.set_ylabel("Prevalencia (%)")
    ax.set_ylim(0, max(vals) * 1.25)
    ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f"{x:.0f}%"))
    ax.spines[["top", "right"]].set_visible(False)
    guardar("condition_distribution.png")


# ════════════════════════════════════════════════════════════
# 2. MAPA DE CALOR DE CORRELACIONES
# ════════════════════════════════════════════════════════════

def plot_correlation_heatmap(brfss: pd.DataFrame):
    """Correlación entre variables de estilo de vida y resultados de salud."""

    # Variables de estilo de vida (solo numéricas o codificadas)
    estilo_vida = [c for c in [
        "dias_mala_salud_fisica", "dias_mala_salud_mental",
        "altura_cm", "peso_kg",
        "ejercicio_ultimo_mes_enc", "consumo_alcohol_enc",
        "frecuencia_tabaco_enc", "categoria_imc_enc",
        "grupo_edad_enc", "sexo_enc",
    ] if c in brfss.columns]

    resultados = [c for c in [
        "riesgo_salud",
        "tiene_diabetes_enc", "tiene_cardiopatia_coronaria_enc",
        "tiene_depresion_enc", "tiene_artritis_enc",
        "tiene_asma_enc", "tiene_cancer_piel_enc",
    ] if c in brfss.columns]

    if not estilo_vida or not resultados:
        print("  [EDA2] Columnas insuficientes para heatmap.")
        return

    # Subconjunto aleatorio para velocidad
    sub = brfss[estilo_vida + resultados].dropna().sample(
        min(50_000, len(brfss)), random_state=42
    )
    corr = sub[estilo_vida].corrwith(sub[resultados[0]]).to_frame()
    for r in resultados[1:]:
        corr[r] = sub[estilo_vida].corrwith(sub[r])

    # Renombrar para el gráfico
    renombrar_filas = {
        "dias_mala_salud_fisica":       "Días mala salud física",
        "dias_mala_salud_mental":       "Días mala salud mental",
        "altura_cm":                    "Altura (cm)",
        "peso_kg":                      "Peso (kg)",
        "ejercicio_ultimo_mes_enc":     "Ejercicio (mes)",
        "consumo_alcohol_enc":          "Consumo alcohol",
        "frecuencia_tabaco_enc":        "Frecuencia tabaco",
        "categoria_imc_enc":            "Categoría IMC",
        "grupo_edad_enc":               "Grupo edad",
        "sexo_enc":                     "Sexo",
    }
    renombrar_cols = {
        "riesgo_salud":                       "Riesgo Salud",
        "tiene_diabetes_enc":                 "Diabetes",
        "tiene_cardiopatia_coronaria_enc":     "Cardiopatía",
        "tiene_depresion_enc":                "Depresión",
        "tiene_artritis_enc":                 "Artritis",
        "tiene_asma_enc":                     "Asma",
        "tiene_cancer_piel_enc":              "Cáncer Piel",
    }
    corr.rename(index=renombrar_filas, columns=renombrar_cols, inplace=True)

    fig, ax = plt.subplots(figsize=(10, 6))
    sns.heatmap(
        corr, annot=True, fmt=".2f", cmap="RdYlBu_r",
        center=0, linewidths=0.5, ax=ax,
        annot_kws={"size": 9},
        cbar_kws={"shrink": 0.8},
    )
    ax.set_title("Correlación: Estilo de Vida vs Condiciones de Salud",
                 fontsize=13, fontweight="bold", pad=12)
    ax.set_xticklabels(ax.get_xticklabels(), rotation=30, ha="right")
    guardar("correlation_heatmap.png")


# ════════════════════════════════════════════════════════════
# 3. TOP 15 CARACTERÍSTICAS MÁS IMPORTANTES
# ════════════════════════════════════════════════════════════

def plot_feature_importance_top15(brfss: pd.DataFrame) -> list:
    """
    Entrena un Random Forest rápido y grafica las 15 variables
    más importantes para predecir riesgo_salud.
    Retorna lista ordenada de nombres de características.
    """
    if "riesgo_salud" not in brfss.columns:
        print("  [EDA3] Variable riesgo_salud no encontrada.")
        return []

    # Features numéricas y codificadas
    feature_cols = [c for c in brfss.columns if c.endswith("_enc")]
    num_cols     = brfss.select_dtypes(include=np.number).columns.tolist()
    num_cols     = [c for c in num_cols
                    if c not in ["riesgo_salud"] and not c.endswith("_enc")]
    all_feats    = list(set(feature_cols + num_cols))
    all_feats    = [c for c in all_feats if c in brfss.columns]

    sub = brfss[all_feats + ["riesgo_salud"]].dropna().sample(
        min(80_000, len(brfss)), random_state=42
    )
    X = sub[all_feats].values
    y = sub["riesgo_salud"].values

    rf = RandomForestClassifier(n_estimators=150, max_depth=10,
                                random_state=42, n_jobs=-1)
    rf.fit(X, y)

    importancias = pd.Series(rf.feature_importances_, index=all_feats)
    importancias.sort_values(ascending=False, inplace=True)
    top15 = importancias.head(15)

    # Nombres legibles
    nombres_legibles = {
        "dias_mala_salud_fisica":          "Días mala salud física",
        "dias_mala_salud_mental":          "Días mala salud mental",
        "altura_cm":                       "Altura (cm)",
        "peso_kg":                         "Peso (kg)",
        "riesgo_salud":                    "Riesgo salud",
        "ejercicio_ultimo_mes_enc":        "Ejercicio (mes)",
        "consumo_alcohol_enc":             "Consumo alcohol",
        "frecuencia_tabaco_enc":           "Tabaco",
        "categoria_imc_enc":               "Categoría IMC",
        "grupo_edad_enc":                  "Grupo edad",
        "sexo_enc":                        "Sexo",
        "tiene_diabetes_enc":              "Diabetes",
        "tiene_cardiopatia_coronaria_enc": "Cardiopatía",
        "tiene_depresion_enc":             "Depresión",
        "tiene_artritis_enc":              "Artritis",
        "tiene_asma_enc":                  "Asma",
        "tiene_cancer_piel_enc":           "Cáncer piel",
        "tiene_otro_cancer_enc":           "Otro cáncer",
    }
    etiquetas = [nombres_legibles.get(c, c) for c in top15.index]

    fig, ax = plt.subplots(figsize=(10, 7))
    bars = ax.barh(etiquetas[::-1], top15.values[::-1],
                   color=CB_PALETTE[0], edgecolor="white")

    for bar, val in zip(bars, top15.values[::-1]):
        ax.text(val + 0.001, bar.get_y() + bar.get_height() / 2,
                f"{val:.3f}", va="center", fontsize=9)

    ax.set_xlabel("Importancia (Gini)", fontsize=11)
    ax.set_title("Top 15 Variables para Predecir Riesgo de Salud\n(Random Forest — BRFSS 2023)",
                 fontsize=13, fontweight="bold")
    ax.spines[["top", "right"]].set_visible(False)
    guardar("feature_importance_top15.png")

    print("  [EDA3] Top 15 variables:")
    for i, (feat, imp) in enumerate(importancias.head(15).items(), 1):
        print(f"    {i:>2}. {feat:<45} {imp:.4f}")

    return importancias.head(20).index.tolist()


# ════════════════════════════════════════════════════════════
# 4. DISTRIBUCIÓN DE EDAD POR CONDICIÓN
# ════════════════════════════════════════════════════════════

def plot_age_health_conditions(brfss: pd.DataFrame):
    """Distribución del grupo de edad para cada condición crónica."""
    if "grupo_edad" not in brfss.columns:
        print("  [EDA4] grupo_edad no encontrado.")
        return

    condiciones = [c for c in [
        "tiene_diabetes", "tiene_depresion",
        "tiene_artritis", "tiene_cardiopatia_coronaria",
    ] if c in brfss.columns]

    if not condiciones:
        return

    orden_edad = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"]

    fig, axes = plt.subplots(2, 2, figsize=(14, 9), sharey=False)
    axes = axes.flatten()

    for ax, cond in zip(axes, condiciones):
        sub = brfss[brfss[cond] == "si"]
        conteo = sub["grupo_edad"].value_counts().reindex(orden_edad, fill_value=0)
        total  = brfss["grupo_edad"].value_counts().reindex(orden_edad, fill_value=1)
        prev   = (conteo / total * 100).fillna(0)

        ax.bar(prev.index, prev.values, color=CB_PALETTE[0],
               edgecolor="white", linewidth=0.8)
        ax.set_title(cond.replace("tiene_", "").replace("_", " ").title(),
                     fontsize=11, fontweight="bold")
        ax.set_ylabel("Prevalencia (%)")
        ax.set_xlabel("Grupo de Edad")
        ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f"{x:.0f}%"))
        ax.spines[["top", "right"]].set_visible(False)
        ax.tick_params(axis="x", rotation=30)

    plt.suptitle("Prevalencia de Condiciones por Grupo de Edad (BRFSS 2023)",
                 fontsize=14, fontweight="bold", y=1.01)
    guardar("age_health_conditions.png")


# ════════════════════════════════════════════════════════════
# 5. SUEÑO vs ESTRÉS vs SALUD
# ════════════════════════════════════════════════════════════

def plot_sleep_stress_health(sleep: pd.DataFrame, brfss: pd.DataFrame):
    """
    Panel de 3 gráficas sobre sueño, estrés y su relación con salud.
    Usa el dataset de Sleep (tiene horas de sueño directas) y BRFSS.
    """
    fig, axes = plt.subplots(1, 3, figsize=(16, 5))

    # ── A. Distribución de horas de sueño por trastorno ──────
    ax = axes[0]
    if "Sleep_Duration" in sleep.columns and "Sleep_Disorder" in sleep.columns:
        trastornos = sleep["Sleep_Disorder"].unique()
        colors     = CB_PALETTE[:len(trastornos)]
        for i, (trastorno, grp) in enumerate(sleep.groupby("Sleep_Disorder")):
            grp["Sleep_Duration"].plot.kde(ax=ax, label=trastorno,
                                           color=colors[i % len(colors)], linewidth=2)
        ax.axvline(7, color="red", linestyle="--", linewidth=1.2, alpha=0.7, label="7h rec.")
        ax.set_title("Horas de Sueño por Trastorno", fontsize=11, fontweight="bold")
        ax.set_xlabel("Horas de sueño")
        ax.legend(fontsize=8)
        ax.spines[["top", "right"]].set_visible(False)

    # ── B. Estrés vs Calidad de Sueño (scatter) ───────────────
    ax = axes[1]
    if "Stress_Level" in sleep.columns and "Quality_of_Sleep" in sleep.columns:
        ax.scatter(sleep["Stress_Level"], sleep["Quality_of_Sleep"],
                   alpha=0.35, color=CB_PALETTE[0], edgecolors="none", s=30)
        z  = np.polyfit(sleep["Stress_Level"].dropna(), sleep["Quality_of_Sleep"].dropna(), 1)
        xs = np.linspace(sleep["Stress_Level"].min(), sleep["Stress_Level"].max(), 100)
        ax.plot(xs, np.poly1d(z)(xs), color="red", linewidth=2, linestyle="--")
        r  = sleep[["Stress_Level", "Quality_of_Sleep"]].corr().iloc[0, 1]
        ax.set_title(f"Estrés vs Calidad de Sueño\n(r = {r:.2f})",
                     fontsize=11, fontweight="bold")
        ax.set_xlabel("Nivel de Estrés")
        ax.set_ylabel("Calidad de Sueño")
        ax.spines[["top", "right"]].set_visible(False)

    # ── C. Días mala salud mental por categoría IMC (BRFSS) ──
    ax = axes[2]
    if "categoria_imc" in brfss.columns and "dias_mala_salud_mental" in brfss.columns:
        orden_imc = ["bajo_peso", "normal", "sobrepeso", "obeso"]
        sub = brfss[brfss["categoria_imc"].isin(orden_imc)].dropna(
            subset=["dias_mala_salud_mental"]
        )
        promedios = sub.groupby("categoria_imc")["dias_mala_salud_mental"].mean().reindex(orden_imc)
        bars = ax.bar(["Bajo\nPeso", "Normal", "Sobre\nPeso", "Obeso"],
                      promedios.values, color=CB_PALETTE[:4], edgecolor="white")
        for bar, val in zip(bars, promedios.values):
            ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.1,
                    f"{val:.1f}", ha="center", va="bottom", fontsize=9)
        ax.set_title("Días Mala Salud Mental\npor Categoría IMC (BRFSS)",
                     fontsize=11, fontweight="bold")
        ax.set_ylabel("Promedio días / mes")
        ax.spines[["top", "right"]].set_visible(False)

    plt.suptitle("Sueño, Estrés y Salud Mental", fontsize=13, fontweight="bold", y=1.02)
    guardar("sleep_stress_health.png")


# ════════════════════════════════════════════════════════════
# 6. IMC POR CONDICIÓN DE SALUD
# ════════════════════════════════════════════════════════════

def plot_bmi_conditions(brfss: pd.DataFrame):
    """Distribución de categoría IMC para cada condición de salud."""
    if "categoria_imc" not in brfss.columns:
        print("  [EDA6] categoria_imc no encontrada.")
        return

    condiciones = [c for c in [
        "tiene_diabetes", "tiene_cardiopatia_coronaria",
        "tiene_depresion", "tiene_artritis",
    ] if c in brfss.columns]

    orden_imc = ["bajo_peso", "normal", "sobrepeso", "obeso"]
    etiquetas = ["Bajo Peso", "Normal", "Sobrepeso", "Obeso"]

    fig, axes = plt.subplots(2, 2, figsize=(13, 9))
    axes = axes.flatten()

    for ax, cond in zip(axes, condiciones):
        si  = brfss[brfss[cond] == "si"]["categoria_imc"].value_counts(normalize=True)
        no  = brfss[brfss[cond] == "no"]["categoria_imc"].value_counts(normalize=True)
        si  = si.reindex(orden_imc, fill_value=0) * 100
        no  = no.reindex(orden_imc, fill_value=0) * 100

        x   = np.arange(len(etiquetas))
        w   = 0.38
        ax.bar(x - w/2, si.values, w, label="Con condición",
               color=CB_PALETTE[0], edgecolor="white")
        ax.bar(x + w/2, no.values, w, label="Sin condición",
               color=CB_PALETTE[2], edgecolor="white")

        ax.set_xticks(x)
        ax.set_xticklabels(etiquetas, fontsize=9)
        ax.set_ylabel("% del grupo")
        ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda v, _: f"{v:.0f}%"))
        ax.set_title(cond.replace("tiene_", "").replace("_", " ").title(),
                     fontsize=11, fontweight="bold")
        ax.legend(fontsize=9)
        ax.spines[["top", "right"]].set_visible(False)

    plt.suptitle("Distribución de IMC: Con vs Sin Condición de Salud (BRFSS 2023)",
                 fontsize=13, fontweight="bold", y=1.01)
    guardar("bmi_conditions.png")


# ════════════════════════════════════════════════════════════
# Entry point
# ════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("\n" + "="*60)
    print("PASO 4 — Análisis Exploratorio de Datos (EDA)")
    print("="*60)

    brfss = pd.read_csv(os.path.join(PROC, "brfss_clean.csv"), low_memory=False)
    sleep = pd.read_csv(os.path.join(PROC, "sleep_clean.csv"))

    print("\n[1/6] Distribución de condiciones…")
    plot_condition_distribution(brfss)

    print("[2/6] Mapa de calor de correlaciones…")
    plot_correlation_heatmap(brfss)

    print("[3/6] Top 15 características más importantes…")
    top_features = plot_feature_importance_top15(brfss)

    print("[4/6] Edad por condición…")
    plot_age_health_conditions(brfss)

    print("[5/6] Sueño vs estrés vs salud…")
    plot_sleep_stress_health(sleep, brfss)

    print("[6/6] IMC por condición…")
    plot_bmi_conditions(brfss)

    print("\nPASO 4 completado ✓")
    print(f"Figuras en: {FIGURES}")
