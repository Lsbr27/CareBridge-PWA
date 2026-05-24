"""
Converts app data (profiles + health_profile + daily_logs) into the feature
vector expected by v2_multidisease_*.joblib and health_score_v2.joblib.

All mappings target the brfss_features.csv schema (English column names).
"""

from datetime import date

# ── Activity mappings ──────────────────────────────────────────────────────────

ACTIVITY_TO_EXERCISES = {
    "Todos los días":        1,
    "3-4 veces por semana":  1,
    "1-2 veces":             0,
    "Casi nunca":            0,
}

ACTIVITY_TO_CATEGORY = {
    "Todos los días":        3,   # high
    "3-4 veces por semana":  2,   # moderate
    "1-2 veces":             1,   # low
    "Casi nunca":            0,   # none
}

# ── Mood → perceived health ────────────────────────────────────────────────────

MOOD_TO_GENERAL_HEALTH = {
    "Muy bien":      4,   # excellent
    "Bien":          3,   # very good
    "Regular":       2,   # good
    "Con altibajos": 1,   # fair
    "Mal":           0,   # poor
}

# ── Age groups (BRFSS encoding) ────────────────────────────────────────────────

AGE_GROUPS = [
    (18, 24,  0),
    (25, 34,  1),
    (35, 44,  2),
    (45, 54,  3),
    (55, 64,  4),
    (65, 200, 5),
]

# ── BMI categories ─────────────────────────────────────────────────────────────

BMI_CATEGORIES = [
    (0,    18.5, 0),   # underweight
    (18.5, 25.0, 1),   # normal
    (25.0, 30.0, 2),   # overweight
    (30.0, 999,  3),   # obese
]


def map_to_model_features(
    profile: dict,
    health_profile: dict,
    daily_logs: list[dict],
) -> dict:
    """
    profile        — row from public.profiles  (date_of_birth, gender, diagnosis)
    health_profile — row from public.health_profile
    daily_logs     — last 30 rows from public.daily_logs (mood 1-5, pain 0-10)

    Returns a flat dict ready for pd.DataFrame([features]) → model.predict_proba().
    Unknown/missing values fall back to population-level neutral defaults.
    """

    # ── Age ───────────────────────────────────────────────────────────────────
    dob = profile.get("date_of_birth")
    if dob:
        try:
            age = (date.today() - date.fromisoformat(str(dob))).days // 365
        except ValueError:
            age = 35
    else:
        age = 35

    age_group_enc = next(
        (enc for lo, hi, enc in AGE_GROUPS if lo <= age <= hi), 1
    )

    # ── Anthropometrics → BMI ────────────────────────────────────────────────
    w = float(health_profile.get("weight_kg") or 0)
    h = float(health_profile.get("height_cm") or 0)
    bmi = w / ((h / 100) ** 2) if h > 0 and w > 0 else 0.0
    bmi_category_enc = next(
        (enc for lo, hi, enc in BMI_CATEGORIES if lo <= bmi < hi), 1
    )

    # ── Activity ─────────────────────────────────────────────────────────────
    freq = health_profile.get("physical_activity_frequency") or "Casi nunca"
    exercises_enc = ACTIVITY_TO_EXERCISES.get(freq, 0)
    physical_activity_category_enc = ACTIVITY_TO_CATEGORY.get(freq, 0)

    # ── Perceived health (approximated from mood_general) ────────────────────
    mood_g = health_profile.get("mood_general") or "Regular"
    general_health_enc = MOOD_TO_GENERAL_HEALTH.get(mood_g, 2)

    # ── Days of poor mental/physical health (last 30 daily_logs) ────────────
    # mood scale 1-5: ≤2 = bad mental health day
    # pain scale 0-10: ≥6 = bad physical health day
    poor_mental = sum(
        1 for log in daily_logs if (log.get("mood") or 5) <= 2
    )
    poor_physical = sum(
        1 for log in daily_logs if (log.get("pain") or 0) >= 6
    )

    # ── Pre-existing conditions (keyword match on profiles.diagnosis) ────────
    dx = (profile.get("diagnosis") or "").lower()

    def has(keywords: list) -> int:
        return 1 if any(k in dx for k in keywords) else 0

    # BRFSS encoding: 1=yes, 2=no (original survey encoding)
    # We store 1 for yes to match how has_*_enc works in brfss_features
    has_diabetes_enc         = has(["diabet"])
    has_high_bp_enc          = has(["hipertens", "presion alta", "hta"])
    has_heart_disease_enc    = has(["cardio", "coron", "cardia", "infarto"])
    has_depression_enc       = has(["depres", "ansiedad", "trastorno"])
    has_asthma_enc           = has(["asma"])
    has_high_cholesterol_enc = has(["colesterol"])
    has_stroke_enc           = has(["derrame", "ictus", "stroke", "acv"])

    return {
        # Anthropometrics
        "weight_kg":                      w,
        "height_cm":                      h,
        "bmi_computed":                   round(bmi, 2),
        "bmi_category_enc":               bmi_category_enc,
        # Demographics
        "age_group_enc":                  age_group_enc,
        # Lifestyle
        "general_health_enc":             general_health_enc,
        "exercises_enc":                  exercises_enc,
        "physical_activity_category_enc": physical_activity_category_enc,
        "drinks_alcohol_enc":             0,   # not collected → conservative default
        "ever_smoked_enc":                0,   # not collected → conservative default
        "education_level_enc":            1,   # unknown → mid-range
        "income_level_enc":               2,   # unknown → mid-range
        # Longitudinal (daily_logs)
        "poor_mental_health_days":        poor_mental,
        "poor_physical_health_days":      poor_physical,
        # Conditions (from free-text diagnosis field)
        "has_diabetes_enc":               has_diabetes_enc,
        "has_high_bp_enc":               has_high_bp_enc,
        "has_heart_disease_enc":          has_heart_disease_enc,
        "has_depression_enc":             has_depression_enc,
        "has_asthma_enc":                has_asthma_enc,
        "has_high_cholesterol_enc":       has_high_cholesterol_enc,
        "has_stroke_enc":                 has_stroke_enc,
    }
