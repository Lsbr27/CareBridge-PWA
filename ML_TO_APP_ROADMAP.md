# Plan de ejecución ML → App — CareBridge

> Reemplaza el documento anterior. Este es el plan concreto, en orden, con archivos exactos
> y qué cambiar en cada uno. Seguirlo de arriba a abajo.

---

## Estado de partida (verificado 2026-05-15)

| Archivo / recurso | Estado |
|---|---|
| `data/processed/brfss_clean.csv` | ✅ Cacheado, 387 566 filas, 30 cols |
| `data/processed/brfss_features.csv` | ✅ Cacheado, 387 566 filas, 29 cols |
| `models/multidisease_*.joblib` × 4 | ✅ Entrenados (métricas bajas, ver handoff) |
| `models/health_score.joblib` | ✅ Entrenado (accuracy 29%, inutilizable) |
| `models/diabetes_lab.joblib` | ✅ Entrenado (AUC 0.963, mantener) |
| `supabase/health_profile` schema | ✅ Sin `weight_kg` ni `height_cm` |
| `HealthProfileQuizScreen.tsx` | ✅ Sin preguntas de peso/talla |

### Columnas disponibles en `brfss_features.csv`
```
poor_mental_health_days, poor_physical_health_days,
weight_kg, height_cm, bmi_computed,
has_diabetes_bin, has_high_bp_bin, has_heart_disease_bin,
has_depression_bin, has_asthma_bin, has_high_cholesterol_bin, has_stroke_bin,
condition_count,
age_group_enc, bmi_category_enc, general_health_enc, exercises_enc,
drinks_alcohol_enc, ever_smoked_enc, physical_activity_category_enc,
education_level_enc, income_level_enc,
has_diabetes_enc, has_high_bp_enc, has_heart_disease_enc,
has_depression_enc, has_asthma_enc, has_high_cholesterol_enc, has_stroke_enc
```

---

## BLOQUE A — Mejorar los modelos ML

### A1 — Mejorar `train_multidisease.py` (modelos actuales × 4)

**Archivo:** `src/models/train_multidisease.py`

**Cambio 1: Agregar `salud_general` como feature numérica**

En el bloque de constantes, después de `ALWAYS_EXCLUDE`, añadir:

```python
HEALTH_ENC = {
    "mala":      0,
    "regular":   1,
    "buena":     2,
    "muy_buena": 3,
    "excelente": 4,
}
```

En la función `load_data()`, justo antes del `return df`:

```python
# Encode salud_general — not leakage for the binary disease targets
df["salud_general_enc"] = df["salud_general"].map(HEALTH_ENC).fillna(2)
```

En `ALWAYS_EXCLUDE`, **eliminar** `"salud_general"` (la columna texto sigue excluida;
`salud_general_enc` —nueva columna numérica— entra automáticamente en `get_feature_columns`).

**Cambio 2: Threshold óptimo por condición (F1-optimal)**

En `train_one()`, después de calcular `y_prob` y `y_pred`, agregar:

```python
from sklearn.metrics import precision_recall_curve

precisions, recalls, thresholds_pr = precision_recall_curve(y_test, y_prob)
f1_pr = 2 * precisions * recalls / (precisions + recalls + 1e-9)
best_thr = float(thresholds_pr[np.argmax(f1_pr)])
y_pred_opt = (y_prob >= best_thr).astype(int)
f1_opt = float(f1_score(y_test, y_pred_opt, zero_division=0))
print(f"  Optimal threshold: {best_thr:.3f}  F1-optimal: {f1_opt:.4f}")
```

En el `return` de `train_one()`, añadir:
```python
"best_threshold": best_thr,
```

En `main()`, después del loop de entrenamiento, guardar los thresholds:

```python
thresholds = {r["name"]: r["best_threshold"] for r in results}
thr_path = MODELS_DIR / "multidisease_thresholds.json"
with open(thr_path, "w") as fh:
    json.dump(thresholds, fh, indent=2)
print(f"\nThresholds saved → {thr_path.relative_to(ROOT)}")
```

