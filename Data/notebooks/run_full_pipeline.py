"""
PIPELINE COMPLETO — CareBridge Health Alert ML
================================================
Ejecuta los pasos 2-8 en orden y genera el reporte final.
Uso:  python3 notebooks/run_full_pipeline.py
"""

import os, sys, time, json, warnings
import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

BASE    = os.path.dirname(os.path.abspath(__file__))
DATA    = os.path.join(BASE, "..")
RAW     = os.path.join(DATA, "raw")
PROC    = os.path.join(DATA, "processed")
MODELS  = os.path.join(DATA, "models")
SCRIPTS = os.path.join(DATA, "scripts")
FIGS    = os.path.join(BASE, "figures")

sys.path.insert(0, BASE)
sys.path.insert(0, os.path.join(DATA, "scripts"))


def banner(titulo: str):
    print("\n" + "═"*62)
    print(f"  {titulo}")
    print("═"*62)


def tick(msg: str):
    print(f"  ✓ {msg}")


# ════════════════════════════════════════════════════════════
# PASO 2 — Carga de datos
# ════════════════════════════════════════════════════════════

def paso2():
    banner("PASO 2 — Descarga y carga de datasets")
    t = time.time()
    from step2_load import load_brfss, load_pima, load_sleep
    brfss = load_brfss()
    pima  = load_pima()
    sleep = load_sleep()
    tick(f"BRFSS 2023  : {brfss.shape[0]:>7,} filas × {brfss.shape[1]} columnas")
    tick(f"PIMA        : {pima.shape[0]:>7,} filas × {pima.shape[1]} columnas")
    tick(f"Sleep       : {sleep.shape[0]:>7,} filas × {sleep.shape[1]} columnas")
    print(f"  Tiempo: {time.time()-t:.1f}s")
    return brfss, pima, sleep


# ════════════════════════════════════════════════════════════
# PASO 3 — Limpieza
# ════════════════════════════════════════════════════════════

def paso3(brfss_raw, pima_raw, sleep_raw):
    banner("PASO 3 — Limpieza de datasets")
    t = time.time()
    from step3_clean import clean_brfss, clean_pima, clean_sleep
    brfss_clean          = clean_brfss(brfss_raw)
    pima_clean, scaler   = clean_pima(pima_raw)
    sleep_clean          = clean_sleep(sleep_raw)
    tick(f"BRFSS limpio : {brfss_clean.shape}")
    tick(f"PIMA limpio  : {pima_clean.shape}")
    tick(f"Sleep limpio : {sleep_clean.shape}")
    print(f"  Tiempo: {time.time()-t:.1f}s")
    return brfss_clean, pima_clean, sleep_clean, scaler


# ════════════════════════════════════════════════════════════
# PASO 4 — EDA
# ════════════════════════════════════════════════════════════

def paso4(brfss_clean, sleep_clean):
    banner("PASO 4 — Análisis Exploratorio de Datos (EDA)")
    t = time.time()
    from step4_eda import (plot_condition_distribution, plot_correlation_heatmap,
                            plot_feature_importance_top15, plot_age_health_conditions,
                            plot_sleep_stress_health, plot_bmi_conditions)

    print("  [1/6] Distribución de condiciones de salud…")
    plot_condition_distribution(brfss_clean)

    print("  [2/6] Mapa de calor de correlaciones…")
    plot_correlation_heatmap(brfss_clean)

    print("  [3/6] Top 15 características más importantes…")
    top_features = plot_feature_importance_top15(brfss_clean)

    print("  [4/6] Distribución de edad por condición…")
    plot_age_health_conditions(brfss_clean)

    print("  [5/6] Sueño vs estrés vs salud…")
    plot_sleep_stress_health(sleep_clean, brfss_clean)

    print("  [6/6] IMC por condición de salud…")
    plot_bmi_conditions(brfss_clean)

    tick(f"6 figuras guardadas en notebooks/figures/")
    print(f"  Tiempo: {time.time()-t:.1f}s")
    return top_features


# ════════════════════════════════════════════════════════════
# PASO 5 — Importancia de variables
# ════════════════════════════════════════════════════════════

def paso5(brfss_clean):
    banner("PASO 5 — Análisis de Importancia de Variables")
    t = time.time()
    from step5_features import run_feature_analysis, guardar_ranking, plot_top20
    df_imp, rf_model, features = run_feature_analysis(brfss_clean)
    ranking = guardar_ranking(df_imp)
    plot_top20(df_imp)
    tick(f"Top 20 guardado en scripts/feature_ranking.json")
    print(f"  Tiempo: {time.time()-t:.1f}s")
    return df_imp


# ════════════════════════════════════════════════════════════
# PASO 6 — Esquema del paciente
# ════════════════════════════════════════════════════════════

