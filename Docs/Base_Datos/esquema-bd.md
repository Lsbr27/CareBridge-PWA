# Esquema de Base de Datos

## Schemas disponibles

| Schema | Descripción |
|--------|-------------|
| `public` | Datos operativos del MVP (pacientes, citas, medicamentos, logs) |
| `ml_data` | Datasets de entrenamiento del pipeline de alertas ML |

---

## Schema `public`

### `public.profiles`

Una fila por usuario autenticado en Supabase. Se crea automáticamente al registrarse via trigger.

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | `uuid` PK | Referencia a `auth.users(id)` |
| `full_name` | `text` | |
| `date_of_birth` | `date` | |
| `gender` | `text` | |
| `diagnosis` | `text` | |
| `sleep_quality` | `smallint` | Escala 1–5 |
| `exercise_frequency` | `text` | |
| `diet_notes` | `text` | |
| `has_medications` | `boolean` | Default `false` |
| `has_upcoming_appointment` | `boolean` | Default `false` |
| `pending_lab` | `boolean` | Default `false` |
| `location` | `text` | Agregado en migración 000005 |
| `phone` | `text` | Agregado en migración 000006 |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | Auto-actualizado por trigger |

**Índices:** ninguno adicional (PK es suficiente).

---

### `public.health_profile`

Perfil de salud extendido (hábitos de sueño, actividad, dieta, salud reproductiva). Una fila por usuario.

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `profile_id` | `uuid` UNIQUE | FK → `profiles(id)` cascade delete |
| `sleep_hours` | `numeric(4,1)` | |
| `sleep_quality` | `text` | |
| `wake_up_feeling` | `text` | |
| `physical_activity_frequency` | `text` | |
| `physical_activity_type` | `text` | |
| `typical_diet` | `text` | |
| `meal_times` | `text` | |
| `contraceptives` | `text` | |
| `menstrual_cycle` | `text` | |
| `sexual_activity` | `text` | |
| `mood_general` | `text` | |
| `stress_level` | `text` | |
| `profession` | `text` | |
| `work_schedule` | `text` | |
| `daily_routine` | `text` | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

---

### `public.medications`

Medicamentos activos o históricos de un paciente.

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | `uuid` PK | |
| `profile_id` | `uuid` | FK → `profiles(id)` cascade delete |
| `name` | `text` | Obligatorio |
| `dosage` | `text` | |
| `schedule_time` | `time` | |
| `frequency` | `text` | |
| `status` | `text` | `pending` · `taken` · `skipped` |
| `notes` | `text` | |
| `start_date` | `date` | |
| `end_date` | `date` | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

**Índice:** `(profile_id, schedule_time)`

---

### `public.appointments`

Citas de control o seguimiento clínico.

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | `uuid` PK | |
| `profile_id` | `uuid` | FK → `profiles(id)` cascade delete |
| `title` | `text` | Default `'Control appointment'` |
| `appointment_at` | `timestamptz` | Obligatorio |
| `provider_name` | `text` | |
| `location` | `text` | |
| `notes` | `text` | |
| `status` | `text` | `scheduled` · `completed` · `cancelled` · `missed` |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

**Índice:** `(profile_id, appointment_at DESC)`

---

### `public.daily_logs`

Registro diario de síntomas y bienestar.

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | `uuid` PK | |
| `profile_id` | `uuid` | FK → `profiles(id)` cascade delete |
| `appointment_id` | `uuid` nullable | FK → `appointments(id)` set null on delete |
| `logged_at` | `timestamptz` | Default `now()` |
| `symptoms` | `text[]` | Array de síntomas, default `{}` |
| `mood` | `smallint` | Escala 1–5 |
| `energy` | `smallint` | Escala 1–5 |
| `pain` | `smallint` | Escala 0–10 |
| `sleep_hours` | `numeric(4,1)` | |
| `notes` | `text` | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

**Índice:** `(profile_id, logged_at DESC)`

---

## Schema `ml_data`

Datasets de entrenamiento para el pipeline de alertas de salud. Solo lectura para usuarios autenticados (`GRANT SELECT`).

### `ml_data.pima_diabetes`

Dataset PIMA de diabetes (768 filas).

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | `serial` PK | |
| `pregnancies` | `integer` | |
| `glucose` | `numeric(6,2)` | |
| `blood_pressure` | `numeric(6,2)` | |
| `skin_thickness` | `numeric(6,2)` | |
| `insulin` | `numeric(8,2)` | |
| `bmi` | `numeric(5,2)` | |
| `diabetes_pedigree_function` | `numeric(6,4)` | |
| `age` | `integer` | |
| `has_diabetes` | `smallint` | 0 = No, 1 = Sí |