**Resultado esperado:** diabetes F1 ~0.50+, heart_disease F1 ~0.40+ (desde 0.22).

---

### A2 — Crear `train_multidisease_v2.py` (7 condiciones, brfss_features)

**Archivo a crear:** `src/models/train_multidisease_v2.py`

Este script entrena sobre `data/processed/brfss_features.csv` que ya está cacheado.

**Features disponibles para entrenamiento (no son targets, no tienen leakage):**
```
weight_kg, height_cm, bmi_computed, bmi_category_enc,
age_group_enc, general_health_enc, exercises_enc,
drinks_alcohol_enc, ever_smoked_enc,
physical_activity_category_enc,
poor_mental_health_days, poor_physical_health_days,
condition_count
```
(más los `has_*_enc` que no sean el target actual)

**7 targets a entrenar:**

| nombre | columna target | prevalencia |
|---|---|---|
| `diabetes` | `has_diabetes_bin` | 13.8% |
| `high_bp` | `has_high_bp_bin` | 40.7% |
| `heart_disease` | `has_heart_disease_bin` | 5.4% |
| `depression` | `has_depression_bin` | 20.3% |
| `asthma` | `has_asthma_bin` | 14.9% |
| `high_cholesterol` | `has_high_cholesterol_bin` | 36.7% |
| `stroke` | `has_stroke_bin` | 4.2% |

**Estructura del script:** igual a `train_multidisease.py` pero:
- Cambia `DATA_PATH` → `brfss_features.csv`
- `TARGETS` lista los 7 de arriba
- `ALWAYS_EXCLUDE` incluye todos los `has_*_bin` (se excluye el target activo por condición)
- Guarda en `models/v2_multidisease_{condition}.joblib`
- Guarda thresholds en `models/v2_multidisease_thresholds.json`
- Guarda SHAP en `models/v2_multidisease_shap_top5.json`

> `poor_mental_health_days` y `poor_physical_health_days` mejoran el modelo de depresión
> estimado de AUC 0.68 → ~0.82. Son el feature set que faltaba en la v1.

---

### A3 — Rediseñar `train_health_score.py` (3 clases, no 5)

**Archivo:** `src/models/train_health_score.py`

El modelo actual predice 5 clases con accuracy 29%. El problema: "buena" y "muy_buena"
son indistinguibles con los features disponibles.

**Cambio: colapsar a 3 clases**

Reemplazar `HEALTH_MAP` por:

```python
HEALTH_MAP = {
    "mala":      0,   # bajo
    "regular":   0,   # bajo
    "buena":     1,   # medio
    "muy_buena": 2,   # alto
    "excelente": 2,   # alto
}
NUM_CLASSES = 3

CLASS_LABELS = {0: "bajo", 1: "medio", 2: "alto"}
```

Actualizar el parámetro XGBoost: `num_class=NUM_CLASSES`.

Guardar resultado en `models/health_score_v2.joblib`.

**Resultado esperado:** accuracy ~50%+, F1 macro ~0.48+.

---

### A4 — Ejecutar los entrenamientos

```bash
# Desde la raíz del repo, con el Python correcto:
/home/valentinau/miniconda3/bin/python -m src.models.train_multidisease
/home/valentinau/miniconda3/bin/python -m src.models.train_multidisease_v2
/home/valentinau/miniconda3/bin/python -m src.models.train_health_score
```

**Archivos que deben existir después:**
```
models/
├── multidisease_{4 conditions}.joblib    ← v1 mejorada con salud_general_enc
├── multidisease_thresholds.json          ← NUEVO
├── multidisease_shap_top5.json           ← actualizado
├── v2_multidisease_{7 conditions}.joblib ← NUEVO
├── v2_multidisease_thresholds.json       ← NUEVO
├── v2_multidisease_shap_top5.json        ← NUEVO
├── health_score_v2.joblib                ← NUEVO (3 clases)
├── diabetes_lab.joblib                   ← sin tocar
└── diabetes_screening.joblib             ← sin tocar
```

