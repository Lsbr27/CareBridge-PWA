"""
PASO 6 — Esquema del Perfil del Paciente CareBridge
=====================================================
Lee el ranking de features (generado en step5) y construye
el archivo scripts/patient_profile_schema.json con:
  - nombre de la variable
  - pregunta en español para la app
  - tipo de dato
  - valores posibles / rango
  - qué condición predice
"""

import os, json

BASE    = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = os.path.join(BASE, "..", "scripts")
os.makedirs(SCRIPTS, exist_ok=True)

# ── Esquema completo basado en el análisis de features ─────
# Ordenado por importancia predicativa (de mayor a menor)
SCHEMA = {
    "version": "1.0",
    "app": "CareBridge",
    "description": (
        "Variables a recolectar del paciente durante el onboarding y "
        "actualizaciones periódicas para generar alertas de salud personalizadas."
    ),
    "variables": [
        # ── SALUD AUTOREPORTADA ──────────────────────────────
        {
            "name":           "dias_mala_salud_fisica",
            "question":       "En los últimos 30 días, ¿cuántos días tu salud física no fue buena (dolor, malestar físico, enfermedades)?",
            "type":           "number",
            "range":          [0, 30],
            "unit":           "días",
            "section":        "salud_general",
            "predicts":       ["cardiovascular_risk", "arthritis", "asthma", "general_health"],
            "importance_rank": 1,
        },
        {
            "name":           "dias_mala_salud_mental",
            "question":       "En los últimos 30 días, ¿cuántos días tu salud mental no fue buena (estrés, depresión, problemas emocionales)?",
            "type":           "number",
            "range":          [0, 30],
            "unit":           "días",
            "section":        "salud_mental",
            "predicts":       ["mental_health", "depression", "stress", "general_health"],
            "importance_rank": 2,
        },
        # ── DATOS BIOMÉTRICOS ────────────────────────────────
        {
            "name":           "peso_kg",
            "question":       "¿Cuánto pesas aproximadamente? (en kilogramos)",
            "type":           "number",
            "range":          [30, 300],
            "unit":           "kg",
            "section":        "biometrics",
            "predicts":       ["diabetes", "cardiovascular_risk", "arthritis", "sleep_apnea"],
            "importance_rank": 3,
        },
        {
            "name":           "altura_cm",
            "question":       "¿Cuánto mides aproximadamente? (en centímetros)",
            "type":           "number",
            "range":          [100, 250],
            "unit":           "cm",
            "section":        "biometrics",
            "predicts":       ["cardiovascular_risk", "diabetes", "general_health"],
            "importance_rank": 4,
        },
        {
            "name":           "categoria_imc",
            "question":       "¿Cuál es tu categoría de peso según tu médico o la báscula inteligente?",
            "type":           "category",
            "values":         ["bajo_peso", "normal", "sobrepeso", "obeso"],
            "labels_es":      ["Bajo peso", "Normal", "Sobrepeso", "Obeso"],
            "section":        "biometrics",
            "predicts":       ["diabetes", "cardiovascular_risk", "arthritis", "sleep_apnea"],
            "importance_rank": 5,
            "note":           "Se puede calcular automáticamente con peso y altura."
        },
        # ── DATOS DEMOGRÁFICOS ───────────────────────────────
        {
            "name":           "grupo_edad",
            "question":       "¿En qué rango de edad te encuentras?",
            "type":           "category",
            "values":         ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"],
            "labels_es":      ["18 a 24 años", "25 a 34 años", "35 a 44 años",
                               "45 a 54 años", "55 a 64 años", "65 años o más"],
            "section":        "demographics",
            "predicts":       ["all_conditions"],
            "importance_rank": 6,
        },
        {
            "name":           "sexo",
            "question":       "¿Cuál es tu sexo biológico?",
            "type":           "category",
            "values":         ["masculino", "femenino"],
            "labels_es":      ["Masculino", "Femenino"],
            "section":        "demographics",
            "predicts":       ["cardiovascular_risk", "diabetes", "osteoporosis"],
            "importance_rank": 7,
        },
        # ── HÁBITOS DE VIDA ──────────────────────────────────
        {
            "name":           "ejercicio_ultimo_mes",
            "question":       "En los últimos 30 días, además de tu trabajo habitual, ¿realizaste algún tipo de actividad física o ejercicio?",
            "type":           "boolean",
            "values":         ["si", "no"],
            "labels_es":      ["Sí", "No"],
            "section":        "lifestyle",
            "predicts":       ["cardiovascular_risk", "diabetes", "mental_health", "general_health"],
            "importance_rank": 8,
        },
        {
            "name":           "frecuencia_tabaco",
            "question":       "Actualmente, ¿con qué frecuencia fumas cigarrillos o usas tabaco?",
            "type":           "category",
            "values":         ["nunca", "algunos_dias", "todos_los_dias"],
            "labels_es":      ["Nunca / dejé de fumar", "Algunos días", "Todos los días"],
            "section":        "lifestyle",
            "predicts":       ["cardiovascular_risk", "cancer", "asthma", "COPD"],
            "importance_rank": 9,
        },
        {
            "name":           "consumo_alcohol",
            "question":       "En los últimos 30 días, ¿consumiste alguna bebida alcohólica?",
            "type":           "boolean",
            "values":         ["si", "no"],
            "labels_es":      ["Sí", "No"],
            "section":        "lifestyle",
            "predicts":       ["cardiovascular_risk", "liver_disease", "mental_health"],
            "importance_rank": 10,
        },
        # ── CONDICIONES DIAGNOSTICADAS ───────────────────────
        {
            "name":           "tiene_diabetes",
            "question":       "¿Algún médico te ha dicho que tienes diabetes?",
            "type":           "category",
            "values":         ["no", "pre_diabetes", "si", "solo_embarazo"],
            "labels_es":      ["No", "Pre-diabetes / Diabetes limítrofe",
                               "Sí, tengo diabetes", "Solo durante el embarazo"],
            "section":        "medical_history",
            "predicts":       ["cardiovascular_risk", "kidney_disease", "retinopathy", "neuropathy"],
            "importance_rank": 11,
        },
        {
            "name":           "tiene_cardiopatia_coronaria",
            "question":       "¿Algún médico te ha dicho que tienes enfermedad coronaria o angina de pecho?",
            "type":           "boolean",
            "values":         ["si", "no"],
            "labels_es":      ["Sí", "No"],
            "section":        "medical_history",
            "predicts":       ["cardiovascular_risk", "stroke", "heart_failure"],
            "importance_rank": 12,
        },
        {
            "name":           "tiene_depresion",
            "question":       "¿Algún médico te ha dicho que tienes un trastorno depresivo?",
            "type":           "boolean",
            "values":         ["si", "no"],
            "labels_es":      ["Sí", "No"],
            "section":        "medical_history",
            "predicts":       ["mental_health", "cardiovascular_risk", "general_health"],
            "importance_rank": 13,
        },
        {
            "name":           "tiene_artritis",
            "question":       "¿Algún médico te ha dicho que tienes artritis, artritis reumatoide, gota u otra enfermedad articular?",
            "type":           "boolean",
            "values":         ["si", "no"],
            "labels_es":      ["Sí", "No"],
            "section":        "medical_history",
            "predicts":       ["arthritis", "cardiovascular_risk", "mobility_limitation"],
            "importance_rank": 14,
        },
        {
            "name":           "tiene_asma",
            "question":       "¿Algún médico te ha dicho que tienes asma?",
            "type":           "boolean",
            "values":         ["si", "no"],
            "labels_es":      ["Sí", "No"],
            "section":        "medical_history",
            "predicts":       ["asthma", "respiratory", "cardiovascular_risk"],
            "importance_rank": 15,
        },
        {
            "name":           "tiene_cancer_piel",
            "question":       "¿Algún médico te ha dicho que tienes o tuviste cáncer de piel?",
            "type":           "boolean",
            "values":         ["si", "no"],
            "labels_es":      ["Sí", "No"],
            "section":        "medical_history",
            "predicts":       ["cancer", "skin_health"],
            "importance_rank": 16,
        },
        {
            "name":           "tiene_otro_cancer",
            "question":       "¿Algún médico te ha dicho que tienes o tuviste algún otro tipo de cáncer (distinto al de piel)?",
            "type":           "boolean",
            "values":         ["si", "no"],
            "labels_es":      ["Sí", "No"],
            "section":        "medical_history",
            "predicts":       ["cancer", "general_health"],
            "importance_rank": 17,
        },
        # ── SUEÑO (del Sleep Dataset — alta correlación con estrés/salud) ──
        {
            "name":           "horas_suenio",
            "question":       "¿Cuántas horas duermes en promedio por noche?",
            "type":           "number",
            "range":          [1, 14],
            "unit":           "horas",
            "section":        "sleep_lifestyle",
            "predicts":       ["mental_health", "cardiovascular_risk", "diabetes", "obesity"],
            "importance_rank": 18,
            "note":           "Variable del Sleep Dataset — no disponible en BRFSS 2023."
        },
        {
            "name":           "nivel_estres",
            "question":       "En una escala del 1 al 10, ¿cómo calificarías tu nivel de estrés habitual?",
            "type":           "scale_1_10",
            "range":          [1, 10],
            "section":        "sleep_lifestyle",
            "predicts":       ["mental_health", "cardiovascular_risk", "sleep_disorder", "depression"],
            "importance_rank": 19,
        },
        {
            "name":           "calidad_suenio",
            "question":       "En una escala del 1 al 10, ¿cómo calificarías la calidad de tu sueño?",
            "type":           "scale_1_10",
            "range":          [1, 10],
            "section":        "sleep_lifestyle",
            "predicts":       ["mental_health", "cardiovascular_risk", "obesity", "diabetes"],
            "importance_rank": 20,
        },
    ]
}

