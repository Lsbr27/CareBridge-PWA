# ML Handoff — CareBridge / CareMosaic

> Pega este archivo al inicio de una nueva sesión de Claude Code para retomar exactamente donde quedamos.

---

## Estado actual (sesión 2026-05-15)

### Qué se hizo en esta sesión

1. **Pipeline de datos reparado y corrido** — `src/data/build_dataset.py` ahora funciona. Se corrigieron 4 bugs:

   | Archivo | Bug | Fix aplicado |
   |---|---|---|
   | `src/data/download_nhanes.py:148` | `pyreadstat.read_xpt` no existe | → `pd.read_sas(..., format="xport", encoding="latin-1")` |
   | `src/data/load_from_supabase.py:121` | `offset += PAGE_SIZE` saltaba 9k filas/iteración | → `offset += len(batch)` |
   | `src/data/load_from_supabase.py:145` | `unified_features` sin paginación → 1,000/1,142 filas | → loop de paginación |
   | `src/data/download_nhanes.py:192` | `participant_id` duplicada en merge de XPT files | → excluir join key de list-comprehension |

2. **Datos generados** (todos en caché, no re-descargar a menos que uses `--force`):

   | Archivo | Filas | Tamaño |
   |---|---|---|
   | `data/processed/brfss_clean.csv` | 387,566 | 43 MB |
   | `data/processed/unified_features.csv` | 1,142 | 91 KB |
   | `data/nhanes/nhanes_lab_merged.csv` | 11,933 | — |
   | `data/nhanes/nhanes_lab_fasting.csv` | 3,483 | — |
   | `data/nhanes/raw/*.xpt` | 8 archivos | cacheados |

3. **Tres modelos entrenados** — todos los `.joblib` están en `models/`:

---

## Métricas de los modelos actuales

### Modelo 1 — Multi-enfermedad (`src/models/train_multidisease.py`)
Dataset: `brfss_clean`, N train = 310,052, 13 features

| Condición | AUC-ROC | F1 | Precision | Recall |
|---|---|---|---|---|
| diabetes | 0.772 | 0.404 | 0.274 | 0.765 |
| heart_disease | 0.798 | 0.222 | 0.129 | 0.804 |
| depression | 0.680 | 0.432 | 0.341 | 0.588 |
| asthma | 0.640 | 0.331 | 0.242 | 0.523 |

Top-5 SHAP por condición (ver `models/multidisease_shap_top5.json`):
- **diabetes**: grupo_edad_enc, consumo_alcohol_enc, peso_kg, categoria_imc_enc, ejercicio_ultimo_mes_enc
- **heart_disease**: grupo_edad_enc, sexo_enc, tiene_artritis_enc, tiene_diabetes_enc, tiene_depresion_enc
- **depression**: grupo_edad_enc, sexo_enc, tiene_artritis_enc, tiene_asma_enc, peso_kg
- **asthma**: tiene_depresion_enc, tiene_artritis_enc, grupo_edad_enc, sexo_enc, peso_kg

### Modelo 2 — Diabetes clínica (`src/models/train_diabetes_lab.py`)

| Modo | N train | AUC-ROC | F1 | Precision | Recall |
|---|---|---|---|---|---|
| lab (NHANES, con glucosa+HbA1c) | 2,785 | **0.963** | 0.732 | 0.645 | 0.845 |
| screening (BRFSS, sin laboratorio) | 310,052 | 0.767 | 0.399 | 0.270 | 0.766 |

### Modelo 3 — Salud percibida (`src/models/train_health_score.py`)
5 clases: mala(5%) / regular(16%) / buena(35%) / muy_buena(31%) / excelente(13%)

| Métrica | Valor |
|---|---|
| Accuracy | 0.296 |
| F1 macro | 0.292 |
| F1 weighted | 0.289 |

Problema: "buena" y "muy_buena" se confunden mutuamente en ~40% de casos. Barely better than random para las 3 clases centrales.

### Archivos en `models/`
```
diabetes_lab.joblib              245 KB
diabetes_screening.joblib        611 KB
diabetes_shap_top5.json
health_score.joblib              6.8 MB
health_score_shap_top5.json
multidisease_asthma.joblib       472 KB
multidisease_depression.joblib   1.1 MB
multidisease_diabetes.joblib     913 KB
multidisease_heart_disease.joblib 472 KB
multidisease_shap_top5.json
```

---

## Diagnóstico del problema de calidad

**El techo bajo del Modelo 1 no es el algoritmo — es el feature set.**

`brfss_clean` tiene 30 columnas pero el modelo solo puede usar 13 features numéricas:
- 2 continuas: `altura_cm`, `peso_kg`
- 5 lifestyle: ejercicio, alcohol, IMC, edad, sexo (todas ordinales gruesas)
- 6 flags de comorbilidades: 0/1 de las otras condiciones

Con esto, XGBoost aprende correlaciones demográficas poblacionales, no riesgo individual.

**Columnas importantes ausentes del feature set actual:**
- `salud_general` (texto: mala/regular/buena/muy_buena/excelente) — está en brfss_clean pero excluida; es el predictor más fuerte de enfermedad, no es leakage para los modelos binarios
- `poor_mental_health_days`, `poor_physical_health_days` — solo en `ml_data.brfss_features`, no en brfss_clean
- `has_high_bp_bin`, `has_high_cholesterol_bin`, `has_stroke_bin` — 3 condiciones extra, solo en `ml_data.brfss_features`