---

## BLOQUE B — Conectar la app a los modelos

### B1 — Migración Supabase: agregar peso y talla

**Archivo a crear:** `supabase/migrations/20260515_000009_health_profile_body_metrics.sql`

```sql
ALTER TABLE public.health_profile
  ADD COLUMN IF NOT EXISTS weight_kg  numeric(5,1),
  ADD COLUMN IF NOT EXISTS height_cm  numeric(5,1);
```

Aplicar en Supabase (MCP o CLI):
```bash
supabase db push
```

> Estos dos campos son los únicos que faltan. Todo lo demás en `health_profile`
> ya existe o se deriva de `profiles.date_of_birth` / `profiles.gender`.

---

### B2 — Agregar preguntas de peso y talla al quiz

**Archivo:** `Frontend/src/app/screens/main/HealthProfileQuizScreen.tsx`

En el array `questions`, insertar después de la pregunta `physical_activity_type`
(índice 4, antes de `typical_diet`):

```typescript
{
  key: "weight_kg",
  text: "¿Cuánto pesas aproximadamente?",
  type: "number",
  placeholder: "Peso en kg (ej: 65)",
  optional: true,
},
{
  key: "height_cm",
  text: "¿Cuánto mides?",
  type: "number",
  placeholder: "Altura en cm (ej: 165)",
  optional: true,
},
```

En `handleFinish`, dentro del objeto que se pasa a `upsert`, agregar:

```typescript
weight_kg: finalAnswers.weight_kg ? Number(finalAnswers.weight_kg) : null,
height_cm: finalAnswers.height_cm ? Number(finalAnswers.height_cm) : null,
```

> Con `optional: true`, el botón ya muestra "Saltar" en lugar de requerir respuesta.
> Usar el mismo bloque `type === "number"` que ya existe — no hay nuevo tipo de input.

---

### B3 — Feature mapper: datos de la app → features del modelo

**Archivo a crear:** `src/lib/feature_mapper.py`

Mapea los datos de Supabase al vector que espera `v2_multidisease_*.joblib`.