---

### `ml_data.sleep_health`

Sleep Health & Lifestyle Dataset (374 filas).

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | `serial` PK | |
| `person_id` | `integer` | |
| `age` | `integer` | |
| `gender` | `text` | |
| `occupation` | `text` | |
| `sleep_duration` | `numeric(4,2)` | Horas |
| `quality_of_sleep` | `smallint` | Escala 1–10 |
| `physical_activity_level` | `smallint` | |
| `stress_level` | `smallint` | Escala 1–10 |
| `bmi_category` | `text` | |
| `heart_rate` | `smallint` | |
| `daily_steps` | `integer` | |
| `sleep_disorder` | `text` | |
| `systolic_bp` | `smallint` | |
| `diastolic_bp` | `smallint` | |
| `gender_enc` | `smallint` | Encoded |
| `occupation_enc` | `smallint` | Encoded |
| `bmi_category_enc` | `smallint` | Encoded |
| `sleep_disorder_enc` | `smallint` | Encoded |
| `sleep_risk` | `smallint` | 0/1 |
| `high_stress` | `smallint` | 0/1 |
| `hypertension_proxy` | `smallint` | 0/1 |

---

### `ml_data.unified_features`

Dataset combinado PIMA + Sleep para el modelo de alertas (1 142 filas).

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | `serial` PK | |
| `age` | `numeric(5,2)` | |
| `bmi` | `numeric(5,2)` | |
| `systolic_bp` | `numeric(6,2)` | |
| `glucose` | `numeric(7,2)` | |
| `high_glucose` | `smallint` | 0/1 |
| `high_bp` | `smallint` | 0/1 |
| `obese` | `smallint` | 0/1 |
| `alert_diabetes` | `smallint` | 0/1 — target de alerta |
| `alert_hypertension` | `smallint` | 0/1 — target de alerta |
| `source` | `text` | `'pima'` o `'sleep'` |
| `gender_male` | `smallint` | 0/1 |
| `diastolic_bp` | `numeric(6,2)` | |
| `heart_rate` | `numeric(6,2)` | |
| `sleep_hours` | `numeric(4,2)` | |
| `physical_activity` | `numeric(7,2)` | |
| `daily_steps` | `numeric(9,2)` | |
| `stress_level` | `numeric(5,2)` | |
| `sleep_risk` | `smallint` | 0/1 |
| `high_stress` | `smallint` | 0/1 |
| `low_activity` | `smallint` | 0/1 |
| `alert_sleep` | `smallint` | 0/1 — target de alerta |
| `alert_heart` | `smallint` | 0/1 — target de alerta |

---

## Relaciones entre tablas

```
auth.users
    └── profiles (1:1, cascade delete)
            ├── health_profile (1:1, cascade delete)
            ├── medications (1:N, cascade delete)
            ├── appointments (1:N, cascade delete)
            └── daily_logs (1:N, cascade delete)
                    └── appointments (N:1, set null on delete)
```

---

## Seguridad (RLS)

Todas las tablas del schema `public` tienen Row Level Security activa. Cada usuario solo accede a sus propias filas.

| Tabla | Política |
|-------|----------|
| `profiles` | `auth.uid() = id` |
| `health_profile` | `profile_id = auth.uid()` |
| `medications` | `auth.uid() = profile_id` |
| `appointments` | `auth.uid() = profile_id` |
| `daily_logs` | `auth.uid() = profile_id` |
| `ml_data.*` | Solo `SELECT`, sin RLS por fila (datos públicos de entrenamiento) |

---

## Historial de migraciones

| Archivo | Descripción |
|---------|-------------|
| `20260409_000001_init_core_tables.sql` | Tablas base: `profiles`, `appointments`, `medications`, `daily_logs` + RLS + triggers |
| `20260409_000002_fix_set_updated_at_search_path.sql` | Fix search path de la función `set_updated_at` |
| `20260409_000003_create_profile_on_auth_signup.sql` | Trigger para crear `profiles` al registrarse |
| `20260417_000004_health_profile.sql` | Tabla `health_profile` con hábitos extendidos |
| `20260424_000005_add_profile_location.sql` | Columna `location` en `profiles` |
| `20260424_000006_add_profile_phone.sql` | Columna `phone` en `profiles` |
| `20260506_000007_ml_data_schema.sql` | Schema `ml_data` con 3 tablas de entrenamiento ML |
