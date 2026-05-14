-- ─────────────────────────────────────────────────────────────
-- Schema ml_data — BRFSS 2023 (CDC)
-- Behavioral Risk Factor Surveillance System
-- Contiene: brfss_clean (legible), brfss_features (para ML)
-- ─────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────
-- BRFSS Clean — variables legibles en español (~387k filas)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ml_data.brfss_clean (
  id                              serial primary key,

  -- Salud general y hábitos
  salud_general                   text,        -- 'excelente','muy_buena','buena','regular','mala'
  ejercicio_ultimo_mes            text,        -- 'si' / 'no'
  consumo_alcohol                 text,        -- 'si' / 'no'
  categoria_imc                   text,        -- 'bajo_peso','normal','sobrepeso','obeso'

  -- Demografía
  grupo_edad                      text,        -- '18-24','25-34',...,'65+'
  sexo                            text,        -- 'masculino' / 'femenino'
  altura_cm                       numeric(5,1),
  peso_kg                         numeric(5,2),

  -- Condiciones crónicas (texto)
  tiene_diabetes                  text,        -- 'si','no','pre_diabetes','solo_embarazo'
  tiene_cardiopatia_coronaria     text,
  tiene_depresion                 text,
  tiene_cancer_piel               text,
  tiene_otro_cancer               text,
  tiene_artritis                  text,
  tiene_asma                      text,

  -- Target general
  riesgo_salud                    smallint,    -- 0=bajo, 1=medio, 2=alto
  riesgo_salud_label              text,        -- 'bajo','medio','alto'

  -- Versiones codificadas (enteros para ML)
  ejercicio_ultimo_mes_enc        smallint,
  consumo_alcohol_enc             smallint,
  categoria_imc_enc               smallint,
  grupo_edad_enc                  smallint,
  sexo_enc                        smallint,
  tiene_diabetes_enc              smallint,
  tiene_cardiopatia_coronaria_enc smallint,
  tiene_depresion_enc             smallint,
  tiene_cancer_piel_enc           smallint,
  tiene_otro_cancer_enc           smallint,
  tiene_artritis_enc              smallint,
  tiene_asma_enc                  smallint
);

GRANT SELECT ON ml_data.brfss_clean TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- BRFSS Features — variables numéricas + targets por enfermedad
-- (~432k filas)
--
-- Columnas riesgo_*: nivel de riesgo por enfermedad específica
--   0 = bajo   → sin factores de riesgo relevantes
--   1 = medio  → factores de riesgo presentes, sin diagnóstico
--   2 = alto   → diagnóstico confirmado en la encuesta
--
-- Diseñadas para entrenar modelos de alerta por enfermedad a futuro.
-- Reglas documentadas en Data/notebooks/compute_disease_risk.py
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ml_data.brfss_features (
  id                              serial primary key,

  -- Medidas físicas
  weight_kg                       numeric(5,2),
  height_cm                       numeric(5,1),
  bmi_computed                    numeric(5,2),

  -- Salud mental y física
  poor_mental_health_days         numeric(4,1),   -- días/mes (88 = no aplica)
  poor_physical_health_days       numeric(4,1),

  -- Condiciones crónicas binarias (0/1)
  has_diabetes_bin                smallint,
  has_high_bp_bin                 smallint,
  has_heart_disease_bin           smallint,
  has_depression_bin              smallint,
  has_asthma_bin                  smallint,
  has_high_cholesterol_bin        smallint,
  has_stroke_bin                  smallint,
  condition_count                 numeric(4,1),

  -- Variables codificadas para ML
  age_group_enc                   smallint,
  bmi_category_enc                smallint,
  general_health_enc              smallint,
  exercises_enc                   smallint,
  drinks_alcohol_enc              smallint,
  ever_smoked_enc                 smallint,
  physical_activity_category_enc  smallint,
  education_level_enc             smallint,
  income_level_enc                smallint,
  has_diabetes_enc                smallint,
  has_high_bp_enc                 smallint,
  has_heart_disease_enc           smallint,
  has_depression_enc              smallint,
  has_asthma_enc                  smallint,
  has_high_cholesterol_enc        smallint,
  has_stroke_enc                  smallint,

  -- ── Targets por enfermedad (para modelos futuros) ──────────
  -- 0=bajo  1=medio  2=alto
  riesgo_diabetes                 smallint,
  riesgo_hipertension             smallint,
  riesgo_cardiopatia              smallint,
  riesgo_depresion                smallint,
  riesgo_asma                     smallint,
  riesgo_colesterol               smallint
);

GRANT SELECT ON ml_data.brfss_features TO authenticated;
