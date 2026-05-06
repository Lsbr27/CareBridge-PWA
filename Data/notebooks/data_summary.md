# CareBridge — Data Summary Report
> Generado automáticamente · 2026-05-06 15:12

---

## 1. Datasets Utilizados

| Dataset | Registros | Columnas | Fuente |
|---------|-----------|---------|--------|
| BRFSS 2023 (CDC) | 387,566 | 17 | CDC BRFSS Annual Survey |
| PIMA Diabetes | 768 | 9 | UCI / Kaggle |
| Sleep Health & Lifestyle | 374 | 13 | Sintético (YBI Foundation schema) |

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

Basado en Random Forest entrenado sobre 387,566 registros BRFSS 2023:

| # | Variable | Importancia | Predice |
|---|----------|-------------|---------|
| 1 | Ejercicio en el último mes | 0.17072 | cardiovascular_risk, diabetes |
| 2 | Diagnóstico de diabetes | 0.13298 | cardiovascular_risk, kidney_disease |
| 3 | Peso (kg) | 0.13164 | diabetes, cardiovascular_risk |
| 4 | Diagnóstico de artritis | 0.10048 | arthritis, cardiovascular_risk |
| 5 | Altura (cm) | 0.08677 | cardiovascular_risk, diabetes |
| 6 | Diagnóstico de depresión | 0.07598 | mental_health, cardiovascular_risk |
| 7 | Categoría de IMC | 0.05419 | diabetes, cardiovascular_risk |
| 8 | Grupo de edad | 0.05395 | all_conditions |
| 9 | Consumo de alcohol | 0.05390 | cardiovascular_risk, mental_health |
| 10 | Diagnóstico de cardiopatía coronaria | 0.05266 | cardiovascular_risk, stroke |

---

## 4. Rendimiento del Modelo

### Random Forest
- **Accuracy:** 0.5108
- **AUC-ROC (macro OvR):** 0.6845

### XGBoost
- **Accuracy:** 0.5271
- **AUC-ROC (macro OvR):** 0.6895

### Mejor Modelo Seleccionado
**XGBoost** con AUC-ROC de **0.6895** y Accuracy de **0.5271**

Clases objetivo:
- `0 — bajo riesgo`: Salud Excelente o Muy Buena
- `1 — riesgo medio`: Salud Buena
- `2 — alto riesgo`: Salud Regular o Mala

---

## 5. Preguntas Recomendadas para el Formulario CareBridge

Las siguientes preguntas deben incluirse en el onboarding del paciente,
ordenadas por importancia predictiva:

**1. En los últimos 30 días, ¿cuántos días tu salud física no fue buena (dolor, malestar físico, enfermedades)?**
> Tipo: `number [0–30 días]` · Predice: cardiovascular_risk, arthritis, asthma

**2. En los últimos 30 días, ¿cuántos días tu salud mental no fue buena (estrés, depresión, problemas emocionales)?**
> Tipo: `number [0–30 días]` · Predice: mental_health, depression, stress

**3. ¿Cuánto pesas aproximadamente? (en kilogramos)**
> Tipo: `number [30–300 kg]` · Predice: diabetes, cardiovascular_risk, arthritis

**4. ¿Cuánto mides aproximadamente? (en centímetros)**
> Tipo: `number [100–250 cm]` · Predice: cardiovascular_risk, diabetes, general_health

**5. ¿Cuál es tu categoría de peso según tu médico o la báscula inteligente?**
> Tipo: `category (Bajo peso, Normal, Sobrepeso, Obeso)` · Predice: diabetes, cardiovascular_risk, arthritis

**6. ¿En qué rango de edad te encuentras?**
> Tipo: `category (18 a 24 años, 25 a 34 años, 35 a 44 años, 45 a 54 años, 55 a 64 años, 65 años o más)` · Predice: all_conditions

**7. ¿Cuál es tu sexo biológico?**
> Tipo: `category (Masculino, Femenino)` · Predice: cardiovascular_risk, diabetes, osteoporosis

**8. En los últimos 30 días, además de tu trabajo habitual, ¿realizaste algún tipo de actividad física o ejercicio?**
> Tipo: `boolean (Sí, No)` · Predice: cardiovascular_risk, diabetes, mental_health

**9. Actualmente, ¿con qué frecuencia fumas cigarrillos o usas tabaco?**
> Tipo: `category (Nunca / dejé de fumar, Algunos días, Todos los días)` · Predice: cardiovascular_risk, cancer, asthma

**10. En los últimos 30 días, ¿consumiste alguna bebida alcohólica?**
> Tipo: `boolean (Sí, No)` · Predice: cardiovascular_risk, liver_disease, mental_health

---

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
