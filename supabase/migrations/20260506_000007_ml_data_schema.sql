-- ─────────────────────────────────────────────────────────────
-- Schema ml_data — datasets de entrenamiento del pipeline de ML
-- Contiene: pima_diabetes, sleep_health, unified_features
-- ─────────────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS ml_data;

-- Dar acceso de lectura a usuarios autenticados
GRANT USAGE ON SCHEMA ml_data TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- PIMA Diabetes Dataset (768 filas)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ml_data.pima_diabetes (
  id                        serial primary key,
  pregnancies               integer,
  glucose                   numeric(6,2),
  blood_pressure            numeric(6,2),
  skin_thickness            numeric(6,2),
  insulin                   numeric(8,2),
  bmi                       numeric(5,2),
  diabetes_pedigree_function numeric(6,4),
  age                       integer,
  has_diabetes              smallint   -- 0 = No, 1 = Yes
);

GRANT SELECT ON ml_data.pima_diabetes TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- Sleep Health & Lifestyle Dataset (374 filas)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ml_data.sleep_health (
  id                      serial primary key,
  person_id               integer,
  age                     integer,
  gender                  text,
  occupation              text,
  sleep_duration          numeric(4,2),
  quality_of_sleep        smallint,       -- 1–10
  physical_activity_level smallint,
  stress_level            smallint,       -- 1–10
  bmi_category            text,
  heart_rate              smallint,
  daily_steps             integer,
  sleep_disorder          text,
  systolic_bp             smallint,
  diastolic_bp            smallint,
  gender_enc              smallint,
  occupation_enc          smallint,
  bmi_category_enc        smallint,
  sleep_disorder_enc      smallint,
  sleep_risk              smallint,       -- 0/1
  high_stress             smallint,       -- 0/1
  hypertension_proxy      smallint        -- 0/1
);

GRANT SELECT ON ml_data.sleep_health TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- Unified Features — dataset combinado para el modelo de alertas
-- (PIMA + Sleep, 1 142 filas)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ml_data.unified_features (
  id                 serial primary key,
  age                numeric(5,2),
  bmi                numeric(5,2),
  systolic_bp        numeric(6,2),
  glucose            numeric(7,2),
  high_glucose       smallint,        -- 0/1
  high_bp            smallint,        -- 0/1
  obese              smallint,        -- 0/1
  alert_diabetes     smallint,        -- 0/1
  alert_hypertension smallint,        -- 0/1
  source             text,            -- 'pima' | 'sleep'
  gender_male        smallint,        -- 0/1
  diastolic_bp       numeric(6,2),
  heart_rate         numeric(6,2),
  sleep_hours        numeric(4,2),
  physical_activity  numeric(7,2),
  daily_steps        numeric(9,2),
  stress_level       numeric(5,2),
  sleep_risk         smallint,        -- 0/1
  high_stress        smallint,        -- 0/1
  low_activity       smallint,        -- 0/1
  alert_sleep        smallint,        -- 0/1
  alert_heart        smallint         -- 0/1
);

GRANT SELECT ON ml_data.unified_features TO authenticated;
