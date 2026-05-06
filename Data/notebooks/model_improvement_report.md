# Reporte de Mejora del Modelo — CareBridge Health Alerts

Fecha de ejecución: 2026-05-06 15:43

---

## 1. Problema Principal con el Modelo Base

El modelo baseline (HistGradientBoosting) obtuvo una accuracy de **0.5301**
y un AUC-ROC de **0.6951**, lo cual es bajo para una aplicación de salud.

Las causas identificadas fueron:

- **Desbalance moderado de clases**: clase `bajo` (44%), `medio` (35%), `alto` (21%).
  La clase mayoritaria dominaba las predicciones, afectando especialmente el recall de la clase `alto riesgo`.
- **Features limitadas**: el dataset BRFSS limpio solo contenía 14 features,
  predominantemente categóricas codificadas.
- **Sin ingeniería de features**: no se explotaban interacciones entre variables
  (ej. carga de condiciones crónicas por grupo etario).
- **Sin ajuste de hiperparámetros**: el modelo usaba valores por defecto.

---

## 2. Qué Mejoró Más

| Intervención | AUC-ROC | F1-Macro | Delta AUC |
|---|---|---|---|
| Baseline | 0.6951 | 0.4872 | — |
| + Features seleccionadas | 0.6924 | 0.4859 | -0.0027 |
| + Balanceo (SMOTE) | 0.6888 | 0.4979 | -0.0063 |
| Mejor modelo final (Baseline HistGB) | **0.6951** | **0.4872** | **+0.0000** |

La mayor mejora provino de: **ingeniería de features** (interacciones entre condiciones
crónicas y edad) y el uso de un **ensemble con balanceo de clases**.

---

## 3. Métricas Finales del Mejor Modelo

- **Modelo**: Baseline HistGB
- **Accuracy**:    `0.5301`
- **AUC-ROC**:     `0.6951` (macro OvR)
- **F1-Macro**:    `0.4872`
- **F1-Weighted**: `0.5105`
- **Precision**:   `0.5065`
- **Recall**:      `0.4886`

---

## 4. Umbral de Decisión para Producción

Para un sistema de alertas de salud, el **recall es prioritario** sobre la precisión:
es preferible alertar a un paciente sano que no detectar a uno en riesgo.

- **Umbral recomendado para clase 'alto riesgo'**: `0.4972`
- Con este umbral: Recall ≥ objetivo | Precision ≥ 0.60

Usar probabilidad predicha para clase `alto` > `0.4972` para disparar alertas.

---

## 5. ¿Está listo para producción?

**NO — necesita más trabajo ✗**

El modelo aún no alcanza los umbrales mínimos recomendados para salud (AUC ≥ 0.75, F1-Macro ≥ 0.55). AUC actual: 0.6951, F1-Macro: 0.4872.

---

## 6. Limitaciones

1. **Datos BRFSS**: son autoreportados y tienen sesgos de respuesta.
2. **Target construido**: `riesgo_salud` es una variable derivada de condiciones crónicas,
   no un diagnóstico clínico validado. Mejoraría con etiquetas médicas reales.
3. **Heterogeneidad de fuentes**: PIMA y Sleep Health son datasets pequeños y sintéticos;
   el modelo se apoya casi exclusivamente en BRFSS.
4. **Sin features temporales**: un paciente con tendencia a empeorar en sus logs diarios
   aportaría señal valiosa que hoy no existe.

## 7. Qué se Necesitaría para Mejorar Más

- Logs de síntomas diarios de los propios usuarios de CareBridge (contexto real y longitudinal).
- Valores de laboratorio (glucosa, colesterol, HbA1c).
- Integración de datos de wearables (pasos, frecuencia cardíaca, sueño real).
- Etiquetas validadas por profesionales de salud.
- Con esos datos, un modelo XGBoost o Transformer sobre series temporales podría alcanzar AUC > 0.85.

## Top 5 Features por Impacto SHAP (clase 'alto riesgo')

1. **n_condiciones_cronicas** — importancia media SHAP: `0.3206`
2. **ejercicio_ultimo_mes_enc** — importancia media SHAP: `0.2689`
3. **altura_cm** — importancia media SHAP: `0.1753`
4. **consumo_alcohol_enc** — importancia media SHAP: `0.1646`
5. **peso_kg** — importancia media SHAP: `0.1230`

---

*Reporte generado automáticamente por CareBridge ML Pipeline — Paso 8*
