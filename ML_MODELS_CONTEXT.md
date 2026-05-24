# Contexto ML — CareBridge (para integración con agente)

> Documento de referencia para continuar el trabajo en un chat nuevo.
> Describe el estado exacto de los modelos entrenados, cómo se conectan a la app,
> y lo que falta para integrarlos con el agente de chat (CareGuide).

---

## 1. Repositorio y rutas clave

```
CareBridge/
├── models/                          ← modelos .joblib entrenados
│   ├── v2_multidisease_{cond}.joblib   × 7 condiciones
│   ├── v2_multidisease_thresholds.json
│   ├── v2_multidisease_shap_top5.json
│   └── health_score_v2.joblib          ⚠️ ver limitación §4
├── src/
│   ├── lib/feature_mapper.py        ← convierte datos Supabase → features
│   └── predict_user.py              ← script de inferencia (stdin → stdout JSON)
└── Frontend/
    ├── app/api/risk/route.ts        ← Next.js POST /api/risk
    └── src/app/screens/main/
        └── InsightsScreen.tsx       ← consume /api/risk, muestra alertas ML
```

Python correcto para ejecutar scripts ML: `/Users/lb/miniconda3/bin/python`

---

## 2. Modelos entrenados — v2 (7 condiciones)

Fuente de entrenamiento: `data/processed/brfss_features.csv` (387 566 filas, BRFSS 2023).
Algoritmo: XGBClassifier con `scale_pos_weight` por clase.
Un modelo `.joblib` por condición, con threshold F1-óptimo.

| Condición | Archivo | AUC-ROC | F1 | Threshold | Prevalencia |
|---|---|---|---|---|---|
| `diabetes` | `v2_multidisease_diabetes.joblib` | 0.821 | 0.456 | 0.652 | 13.8% |
| `high_bp` | `v2_multidisease_high_bp.joblib` | 0.808 | 0.698 | 0.421 | 40.7% |
| `heart_disease` | `v2_multidisease_heart_disease.joblib` | 0.847 | 0.314 | 0.778 | 5.4% |
| `depression` | `v2_multidisease_depression.joblib` | 0.810 | 0.551 | 0.601 | 20.3% |
| `asthma` | `v2_multidisease_asthma.joblib` | 0.672 | 0.337 | 0.539 | 14.9% |
| `high_cholesterol` | `v2_multidisease_high_cholesterol.joblib` | 0.758 | 0.635 | 0.439 | 36.7% |
| `stroke` | `v2_multidisease_stroke.joblib` | 0.815 | 0.240 | 0.721 | 4.2% |

Todos los AUC > 0.5 → mejor que el azar. Referencia: AUC = 1.0 es perfecto, 0.5 es aleatorio.

### Top-5 features por condición (SHAP)

```
diabetes       → age_group_enc (0.58), has_high_bp_enc (0.52), general_health_enc (0.46),
                  has_high_cholesterol_enc (0.30), bmi_computed (0.25)
high_bp        → age_group_enc (0.68), has_high_cholesterol_enc (0.34), general_health_enc (0.24),
                  has_diabetes_enc (0.20), bmi_computed (0.18)
heart_disease  → age_group_enc (0.90), has_high_bp_enc (0.43), general_health_enc (0.41),
                  has_high_cholesterol_enc (0.33), height_cm (0.17)
depression     → poor_mental_health_days (0.90), ever_smoked_enc (0.18), height_cm (0.18),
                  poor_physical_health_days (0.17), has_asthma_enc (0.15)
asthma         → has_depression_enc (0.23), poor_physical_health_days (0.21),
                  age_group_enc (0.15), height_cm (0.12), general_health_enc (0.12)
high_cholesterol → age_group_enc (0.61), has_high_bp_enc (0.38), has_diabetes_enc (0.14),
                  bmi_computed (0.12), general_health_enc (0.09)
stroke         → age_group_enc (0.64), has_high_bp_enc (0.37), general_health_enc (0.26),
                  has_heart_disease_enc (0.17), has_depression_enc (0.11)
```