# Agregar metadata de secciones
SCHEMA["sections"] = {
    "salud_general":   "Salud General Autoreportada",
    "salud_mental":    "Salud Mental",
    "biometrics":      "Datos Biométricos",
    "demographics":    "Información Demográfica",
    "lifestyle":       "Hábitos de Vida",
    "medical_history": "Historial Médico",
    "sleep_lifestyle": "Sueño y Bienestar",
}


if __name__ == "__main__":
    print("\n" + "="*60)
    print("PASO 6 — Generando patient_profile_schema.json")
    print("="*60)

    out_path = os.path.join(SCRIPTS, "patient_profile_schema.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(SCHEMA, f, ensure_ascii=False, indent=2)

    print(f"\n  Esquema guardado → {out_path}")
    print(f"  Variables definidas: {len(SCHEMA['variables'])}")
    print(f"  Secciones: {list(SCHEMA['sections'].keys())}")

    print("\n  VARIABLES DEL FORMULARIO CareBridge:")
    print(f"  {'#':>3}  {'Nombre':<35} {'Tipo':<15} Predice")
    print("  " + "─"*80)
    for v in SCHEMA["variables"]:
        print(f"  {v['importance_rank']:>3}. {v['name']:<35} {v['type']:<15} "
              f"{', '.join(v['predicts'][:2])}")

    print("\nPASO 6 completado ✓")