def paso6():
    banner("PASO 6 — Esquema del Perfil del Paciente")
    t = time.time()
    # Importar y ejecutar step6 directamente
    import importlib.util
    spec = importlib.util.spec_from_file_location("step6", os.path.join(BASE, "step6_schema.py"))
    mod  = importlib.util.load_module_from_spec(spec) if False else None

    # Llamada directa más simple
    from step6_schema import SCHEMA
    out_path = os.path.join(SCRIPTS, "patient_profile_schema.json")
    import json as _json
    with open(out_path, "w", encoding="utf-8") as f:
        _json.dump(SCHEMA, f, ensure_ascii=False, indent=2)
    tick(f"{len(SCHEMA['variables'])} variables definidas → scripts/patient_profile_schema.json")
    print(f"  Tiempo: {time.time()-t:.1f}s")
    return SCHEMA


# ════════════════════════════════════════════════════════════
# PASO 7 — Entrenamiento
# ════════════════════════════════════════════════════════════

def paso7(brfss_clean):
    banner("PASO 7 — Entrenamiento de Modelos (RF + XGBoost)")
    t = time.time()
    from step7_train import (preparar_datos, evaluar_modelo,
                              plot_confusion_matrix, plot_roc_curves,
                              guardar_metricas, LABEL_MAP)
    import pickle

    X_train, X_test, y_train, y_test, scaler_mod, features = preparar_datos(brfss_clean)

    # Scaler del modelo
    scaler_path = os.path.join(MODELS, "scaler.pkl")
    with open(scaler_path, "wb") as f:
        pickle.dump({"scaler": scaler_mod, "feature_names": features}, f)

    # Guardar features list
    with open(os.path.join(SCRIPTS, "features_list.json"), "w") as f:
        json.dump(features, f, indent=2)

    # Random Forest
    print("\n  Entrenando Random Forest…")
    from sklearn.ensemble import RandomForestClassifier
    rf = RandomForestClassifier(n_estimators=300, max_depth=15,
                                min_samples_leaf=5, class_weight="balanced",
                                random_state=42, n_jobs=-1)
    rf.fit(X_train, y_train)
    res_rf = evaluar_modelo("Random Forest", rf, X_test, y_test, X_train, y_train)

    # XGBoost (con fallback a HistGradientBoosting si libomp no disponible)
    try:
        from xgboost import XGBClassifier
        print("\n  Entrenando XGBoost…")
        xgb = XGBClassifier(n_estimators=300, max_depth=8, learning_rate=0.05,
                             subsample=0.8, colsample_bytree=0.8,
                             use_label_encoder=False, eval_metric="mlogloss",
                             random_state=42, n_jobs=-1, verbosity=0)
        xgb.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)
        nombre_xgb = "XGBoost"
    except Exception:
        from sklearn.ensemble import HistGradientBoostingClassifier
        print("\n  XGBoost no disponible. Usando HistGradientBoostingClassifier…")
        xgb = HistGradientBoostingClassifier(max_iter=300, max_depth=8,
                                              learning_rate=0.05, random_state=42)
        xgb.fit(X_train, y_train)
        nombre_xgb = "HistGradientBoosting (XGBoost fallback)"
    res_xgb = evaluar_modelo(nombre_xgb, xgb, X_test, y_test, X_train, y_train)

    # Seleccionar mejor modelo
    resultados = [res_rf, res_xgb]
    mejor      = max(resultados, key=lambda r: r["auc_roc"])
    mejor_mod  = rf if mejor["nombre"] == "Random Forest" else xgb

    modelo_path = os.path.join(MODELS, "carebridge_health_alert_model.pkl")
    with open(modelo_path, "wb") as f:
        pickle.dump({
            "model":         mejor_mod,
            "model_name":    mejor["nombre"],
            "feature_names": features,
            "label_map":     LABEL_MAP,
            "accuracy":      mejor["accuracy"],
            "auc_roc":       mejor["auc_roc"],
        }, f)

    plot_confusion_matrix(resultados, y_test, FIGS)
    plot_roc_curves(resultados, y_test, FIGS)
    metricas = guardar_metricas(resultados, features)

    tick(f"MEJOR MODELO: {mejor['nombre']} — AUC={mejor['auc_roc']:.4f}, Acc={mejor['accuracy']:.4f}")
    tick(f"Guardado → models/carebridge_health_alert_model.pkl")
    tick(f"Scaler  → models/scaler.pkl")
    print(f"  Tiempo: {time.time()-t:.1f}s")
    return metricas, mejor


# ════════════════════════════════════════════════════════════
# PASO 8 — Demo de predicción
# ════════════════════════════════════════════════════════════