---

## 3. Feature mapper (`src/lib/feature_mapper.py`)

Función principal: `map_to_model_features(profile, health_profile, daily_logs) → dict`

Recibe tres dicts con datos de Supabase y devuelve 21 features numéricas que los modelos esperan.

| Feature devuelta | Fuente en Supabase | Notas |
|---|---|---|
| `weight_kg` | `health_profile.weight_kg` | puede ser 0 si no se completó |
| `height_cm` | `health_profile.height_cm` | puede ser 0 si no se completó |
| `bmi_computed` | calculado de w/h² | 0 si faltan datos |
| `bmi_category_enc` | 0=bajo, 1=normal, 2=sobrepeso, 3=obeso | |
| `age_group_enc` | `profiles.date_of_birth` | 0–5 por rango de edad |
| `general_health_enc` | `health_profile.mood_general` | 0–4, aprox. percepción de salud |
| `exercises_enc` | `health_profile.physical_activity_frequency` | 0=no, 1=sí |
| `physical_activity_category_enc` | ídem | 0=ninguna … 3=alta |
| `drinks_alcohol_enc` | no recopilado → **0** | default conservador |
| `ever_smoked_enc` | no recopilado → **0** | default conservador |
| `education_level_enc` | no recopilado → **1** | default mid-range |
| `income_level_enc` | no recopilado → **2** | default mid-range |
| `poor_mental_health_days` | `daily_logs.mood <= 2` | conteo últimos 30 registros |
| `poor_physical_health_days` | `daily_logs.pain >= 6` | conteo últimos 30 registros |
| `has_diabetes_enc` | keyword search en `profiles.diagnosis` | 1=sí, 0=no |
| `has_high_bp_enc` | ídem ("hipertens", "presion alta", "hta") | |
| `has_heart_disease_enc` | ídem ("cardio", "coron", "infarto") | |
| `has_depression_enc` | ídem ("depres", "ansiedad", "trastorno") | |
| `has_asthma_enc` | ídem ("asma") | |
| `has_high_cholesterol_enc` | ídem ("colesterol") | |
| `has_stroke_enc` | ídem ("derrame", "ictus", "stroke", "acv") | |

Los modelos usan `model.get_booster().feature_names` para seleccionar exactamente las columnas
que necesitan. Features faltantes se rellenan con 0 automáticamente.

---

## 4. Health score v2 — limitación conocida

`models/health_score_v2.joblib` está entrenado sobre `brfss_clean.csv` y usa
**nombres de columnas en español**:

```
altura_cm, peso_kg, ejercicio_ultimo_mes_enc, consumo_alcohol_enc,
categoria_imc_enc, grupo_edad_enc, sexo_enc, tiene_diabetes_enc,
tiene_cardiopatia_coronaria_enc, tiene_depresion_enc, tiene_cancer_piel_enc,
tiene_otro_cancer_enc, tiene_artritis_enc, tiene_asma_enc
```

El feature mapper devuelve nombres en inglés (`height_cm`, `weight_kg`, etc.).
Resultado: el modelo de health score recibe todos los inputs como 0 en la inferencia actual,
por lo que su output (`bajo`/`medio`/`alto`) **no es confiable** todavía.

**Dos opciones para arreglarlo:**

- **Opción A (rápida):** agregar un mapeador español→inglés en `predict_user.py` antes de
  llamar al modelo de health score.
- **Opción B (limpia):** reentrenar `health_score_v2` sobre `brfss_features.csv`
  (que ya tiene nombres en inglés), siguiendo el mismo patrón que `train_multidisease_v2.py`.

Para el agente de chat, usar solo los 7 modelos de condición (que sí funcionan correctamente).
El health score puede mostrarse como un derivado de las probabilidades de condición.

---

## 5. Script de inferencia (`src/predict_user.py`)

Lee JSON por stdin, escribe JSON por stdout. Uso:

```bash
echo '{"profile":{...},"health_profile":{...},"daily_logs":[...]}' \
  | /Users/lb/miniconda3/bin/python src/predict_user.py
```

**Estructura de salida:**

```json
{
  "conditions": {
    "diabetes":         { "probability": 0.1707, "flag": false, "threshold": 0.6516 },
    "high_bp":          { "probability": 0.0847, "flag": false, "threshold": 0.4209 },
    "heart_disease":    { "probability": 0.1512, "flag": false, "threshold": 0.7776 },
    "depression":       { "probability": 0.4715, "flag": false, "threshold": 0.6012 },
    "asthma":           { "probability": 0.5805, "flag": true,  "threshold": 0.5393 },
    "high_cholesterol": { "probability": 0.1443, "flag": false, "threshold": 0.4394 },
    "stroke":           { "probability": 0.1967, "flag": false, "threshold": 0.7209 }
  },
  "health_score": {
    "label": "medio",
    "class": 1,
    "probabilities": { "bajo": 0.28, "medio": 0.45, "alto": 0.27 }
  }
}
```

`flag: true` significa que la probabilidad supera el threshold F1-óptimo → el modelo predice
presencia/riesgo. Las probabilidades son continuas (más útiles para el agente que el flag binario).

---

## 6. API route Next.js (`Frontend/app/api/risk/route.ts`)

```
POST /api/risk
Body: { "userId": "<uuid de profiles.id>" }
```

El handler:
1. Consulta Supabase admin → `profiles`, `health_profile`, `daily_logs` (últimos 30)
2. Serializa como JSON y lo pasa a `predict_user.py` vía `child_process.spawn`
3. Devuelve el JSON resultante

Variable de entorno usada: `PYTHON_PATH` (default: `/Users/lb/miniconda3/bin/python`)

---

## 7. InsightsScreen — integración actual

`Frontend/src/app/screens/main/InsightsScreen.tsx`

- Llama a `POST /api/risk` en el mount con `profile.id`
- Muestra sección "Evaluación de riesgo IA" con `ShieldAlert` como header
- Si no hay flags → card verde "sin alertas"
- Si hay flags → una card por condición con: nombre en español, probabilidad en %, consejo accionable
- Muestra label del health score (bajo/medio/alto) bajo la barra de puntuación

---

## 8. Base de datos Supabase — tablas relevantes para el agente

Proyecto: `ggqxtmwozsdmwxohvupu` (caremosaic-db, us-west-2)

| Tabla | Columnas útiles para el agente |
|---|---|
| `public.profiles` | `id`, `full_name`, `date_of_birth`, `gender`, `diagnosis`, `location`, `phone` |
| `public.health_profile` | `sleep_hours`, `sleep_quality`, `wake_up_feeling`, `physical_activity_frequency`, `physical_activity_type`, `weight_kg`, `height_cm`, `typical_diet`, `mood_general`, `profession`, `work_schedule` |
| `public.daily_logs` | `date`, `mood` (1–5), `pain` (0–10), `notes` |
| `public.medications` | `name`, `dose`, `frequency`, `status` (`taken`/`pending`) |
| `public.appointments` | `doctor_name`, `specialty`, `date`, `notes` |

---

## 9. Lo que falta — Bloque C (agente de chat)

### C1 — Nueva pantalla de chat

Archivos a crear:
- `Frontend/app/app/chat/page.tsx` — page wrapper (patrón igual al resto)
- `Frontend/src/app/screens/main/ChatScreen.tsx` — componente con UI de chat
- Modificar `Frontend/src/app/layouts/MainLayout.tsx` — agregar tab Chat

### C2 — API route del agente

**Archivo:** `Frontend/app/api/agent/route.ts`

Lógica:
1. Recibir `{ messages: [...], userId }` (historial + usuario)
2. Fetch paralelo: profile + health_profile + últimos 7 daily_logs + medications + risk scores (`/api/risk` internamente o directo con `predict_user.py`)
3. Construir system prompt con contexto real del usuario (ver §10)
4. Llamar `claude-sonnet-4-6` vía Anthropic SDK con streaming
5. Devolver la respuesta (streaming o completa)