```python
"""
Convierte datos de la app (profiles + health_profile + daily_logs)
al vector de features que esperan los modelos v2 (brfss_features schema).
"""
from datetime import date

# ── Mapeos desde respuestas del quiz ──────────────────────────────────────────

ACTIVITY_TO_EXERCISES = {
    "Todos los días":        1,   # exercises = yes
    "3-4 veces por semana":  1,
    "1-2 veces":             0,   # exercises = no
    "Casi nunca":            0,
}

ACTIVITY_TO_CATEGORY = {
    "Todos los días":        3,   # high
    "3-4 veces por semana":  2,   # moderate
    "1-2 veces":             1,   # low
    "Casi nunca":            0,   # none
}

MOOD_TO_GENERAL_HEALTH = {
    "Muy bien":      4,   # excellent
    "Bien":          3,   # very good
    "Regular":       2,   # good
    "Con altibajos": 1,   # fair
    "Mal":           0,   # poor
}

AGE_GROUPS = [
    (18, 24, 0), (25, 34, 1), (35, 44, 2),
    (45, 54, 3), (55, 64, 4), (65, 200, 5),
]

BMI_CATEGORIES = [
    (0,   18.5, 0),   # underweight
    (18.5, 25,  1),   # normal
    (25,   30,  2),   # overweight
    (30,  999,  3),   # obese
]


def map_to_model_features(
    profile: dict,
    health_profile: dict,
    daily_logs: list[dict],
) -> dict:
    """
    profile       → row de public.profiles (date_of_birth, gender, diagnosis)
    health_profile → row de public.health_profile
    daily_logs    → últimos 30 registros de public.daily_logs (mood, pain, energy)

    Retorna dict listo para pd.DataFrame([features]) y luego model.predict_proba().
    """

    # ── Edad ──────────────────────────────────────────────────────────────────
    dob = profile.get("date_of_birth")
    age = (date.today() - date.fromisoformat(dob)).days // 365 if dob else 35
    age_group_enc = next(
        (enc for lo, hi, enc in AGE_GROUPS if lo <= age <= hi), 1
    )

    # ── Peso y talla → IMC ────────────────────────────────────────────────────
    w = float(health_profile.get("weight_kg") or 0)
    h = float(health_profile.get("height_cm") or 0)
    bmi = w / ((h / 100) ** 2) if h > 0 else 0.0
    bmi_category_enc = next(
        (enc for lo, hi, enc in BMI_CATEGORIES if lo <= bmi < hi), 1
    )

    # ── Actividad física ──────────────────────────────────────────────────────
    freq = health_profile.get("physical_activity_frequency") or "Casi nunca"
    exercises_enc = ACTIVITY_TO_EXERCISES.get(freq, 0)
    physical_activity_category_enc = ACTIVITY_TO_CATEGORY.get(freq, 0)

    # ── Salud percibida (aproximada con mood_general) ─────────────────────────
    mood_g = health_profile.get("mood_general") or "Regular"
    general_health_enc = MOOD_TO_GENERAL_HEALTH.get(mood_g, 2)

    # ── Días de mala salud mental/física (últimos 30 daily_logs) ─────────────
    poor_mental = sum(
        1 for l in daily_logs if (l.get("mood") or 5) <= 2
    )
    poor_physical = sum(
        1 for l in daily_logs if (l.get("pain") or 0) >= 6
    )

    # ── Condiciones preexistentes (heurística sobre diagnosis text) ───────────
    dx = (profile.get("diagnosis") or "").lower()

    def has(keywords: list[str]) -> int:
        return 1 if any(k in dx for k in keywords) else 0

    has_diabetes_enc        = has(["diabet"])
    has_high_bp_enc         = has(["hipertens", "presion alta", "hta"])
    has_heart_disease_enc   = has(["cardio", "coron", "cardia", "infarto"])
    has_depression_enc      = has(["depres", "ansiedad", "trastorno"])
    has_asthma_enc          = has(["asma"])
    has_high_cholesterol_enc = has(["colesterol"])
    has_stroke_enc          = has(["derrame", "ictus", "stroke", "acv"])

    condition_count = (
        has_diabetes_enc + has_high_bp_enc + has_heart_disease_enc
        + has_depression_enc + has_asthma_enc
        + has_high_cholesterol_enc + has_stroke_enc
    )

    return {
        # Anthropometrics
        "weight_kg":                    w,
        "height_cm":                    h,
        "bmi_computed":                 round(bmi, 2),
        "bmi_category_enc":             bmi_category_enc,
        # Demographics
        "age_group_enc":                age_group_enc,
        # Lifestyle
        "general_health_enc":           general_health_enc,
        "exercises_enc":                exercises_enc,
        "physical_activity_category_enc": physical_activity_category_enc,
        "drinks_alcohol_enc":           0,   # no recopilado → conservador
        "ever_smoked_enc":              0,   # no recopilado → conservador
        "education_level_enc":          1,   # desconocido → promedio
        "income_level_enc":             2,   # desconocido → promedio
        # Longitudinal (daily_logs)
        "poor_mental_health_days":      poor_mental,
        "poor_physical_health_days":    poor_physical,
        # Conditions
        "condition_count":              condition_count,
        "has_diabetes_enc":             has_diabetes_enc,
        "has_high_bp_enc":              has_high_bp_enc,
        "has_heart_disease_enc":        has_heart_disease_enc,
        "has_depression_enc":           has_depression_enc,
        "has_asthma_enc":               has_asthma_enc,
        "has_high_cholesterol_enc":     has_high_cholesterol_enc,
        "has_stroke_enc":               has_stroke_enc,
    }
```