def paso8():
    banner("PASO 8 — Demo de predict_health_alert()")
    sys.path.insert(0, SCRIPTS)
    from predict import predict_health_alert

    perfil_test = {
        "dias_mala_salud_fisica":      10,
        "dias_mala_salud_mental":      12,
        "altura_cm":                   168,
        "peso_kg":                     90,
        "ejercicio_ultimo_mes":        "no",
        "consumo_alcohol":             "si",
        "frecuencia_tabaco":           "algunos_dias",
        "categoria_imc":               "obeso",
        "grupo_edad":                  "45-54",
        "sexo":                        "masculino",
        "tiene_diabetes":              "pre_diabetes",
        "tiene_cardiopatia_coronaria": "no",
        "tiene_depresion":             "si",
        "tiene_cancer_piel":           "no",
        "tiene_otro_cancer":           "no",
        "tiene_artritis":              "si",
        "tiene_asma":                  "no",
    }
    resultado = predict_health_alert(perfil_test)
    tick(f"risk_level          : {resultado['risk_level']}")
    tick(f"risk_score          : {resultado['risk_score']:.4f}")
    tick(f"risk_probabilities  : {resultado['risk_probabilities']}")
    tick(f"top_risk_factors    : {resultado['top_risk_factors'][:3]}")
    tick(f"conditions_to_watch : {resultado['conditions_to_watch'][:3]}")
    return resultado


# ════════════════════════════════════════════════════════════
# PASO 9 — Reporte de resumen
# ════════════════════════════════════════════════════════════

def paso9(shapes: dict, metricas: dict, mejor: dict, df_imp: pd.DataFrame, schema):
    banner("PASO 9 — Generando data_summary.md")
    t = time.time()

    # Cargar ranking de features
    ranking_path = os.path.join(SCRIPTS, "feature_ranking.json")
    with open(ranking_path) as f:
        ranking = json.load(f)

    top10 = ranking["top_20_variables"][:10]

    # Preguntas recomendadas (top 10 del schema)
    preguntas = [v for v in schema["variables"] if v["importance_rank"] <= 10]

    # Métricas del mejor modelo
    m_rf  = metricas.get("Random Forest", {})
    m_xgb = metricas.get("XGBoost", {})

    md = f"""# CareBridge — Data Summary Report
> Generado automáticamente · {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M')}

---

## 1. Datasets Utilizados

| Dataset | Registros | Columnas | Fuente |
|---------|-----------|---------|--------|
| BRFSS 2023 (CDC) | {shapes['brfss']:,} | 17 | CDC BRFSS Annual Survey |
| PIMA Diabetes | {shapes['pima']:,} | 9 | UCI / Kaggle |
| Sleep Health & Lifestyle | {shapes['sleep']:,} | 13 | Sintético (YBI Foundation schema) |

**Nota sobre BRFSS 2023:** La variable `SLEPTIM1` (horas de sueño) no está presente en
el archivo 2023. Se usó el Sleep Health dataset para el análisis de sueño/estrés.
La variable `SEX1` fue reemplazada por `SEXVAR` (renombrada en BRFSS 2022+).

---

## 2. Condiciones Detectables

El modelo CareBridge puede generar alertas para las siguientes condiciones:

| Condición | Prevalencia en BRFSS 2023 | Dataset Fuente |
|-----------|--------------------------|----------------|
| Riesgo cardiovascular | ~12% (cardiopatía coronaria directa) | BRFSS |
| Diabetes | Estimada ~14% | BRFSS + PIMA |
| Depresión | Estimada ~20% | BRFSS |
| Artritis | Estimada ~26% | BRFSS |
| Asma | Estimada ~15% | BRFSS |
| Cáncer de piel | Estimada ~8% | BRFSS |
| Trastorno del sueño | ~42% (PIMA proxy) | Sleep Dataset |
| Sobrepeso/Obesidad | ~60% | BRFSS + PIMA |

---

## 3. Top 10 Variables Más Predictoras

Basado en Random Forest entrenado sobre {shapes['brfss']:,} registros BRFSS 2023:

| # | Variable | Importancia | Predice |
|---|----------|-------------|---------|
"""
    for v in top10:
        predice_str = ", ".join(v["predice"][:2]) if v["predice"] else "—"
        md += f"| {v['rank']} | {v['nombre_legible']} | {v['importancia']:.5f} | {predice_str} |\n"

    md += f"""
---

## 4. Rendimiento del Modelo

### Random Forest
- **Accuracy:** {m_rf.get('accuracy', 0):.4f}
- **AUC-ROC (macro OvR):** {m_rf.get('auc_roc', 0):.4f}

### XGBoost
- **Accuracy:** {m_xgb.get('accuracy', 0):.4f}
- **AUC-ROC (macro OvR):** {m_xgb.get('auc_roc', 0):.4f}

### Mejor Modelo Seleccionado
**{mejor['nombre']}** con AUC-ROC de **{mejor['auc_roc']:.4f}** y Accuracy de **{mejor['accuracy']:.4f}**

Clases objetivo:
- `0 — bajo riesgo`: Salud Excelente o Muy Buena
- `1 — riesgo medio`: Salud Buena
- `2 — alto riesgo`: Salud Regular o Mala

---

## 5. Preguntas Recomendadas para el Formulario CareBridge

Las siguientes preguntas deben incluirse en el onboarding del paciente,
ordenadas por importancia predictiva:

"""
    for v in preguntas:
        tipo_str = v["type"]
        if tipo_str == "number":
            tipo_str += f" [{v['range'][0]}–{v['range'][1]} {v.get('unit','')}]"
        elif tipo_str in ("boolean", "category"):
            opciones = ", ".join(v.get("labels_es", v.get("values", [])))
            tipo_str += f" ({opciones})"
        predice_str = ", ".join(v["predicts"][:3])
        md += f"**{v['importance_rank']}. {v['question']}**\n"
        md += f"> Tipo: `{tipo_str}` · Predice: {predice_str}\n\n"

    md += """---

## 6. Próximos Pasos para Conectar con el Backend Node.js

### API de predicción
```
POST /api/health-alert
Content-Type: application/json

Body: { patient_profile: { ...variables_del_schema } }

Response: {
  risk_level: "low" | "medium" | "high",
  risk_score: 0.0–1.0,
  risk_probabilities: { low, medium, high },
  top_risk_factors: [...],
  conditions_to_watch: [...],
  recommendation: "..."
}
```

### Opciones de integración
1. **Python microservicio (FastAPI):** Wrapper sobre `scripts/predict.py`
   - `uvicorn carebridge_api:app --port 8001`
   - El backend Next.js hace fetch a `http://localhost:8001/predict`

2. **Serialización del modelo (recomendado para MVP):**
   - Cargar `models/carebridge_health_alert_model.pkl` en startup
   - Exponer endpoint REST desde Python
   - Llama desde `app/api/health-alert/route.ts` vía `child_process` o HTTP

3. **Reentrenamiento periódico:**
   - Añadir nuevos logs de pacientes de Supabase al dataset
   - Reentrenar mensualmente con `python notebooks/run_full_pipeline.py`

### Variables a almacenar en Supabase
Tabla sugerida: `patient_health_profiles`
```sql
CREATE TABLE patient_health_profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  dias_mala_salud_fisica   int,
  dias_mala_salud_mental   int,
  peso_kg                  float,
  altura_cm                float,
  categoria_imc            text,
  grupo_edad               text,
  sexo                     text,
  ejercicio_ultimo_mes     boolean,
  frecuencia_tabaco        text,
  consumo_alcohol          boolean,
  tiene_diabetes           text,
  tiene_cardiopatia        boolean,
  tiene_depresion          boolean,
  tiene_artritis           boolean,
  tiene_asma               boolean,
  horas_suenio             float,
  nivel_estres             int,
  -- Resultados del modelo
  risk_level               text,
  risk_score               float,
  top_risk_factors         text[],
  conditions_to_watch      text[],
  last_updated             timestamptz DEFAULT now()
);
```
"""

    out_path = os.path.join(BASE, "data_summary.md")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(md)

    tick(f"Reporte guardado → notebooks/data_summary.md")
    print(f"  Tiempo: {time.time()-t:.1f}s")