SDK: `@anthropic-ai/sdk` (ya debe estar instalado, verificar en `package.json`)

### C3 — System prompt del agente (CareGuide)

Ver §10.

---

## 10. System prompt para CareGuide

```
Eres CareGuide, la asistente de salud de CareBridge.
Hablas en español. Tono: cálido, empático, como una amiga que estudió medicina interna.
NUNCA das diagnósticos. Señalas patrones y sugieres consultar al especialista adecuado.

=== Perfil del usuario ===
Nombre: {full_name}
Edad: {age} años | Género: {gender}
Diagnóstico previo: {diagnosis | "ninguno reportado"}
Profesión: {profession | "no especificada"}
Horario: {work_schedule | "no especificado"}

=== Hábitos de salud ===
Sueño: {sleep_hours}h — calidad: {sleep_quality} — amanecer: {wake_up_feeling}
Actividad física: {physical_activity_frequency} ({physical_activity_type})
Alimentación: {typical_diet}
Estado de ánimo general: {mood_general}
Peso: {weight_kg} kg | Talla: {height_cm} cm | IMC: {bmi_computed}

=== Registro reciente (últimos 7 días) ===
{tabla de daily_logs: fecha | ánimo (1-5) | dolor (0-10) | notas}
Promedio ánimo: {avg_mood}/5 | Promedio dolor: {avg_pain}/10
Días de mal ánimo (≤2): {poor_mental_count} | Días de dolor alto (≥6): {poor_physical_count}

=== Medicamentos activos ===
{lista de medications con nombre, dosis, frecuencia}

=== Señales ML (orientativas, NO son diagnóstico) ===
{para cada condición con probability > 0.15:}
  - {nombre}: probabilidad {prob}% {flag ? "[por encima del umbral de alerta]" : ""}

Condiciones con flag activo: {lista o "ninguna"}

=== Reglas de respuesta ===
1. Valida cómo se siente el usuario antes de cualquier recomendación.
2. Respuestas de máximo 3-4 oraciones, salvo que el usuario pida más detalle.
3. Si hay condición con flag activo, sugiere naturalmente ver al especialista:
   diabetes/colesterol → endocrinólogo | presión/corazón/ACV → cardiólogo
   depresión → psiquiatra o psicóloga | asma → neumólogo
4. Si el usuario menciona síntomas urgentes (dolor en el pecho, dificultad
   respiratoria, pensamientos de hacerse daño) → indicar atención médica
   inmediata, sin rodeos, antes de cualquier otra respuesta.
5. Nunca menciones nombres de modelos, thresholds ni probabilidades exactas
   al usuario. Solo las conclusiones en lenguaje natural.
```

---

## 11. Resumen del stack técnico

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 15 App Router, React 18, Tailwind v4, Framer Motion |
| Auth | Supabase Auth (Google OAuth) |
| Base de datos | Supabase PostgreSQL, RLS activado |
| ML inference | Python 3.13 (miniconda), XGBoost, joblib, pandas |
| Bridge app↔ML | `child_process.spawn` desde Next.js API route |
| Agente IA | Anthropic SDK (`@anthropic-ai/sdk`), modelo `claude-sonnet-4-6` |

---

## 12. Verificación rápida antes de continuar

```bash
# 1. Los 7 modelos v2 existen
ls models/v2_multidisease_*.joblib   # debe listar 7 archivos

# 2. El script de inferencia funciona
echo '{"profile":{"date_of_birth":"1990-01-01","diagnosis":""},"health_profile":{"physical_activity_frequency":"1-2 veces","mood_general":"Regular"},"daily_logs":[]}' \
  | /Users/lb/miniconda3/bin/python src/predict_user.py

# 3. El servidor Next.js corre en localhost:3000
cd Frontend && npm run dev
```

---

*Generado 2026-05-15. Estado del proyecto: Bloques A y B completos. Bloque C pendiente.*