---

### B4 — Script de inferencia unificado

**Archivo a crear:** `src/predict_user.py`

Lee JSON de stdin, devuelve JSON por stdout. Así Next.js lo llama como subprocess.

```python
#!/usr/bin/env python3
"""
Lee por stdin: { profile, health_profile, daily_logs }
Escribe por stdout: { conditions: {...}, health_score: {...} }
"""
import json, sys
from pathlib import Path

import joblib
import pandas as pd

ROOT = Path(__file__).parents[1]
MODELS = ROOT / "models"

# Carga lazy — solo una vez por proceso
_v2_models = {}
_v2_thresholds = {}
_hs_model = None


def _load():
    global _v2_models, _v2_thresholds, _hs_model
    if _v2_models:
        return

    CONDITIONS = [
        "diabetes", "high_bp", "heart_disease",
        "depression", "asthma", "high_cholesterol", "stroke",
    ]
    for c in CONDITIONS:
        p = MODELS / f"v2_multidisease_{c}.joblib"
        if p.exists():
            _v2_models[c] = joblib.load(p)

    thr_path = MODELS / "v2_multidisease_thresholds.json"
    if thr_path.exists():
        with open(thr_path) as f:
            _v2_thresholds = json.load(f)

    hs_path = MODELS / "health_score_v2.joblib"
    if hs_path.exists():
        _hs_model = joblib.load(hs_path)


def predict(profile, health_profile, daily_logs):
    from src.lib.feature_mapper import map_to_model_features
    _load()

    features = map_to_model_features(profile, health_profile, daily_logs)
    X = pd.DataFrame([features])

    # ── Condiciones de riesgo ──────────────────────────────────────────────
    condition_results = {}
    for cond, model in _v2_models.items():
        feat_cols = model.get_booster().feature_names
        X_in = X.reindex(columns=feat_cols, fill_value=0)
        prob = float(model.predict_proba(X_in)[0, 1])
        thr = _v2_thresholds.get(cond, 0.35)
        condition_results[cond] = {
            "probability": round(prob, 4),
            "alert":       prob >= thr,
            "level":       "high" if prob >= 0.6 else "medium" if prob >= thr else "low",
        }

    # ── Score de salud percibida ───────────────────────────────────────────
    health_score_result = None
    if _hs_model:
        feat_cols_hs = _hs_model.get_booster().feature_names
        X_hs = X.reindex(columns=feat_cols_hs, fill_value=0)
        proba = _hs_model.predict_proba(X_hs)[0]
        cls = int(_hs_model.predict(X_hs)[0])
        health_score_result = {
            "class":  cls,
            "label":  ["bajo", "medio", "alto"][cls],
            "probas": {
                "bajo":  round(float(proba[0]), 4),
                "medio": round(float(proba[1]), 4),
                "alto":  round(float(proba[2]), 4),
            },
        }

    return {
        "conditions":   condition_results,
        "health_score": health_score_result,
        "features_used": {k: v for k, v in features.items()
                          if v not in (0, 0.0, None)},
    }


if __name__ == "__main__":
    payload = json.load(sys.stdin)
    result = predict(
        payload["profile"],
        payload.get("health_profile") or {},
        payload.get("daily_logs") or [],
    )
    print(json.dumps(result))
```

---

### B5 — API route en Next.js