---

## Ruta recomendada (en orden de impacto/esfuerzo)

### PASO 1 — Inmediato: Opción A + C (mejora rápida del Modelo 1)

**A. Agregar `salud_general` como feature numérica**

En `src/models/train_multidisease.py`, la columna `salud_general` (texto) se excluye actualmente. No es leakage para los modelos de enfermedad binaria. Encodearla (mala=0, regular=1, buena=2, muy_buena=3, excelente=4) y agregarla al feature set debería dar +0.03-0.06 AUC en depression y heart_disease.

Cambio concreto: en `ALWAYS_EXCLUDE` remover `"salud_general"`, y antes de `get_feature_columns()` agregar:
```python
HEALTH_ENC = {"mala": 0, "regular": 1, "buena": 2, "muy_buena": 3, "excelente": 4}
df["salud_general_enc"] = df["salud_general"].map(HEALTH_ENC)
```

**C. Threshold óptimo por condición**

Actualmente todos los modelos usan threshold=0.5. Con clases desbalanceadas, el threshold óptimo para F1 suele estar entre 0.2-0.35. Agregar al loop de evaluación:

```python
from sklearn.metrics import precision_recall_curve
precisions, recalls, thresholds = precision_recall_curve(y_test, y_prob)
f1_scores = 2 * precisions * recalls / (precisions + recalls + 1e-9)
best_threshold = thresholds[np.argmax(f1_scores)]
```

Guardar el threshold por condición en un JSON (ej. `models/multidisease_thresholds.json`) para usarlo en inferencia.

Impacto esperado en heart_disease: F1 de 0.222 → ~0.38-0.42.

---

### PASO 2 — Semana siguiente: Opción B (brfss_features)

Cargar `ml_data.brfss_features` de Supabase. Tiene las mismas 387,566 filas con columnas en inglés y 3 targets extra + 2 features clave.

Cambios necesarios:
1. En `src/data/load_from_supabase.py`: agregar loader de `brfss_features` con la misma paginación ya implementada
2. Nuevo target list en `train_multidisease.py` (o nuevo script `train_multidisease_v2.py`):
   - `has_high_bp_bin` (~41% prevalencia) — muy accionable para la app
   - `has_high_cholesterol_bin` (~37%) — accionable
   - `has_stroke_bin` (~4%) — raro pero crítico
3. Agregar `poor_mental_health_days` y `poor_physical_health_days` como features para el modelo de depression — probablemente lleva AUC de 0.68 → 0.80+

Cobertura pasa de **4 condiciones a 7 condiciones**.

---

### PASO 3 — Después: Rediseñar Modelo 3 (health_score)

Colapsar de 5 clases a 3:
- `bajo` = mala + regular
- `medio` = buena
- `alto` = muy_buena + excelente

Esto debería llevar accuracy de 29% a ~50%+. El modelo de 5 clases no es usable para el agente en su estado actual.

---

### PASO 4 — Largo plazo: Agente sobre datos longitudinales

La diferenciación real de la app no son los modelos BRFSS (populacionales). Es que la app recopila datos longitudinales propios del usuario:

| Tabla en Supabase | Qué contiene | Qué puede hacer el agente |
|---|---|---|
| `daily_logs` | Síntomas diarios | Detección de tendencias: "Llevas 5 días con fatiga" |
| `medications` | Adherencia a medicamentos | Correlacionar días sin medicamento con empeoramiento |
| `appointments` | Historial médico | Resumen pre-consulta automático para el médico |

Los modelos BRFSS funcionan como **cold-start prior** (primera visita del usuario). Los daily logs personalizan el riesgo con el tiempo.

---

## Comandos para retomar

```bash
# Todos los comandos desde la raíz del repo, con el Python de miniconda:

# Verificar que los datos están en caché:
ls -lh data/processed/ data/nhanes/*.csv

# Re-entrenar si se modifica algún script:
/home/valentinau/miniconda3/bin/python -m src.models.train_multidisease
/home/valentinau/miniconda3/bin/python -m src.models.train_diabetes_lab
/home/valentinau/miniconda3/bin/python -m src.models.train_health_score

# Re-descargar datos desde cero (solo si es necesario):
/home/valentinau/miniconda3/bin/python src/data/build_dataset.py --force
```

**Python a usar**: `/home/valentinau/miniconda3/bin/python` (3.13, tiene todos los paquetes)
**No usar**: `/usr/bin/python3` (3.12 del sistema, le faltan los paquetes ML)

---

## Contexto del agente que se quiere construir

CareBridge / CareMosaic es una app de salud para pacientes que:
- Centraliza medicamentos, síntomas diarios, citas médicas
- Conecta al paciente con su médico via resúmenes pre-consulta
- MVP actual: onboarding + medication reminders + daily health logging + insights/alerts

El agente ML alimenta la sección de **insights/alerts**: detectar riesgo elevado y recomendar acciones al usuario. El tono debe ser de "sugerencia de consultar al médico", nunca de diagnóstico.

Los modelos BRFSS son el punto de partida (cold-start). El agente se vuelve más preciso con los datos propios del usuario acumulados en `daily_logs`.