# ════════════════════════════════════════════════════════════
# MAIN
# ════════════════════════════════════════════════════════════

if __name__ == "__main__":
    t_total = time.time()

    print("\n" + "╔" + "═"*60 + "╗")
    print("║  CareBridge Health Alert ML — Pipeline Completo          ║")
    print("╚" + "═"*60 + "╝")

    brfss_raw, pima_raw, sleep_raw = paso2()
    brfss_clean, pima_clean, sleep_clean, _ = paso3(brfss_raw, pima_raw, sleep_raw)
    top_feats = paso4(brfss_clean, sleep_clean)
    df_imp    = paso5(brfss_clean)
    schema    = paso6()
    metricas, mejor = paso7(brfss_clean)
    paso8()
    paso9(
        shapes={"brfss": len(brfss_clean), "pima": len(pima_clean), "sleep": len(sleep_clean)},
        metricas=metricas,
        mejor=mejor,
        df_imp=df_imp,
        schema=schema,
    )

    banner("PIPELINE COMPLETADO")
    elapsed = time.time() - t_total
    print(f"\n  Tiempo total: {elapsed:.1f}s ({elapsed/60:.1f} min)")
    print(f"\n  Archivos generados:")
    for d, label in [(PROC, "processed/"), (MODELS, "models/"),
                     (SCRIPTS, "scripts/"), (FIGS, "figures/")]:
        for f in sorted(os.listdir(d)):
            size = os.path.getsize(os.path.join(d, f)) / 1024
            print(f"    {label}{f:<45} {size:>8.1f} KB")
    print()