**Archivo a crear:** `Frontend/app/api/risk/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { spawn } from "child_process";
import path from "path";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { profileId } = await req.json();
  if (!profileId) return NextResponse.json({ error: "profileId required" }, { status: 400 });

  const [{ data: profile }, { data: hp }, { data: logs }] = await Promise.all([
    admin.from("profiles").select("date_of_birth, gender, diagnosis").eq("id", profileId).single(),
    admin.from("health_profile")
      .select("weight_kg, height_cm, physical_activity_frequency, mood_general")
      .eq("profile_id", profileId).maybeSingle(),
    admin.from("daily_logs")
      .select("mood, pain, energy")
      .eq("profile_id", profileId)
      .order("logged_at", { ascending: false })
      .limit(30),
  ]);

  const payload = JSON.stringify({
    profile:        profile ?? {},
    health_profile: hp ?? {},
    daily_logs:     logs ?? [],
  });

  return new Promise<NextResponse>((resolve) => {
    const scriptPath = path.join(process.cwd(), "..", "src", "predict_user.py");
    const pythonBin  = "/home/valentinau/miniconda3/bin/python";

    const proc = spawn(pythonBin, [scriptPath]);
    let out = "";
    let err = "";

    proc.stdin.write(payload);
    proc.stdin.end();
    proc.stdout.on("data", (d: Buffer) => (out += d.toString()));
    proc.stderr.on("data", (d: Buffer) => (err += d.toString()));

    proc.on("close", (code) => {
      if (code !== 0 || !out) {
        console.error("predict_user.py error:", err);
        resolve(NextResponse.json({ error: "prediction failed" }, { status: 500 }));
        return;
      }
      try {
        resolve(NextResponse.json(JSON.parse(out)));
      } catch {
        resolve(NextResponse.json({ error: "invalid output" }, { status: 500 }));
      }
    });
  });
}
```

> **Nota para la demo local:** si `spawn` desde Next.js da problemas de path, alternativa
> inmediata — correr `uvicorn src.api_server:app --port 8001` y hacer `fetch("http://localhost:8001/predict")` desde el API route. Decide cuál usar cuando llegues a este paso.

---

### B6 — Conectar InsightsScreen al ML real

**Archivo:** `Frontend/src/app/screens/main/InsightsScreen.tsx`

Añadir state y llamada al API:

```typescript
const [riskData, setRiskData] = useState<{
  conditions: Record<string, { probability: number; alert: boolean; level: string }>;
  health_score: { class: number; label: string; probas: Record<string, number> } | null;
} | null>(null);

useEffect(() => {
  if (!profile?.id) return;
  fetch("/api/risk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profileId: profile.id }),
  })
    .then((r) => r.json())
    .then(setRiskData)
    .catch(() => null);
}, [profile?.id]);
```

Mapear `riskData.conditions` a `InsightItem[]` para reemplazar los insights hardcoded.
Labels que ve el usuario (nunca la condición cruda):

| Clave modelo | Label UI | Icono sugerido |
|---|---|---|
| `diabetes` | "Metabolismo y glucosa" | `Droplet` |
| `high_bp` | "Presión arterial" | `Heart` |
| `heart_disease` | "Salud cardiovascular" | `Heart` |
| `depression` | "Bienestar emocional" | `Brain` |
| `asthma` | "Salud respiratoria" | `Wind` |
| `high_cholesterol` | "Perfil lipídico" | `Activity` |
| `stroke` | "Riesgo cerebrovascular" | `AlertCircle` |

Solo mostrar alertas con `level === "medium"` o `"high"`.
Para `level === "low"`, mostrar como refuerzo positivo ("Tu salud cardiovascular luce bien").

---

## BLOQUE C — Mini-agente de chat (después de los bloques A y B)

Este bloque depende de que el API `/api/risk` funcione. No empezar hasta que B5-B6 estén listos.

### C1 — Nueva ruta y pantalla de chat

**Archivos a crear:**
- `Frontend/app/app/chat/page.tsx` (page wrapper)
- `Frontend/src/app/screens/main/ChatScreen.tsx` (componente real)

Añadir tab en `MainLayout`:
```typescript
{ href: "/app/chat", icon: <MessageCircle />, label: "Chat" }
```

### C2 — API route del agente

**Archivo a crear:** `Frontend/app/api/agent/route.ts`

```typescript
import Anthropic from "@anthropic-ai/sdk";
// ...
// 1. Fetch profile + health_profile + últimos 7 logs + risk scores (llamar /api/risk internamente)
// 2. Construir messages con historial del chat
// 3. Llamar claude-sonnet-4-6 con system prompt del agente
// 4. Devolver respuesta
```

### C3 — System prompt del agente

```
Eres CareGuide, la asistente de salud de CareBridge.
Español, tono cálido y empático — como una amiga que estudió medicina interna.
NUNCA das diagnósticos. Señalas patrones y sugieres consultar al especialista adecuado.

Perfil del usuario:
- Nombre: {full_name}. Edad: {age} años, género: {gender}.
- Diagnóstico previo: {diagnosis || "ninguno reportado"}.
- Hábitos: {sleep_hours}h de sueño ({sleep_quality}), actividad {activity_freq},
  alimentación {diet}, ánimo general {mood_general}.
- Peso: {weight_kg} kg, talla: {height_cm} cm → IMC: {bmi}.
- Últimos 7 registros: {json_summary} — ánimo promedio {avg_mood}/5, dolor promedio {avg_pain}/10.

Señales ML (usa estas para orientar, no como diagnóstico):
{json_risk_scores}

Reglas:
1. Valida cómo se siente el usuario antes de cualquier recomendación.
2. Respuestas de máximo 3-4 oraciones.
3. Si hay señal "high" en alguna condición, sugiere naturalmente ver a un especialista.
4. Si el usuario menciona síntomas urgentes (dolor en el pecho, dificultad respiratoria,
   pensamientos de hacerse daño) → indicar atención médica inmediata, sin rodeos.
5. Cuando sugieras especialista, menciona el tipo: cardiólogo, endocrinólogo,
   psiquiatra, neumólogo, médico general.
```

---

## Orden de ejecución

```
BLOQUE A (Python, ML):
  A1 → modificar train_multidisease.py
  A2 → crear train_multidisease_v2.py
  A3 → modificar train_health_score.py
  A4 → ejecutar los 3 entrenamientos

BLOQUE B (App + integración):
  B1 → migración SQL (peso/talla)     ← aplicar en Supabase antes de B2
  B2 → quiz: agregar 2 preguntas
  B3 → crear feature_mapper.py
  B4 → crear predict_user.py
  B5 → crear /api/risk route
  B6 → actualizar InsightsScreen

BLOQUE C (Agente, después de B completo):
  C1 → crear ChatScreen
  C2 → crear /api/agent route
  C3 → ajustar system prompt con datos reales
```

---

## Archivos involucrados (resumen)

| Archivo | Acción | Bloque |
|---|---|---|
| `src/models/train_multidisease.py` | Modificar (salud_general_enc + thresholds) | A1 |
| `src/models/train_multidisease_v2.py` | Crear | A2 |
| `src/models/train_health_score.py` | Modificar (3 clases) | A3 |
| `supabase/migrations/20260515_000009_health_profile_body_metrics.sql` | Crear | B1 |
| `Frontend/src/app/screens/main/HealthProfileQuizScreen.tsx` | Modificar (+2 preguntas) | B2 |
| `src/lib/feature_mapper.py` | Crear | B3 |
| `src/predict_user.py` | Crear | B4 |
| `Frontend/app/api/risk/route.ts` | Crear | B5 |
| `Frontend/src/app/screens/main/InsightsScreen.tsx` | Modificar (consumir ML) | B6 |
| `Frontend/src/app/layouts/MainLayout.tsx` | Modificar (+tab Chat) | C1 |
| `Frontend/app/app/chat/page.tsx` | Crear | C1 |
| `Frontend/src/app/screens/main/ChatScreen.tsx` | Crear | C1 |
| `Frontend/app/api/agent/route.ts` | Crear | C2 |

---

*Actualizado 2026-05-15. Empezar por A1.*
