import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 90;

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  // ── Read tools ──────────────────────────────────────────────────────────────
  {
    name: "get_patient_profile",
    description:
      "Obtiene el perfil de salud del paciente: diagnóstico, edad, hábitos de sueño, actividad física y estado de ánimo.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "get_medications",
    description:
      "Lista los medicamentos activos del paciente con su nombre, dosis, frecuencia y estado (tomado/pendiente).",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "get_daily_logs",
    description: "Obtiene los registros diarios de salud de los últimos 7 días: síntomas, dolor, energía y notas.",
    input_schema: {
      type: "object" as const,
      properties: {
        days: { type: "number", description: "Número de días hacia atrás. Default 7, máximo 30." },
      },
      required: [],
    },
  },
  {
    name: "get_exam_history",
    description: "Obtiene el historial de exámenes médicos analizados previamente (últimos 5).",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "get_patient_risk",
    description:
      "Calcula el riesgo de enfermedades crónicas del paciente usando los modelos ML (diabetes, hipertensión, cardiopatía, depresión, asma, colesterol, ACV).",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "save_exam_analysis",
    description:
      "Guarda el análisis de un examen médico en el historial del paciente. Llama esta herramienta solo cuando hayas terminado de analizar la imagen y el paciente quiera guardarlo.",
    input_schema: {
      type: "object" as const,
      properties: {
        analysis_text: { type: "string", description: "El texto completo del análisis del examen." },
        image_path: { type: "string", description: "Ruta del archivo en Supabase Storage (si ya fue subido). Dejar vacío si no aplica." },
      },
      required: ["analysis_text"],
    },
  },

  // ── Write tools ──────────────────────────────────────────────────────────────
  {
    name: "update_health_profile",
    description:
      "Actualiza los datos del perfil de salud del paciente. Usa esta herramienta cuando el paciente mencione información sobre su sueño, ejercicio, dieta, estado de ánimo, estrés, trabajo o métricas corporales. Solo incluye los campos que el paciente mencionó.",
    input_schema: {
      type: "object" as const,
      properties: {
        sleep_hours: { type: "number", description: "Horas de sueño por noche." },
        sleep_quality: {
          type: "string",
          description: "Calidad del sueño.",
          enum: ["Profundo y reparador", "Me despierto varias veces", "Muy ligero", "Depende del día"],
        },
        wake_up_feeling: {
          type: "string",
          description: "Cómo se siente al despertar.",
          enum: ["Con energía", "Cansada todavía", "Depende del día", "Con ansiedad"],
        },
        physical_activity_frequency: {
          type: "string",
          description: "Frecuencia de actividad física.",
          enum: ["Todos los días", "3-4 veces por semana", "1-2 veces por semana", "Rara vez o nunca"],
        },
        physical_activity_type: { type: "string", description: "Tipo de actividad física que realiza." },
        typical_diet: { type: "string", description: "Descripción de la dieta habitual." },
        mood_general: {
          type: "string",
          description: "Estado de ánimo general.",
          enum: ["Muy bien", "Bien", "Regular", "Mal", "Muy mal"],
        },
        stress_level: {
          type: "string",
          description: "Nivel de estrés.",
          enum: ["Bajo", "Moderado", "Alto", "Muy alto"],
        },
        profession: { type: "string", description: "Profesión u ocupación." },
        work_schedule: { type: "string", description: "Horario de trabajo." },
        weight_kg: { type: "number", description: "Peso en kilogramos." },
        height_cm: { type: "number", description: "Altura en centímetros." },
      },
      required: [],
    },
  },
  {
    name: "update_profile",
    description:
      "Actualiza los datos principales del perfil del paciente: diagnóstico, género, fecha de nacimiento, ciudad o teléfono.",
    input_schema: {
      type: "object" as const,
      properties: {
        diagnosis: { type: "string", description: "Diagnóstico principal o condición de salud." },
        gender: { type: "string", description: "Género del paciente." },
        date_of_birth: { type: "string", description: "Fecha de nacimiento en formato YYYY-MM-DD." },
        location: { type: "string", description: "Ciudad o ubicación." },
        phone: { type: "string", description: "Número de teléfono de contacto." },
      },
      required: [],
    },
  },
  {
    name: "log_symptom",
    description:
      "Registra un síntoma o entrada de bienestar en el diario de salud del paciente. Usa esto cuando el paciente mencione cómo se siente hoy, síntomas actuales, nivel de dolor u otros indicadores de bienestar.",
    input_schema: {
      type: "object" as const,
      properties: {
        symptoms: {
          type: "array",
          items: { type: "string" },
          description: "Lista de síntomas mencionados (e.g., [\"dolor de cabeza\", \"fatiga\"]).",
        },
        pain: { type: "number", description: "Nivel de dolor del 1 al 10 (1 = sin dolor, 10 = insoportable)." },
        energy: { type: "number", description: "Nivel de energía del 1 al 10 (1 = sin energía, 10 = muy energético)." },
        mood: { type: "number", description: "Estado de ánimo del 1 al 10 (1 = muy mal, 10 = excelente)." },
        notes: { type: "string", description: "Notas adicionales sobre cómo se siente." },
      },
      required: ["symptoms"],
    },
  },
  {
    name: "book_appointment",
    description:
      "Agenda una cita médica. IMPORTANTE: siempre confirma con el paciente la especialidad, fecha y hora antes de llamar esta herramienta.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Título de la cita (e.g., \"Consulta cardiología\")." },
        appointment_at: {
          type: "string",
          description: "Fecha y hora de la cita en formato ISO 8601 (e.g., \"2026-06-15T10:00:00-05:00\").",
        },
        specialty: { type: "string", description: "Especialidad médica (e.g., \"Cardiología\", \"Medicina general\")." },
        provider_name: { type: "string", description: "Nombre completo del médico (e.g., \"Dra. Sofía Ramírez Torres\")." },
        doctor_slug: { type: "string", description: "Slug del médico obtenido de get_available_doctors (e.g., \"sofia-ramirez-torres\"). Incluir siempre que sea posible." },
        notes: { type: "string", description: "Motivo de la cita u observaciones." },
      },
      required: ["title", "appointment_at"],
    },
  },
  {
    name: "get_available_doctors",
    description:
      "Obtiene los médicos disponibles con sus horarios reales para las próximas 2 semanas. SIEMPRE llama esta herramienta ANTES de agendar una cita para mostrarle al paciente opciones reales de médicos y horarios disponibles.",
    input_schema: {
      type: "object" as const,
      properties: {
        specialty: {
          type: "string",
          description: "Filtrar por especialidad (e.g., 'Endocrinología', 'Cardiología'). Omitir para ver todos.",
        },
      },
      required: [],
    },
  },
  {
    name: "suggest_specialist",
    description:
      "Sugiere un especialista médico basado en los resultados de un examen analizado. Llama esta herramienta SIEMPRE después de analizar un examen cuando encuentres valores fuera del rango normal o que justifiquen seguimiento especializado.",
    input_schema: {
      type: "object" as const,
      properties: {
        specialty: {
          type: "string",
          description: "Especialidad médica recomendada (e.g., 'Cardiología', 'Endocrinología', 'Medicina general', 'Nefrología', 'Gastroenterología', 'Hematología').",
        },
        reason: {
          type: "string",
          description: "Razón breve y empática (1-2 oraciones) de por qué recomiendas esta especialidad, en relación directa con los valores del examen.",
        },
        exam_type: {
          type: "string",
          description: "Tipo de examen analizado (e.g., 'Hemograma completo', 'Perfil lipídico', 'Glucosa en ayunas', 'Función renal').",
        },
      },
      required: ["specialty", "reason"],
    },
  },
];

// ─── ML risk condition metadata ───────────────────────────────────────────────

const RISK_CONDITION_META: Record<string, { label: string; specialty: string }> = {
  diabetes:         { label: "Riesgo de diabetes",            specialty: "Endocrinología" },
  high_bp:          { label: "Riesgo de hipertensión",         specialty: "Cardiología" },
  heart_disease:    { label: "Riesgo cardiovascular",          specialty: "Cardiología" },
  depression:       { label: "Riesgo de depresión",            specialty: "Psiquiatría" },
  asthma:           { label: "Riesgo de asma",                 specialty: "Neumología" },
  high_cholesterol: { label: "Colesterol potencialmente alto", specialty: "Cardiología" },
  stroke:           { label: "Riesgo de ACV",                  specialty: "Neurología" },
};

// ─── Tool handlers ─────────────────────────────────────────────────────────────

async function handleTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  userId: string,
  supabaseImagePath?: string
): Promise<string> {
  const admin = getSupabaseAdmin();

  // ── Read: get_patient_profile ────────────────────────────────────────────────
  if (toolName === "get_patient_profile") {
    const [profileRes, hpRes] = await Promise.all([
      admin
        .from("profiles")
        .select("full_name, date_of_birth, diagnosis, gender, location")
        .eq("id", userId)
        .maybeSingle(),
      admin
        .from("health_profile")
        .select("sleep_hours, sleep_quality, wake_up_feeling, physical_activity_frequency, physical_activity_type, typical_diet, mood_general, stress_level, profession, weight_kg, height_cm")
        .eq("profile_id", userId)
        .maybeSingle(),
    ]);

    const profile = profileRes.data;
    const hp = hpRes.data;

    let age: number | null = null;
    if (profile?.date_of_birth) {
      const birth = new Date(profile.date_of_birth);
      const today = new Date();
      age = today.getFullYear() - birth.getFullYear();
      if (
        today.getMonth() < birth.getMonth() ||
        (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
      )
        age--;
    }

    return JSON.stringify({
      name: profile?.full_name ?? null,
      age,
      gender: profile?.gender ?? null,
      location: profile?.location ?? null,
      diagnosis: profile?.diagnosis ?? null,
      sleep_hours: hp?.sleep_hours ?? null,
      sleep_quality: hp?.sleep_quality ?? null,
      wake_up_feeling: hp?.wake_up_feeling ?? null,
      physical_activity: hp?.physical_activity_frequency ?? null,
      physical_activity_type: hp?.physical_activity_type ?? null,
      typical_diet: hp?.typical_diet ?? null,
      mood: hp?.mood_general ?? null,
      stress_level: hp?.stress_level ?? null,
      profession: hp?.profession ?? null,
      weight_kg: hp?.weight_kg ?? null,
      height_cm: hp?.height_cm ?? null,
    });
  }

  // ── Read: get_medications ────────────────────────────────────────────────────
  if (toolName === "get_medications") {
    const { data } = await admin
      .from("medications")
      .select("name, dosage, frequency, status, start_date")
      .eq("profile_id", userId)
      .order("start_date", { ascending: false })
      .limit(20);
    return JSON.stringify(data ?? []);
  }

  // ── Read: get_daily_logs ─────────────────────────────────────────────────────
  if (toolName === "get_daily_logs") {
    const days = Math.min(Number(toolInput.days ?? 7), 30);
    const since = new Date();
    since.setDate(since.getDate() - days);
    const { data } = await admin
      .from("daily_logs")
      .select("logged_at, symptoms, pain, energy, mood, notes")
      .eq("profile_id", userId)
      .gte("logged_at", since.toISOString())
      .order("logged_at", { ascending: false });
    return JSON.stringify(data ?? []);
  }

  // ── Read: get_exam_history ───────────────────────────────────────────────────
  if (toolName === "get_exam_history") {
    const { data } = await admin
      .from("exam_documents")
      .select("id, analysis_text, uploaded_at")
      .eq("profile_id", userId)
      .order("uploaded_at", { ascending: false })
      .limit(5);
    return JSON.stringify(data ?? []);
  }

  // ── Read: get_patient_risk ───────────────────────────────────────────────────
  if (toolName === "get_patient_risk") {
    const mlUrl = process.env.ML_SERVICE_URL;
    const mlKey = process.env.ML_SERVICE_API_KEY;
    if (!mlUrl || !mlKey) return JSON.stringify({ error: "Servicio ML no configurado." });

    try {
      const res = await fetch(`${mlUrl}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": mlKey },
        body: JSON.stringify({ userId }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) return JSON.stringify({ error: `ML service error ${res.status}` });
      return JSON.stringify(await res.json());
    } catch (e) {
      return JSON.stringify({ error: String(e) });
    }
  }

  // ── Read/Write: save_exam_analysis ───────────────────────────────────────────
  if (toolName === "save_exam_analysis") {
    const analysisText = String(toolInput.analysis_text ?? "");
    if (!analysisText) return JSON.stringify({ error: "analysis_text requerido." });

    const { data, error } = await admin
      .from("exam_documents")
      .insert({
        profile_id: userId,
        image_path: supabaseImagePath ?? (toolInput.image_path as string | undefined) ?? null,
        analysis_text: analysisText,
      })
      .select("id")
      .single();

    if (error) return JSON.stringify({ error: error.message });
    return JSON.stringify({ saved: true, id: data.id });
  }

  // ── Write: update_health_profile ─────────────────────────────────────────────
  if (toolName === "update_health_profile") {
    const allowed = [
      "sleep_hours", "sleep_quality", "wake_up_feeling",
      "physical_activity_frequency", "physical_activity_type",
      "typical_diet", "meal_times",
      "mood_general", "stress_level",
      "profession", "work_schedule", "daily_routine",
      "weight_kg", "height_cm",
      "contraceptives", "menstrual_cycle", "sexual_activity",
    ];

    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (toolInput[key] !== undefined) updates[key] = toolInput[key];
    }

    if (Object.keys(updates).length === 0) {
      return JSON.stringify({ error: "No se proporcionaron campos para actualizar." });
    }

    const { error } = await admin
      .from("health_profile")
      .upsert({ profile_id: userId, ...updates }, { onConflict: "profile_id" });

    if (error) return JSON.stringify({ error: error.message });
    return JSON.stringify({ updated: true, fields: Object.keys(updates) });
  }

  // ── Write: update_profile ────────────────────────────────────────────────────
  if (toolName === "update_profile") {
    const allowed = ["diagnosis", "gender", "date_of_birth", "location", "phone"];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (toolInput[key] !== undefined) updates[key] = toolInput[key];
    }

    if (Object.keys(updates).length === 0) {
      return JSON.stringify({ error: "No se proporcionaron campos para actualizar." });
    }

    const { error } = await admin
      .from("profiles")
      .update(updates)
      .eq("id", userId);

    if (error) return JSON.stringify({ error: error.message });
    return JSON.stringify({ updated: true, fields: Object.keys(updates) });
  }

  // ── Write: log_symptom ───────────────────────────────────────────────────────
  if (toolName === "log_symptom") {
    const symptoms = (toolInput.symptoms as string[] | undefined) ?? [];
    const pain = toolInput.pain !== undefined ? Number(toolInput.pain) : null;
    const energy = toolInput.energy !== undefined ? Number(toolInput.energy) : null;
    const mood = toolInput.mood !== undefined ? Number(toolInput.mood) : null;
    const notes = toolInput.notes ? String(toolInput.notes) : null;

    const { error } = await admin.from("daily_logs").insert({
      profile_id: userId,
      symptoms,
      pain,
      energy,
      mood,
      notes,
    });

    if (error) return JSON.stringify({ error: error.message });
    return JSON.stringify({ logged: true, symptoms, pain, energy, mood });
  }

  // ── Read: get_available_doctors ──────────────────────────────────────────────
  if (toolName === "get_available_doctors") {
    const specialty = toolInput.specialty ? String(toolInput.specialty) : null;

    const baseQuery = admin
      .from("doctors")
      .select("slug, title, name, specialty, rating, years_experience, consultation_price, consultation_duration_min, consultation_types, weekly_schedule")
      .order("rating", { ascending: false })
      .limit(6);

    const { data, error } = specialty
      ? await baseQuery.ilike("specialty", `%${specialty}%`)
      : await baseQuery;

    if (error) return JSON.stringify({ error: error.message });

    const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const doctors = ((data ?? []) as Record<string, unknown>[]).map((doc) => {
      const schedule = (doc.weekly_schedule as Record<string, string[]>) ?? {};
      const slots: { date: string; times: string[] }[] = [];
      for (let i = 1; i <= 14; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const dayName = DAY_NAMES[d.getDay()];
        const times = schedule[dayName] ?? [];
        if (times.length > 0) {
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          slots.push({ date: dateStr, times });
        }
      }
      return {
        slug: doc.slug,
        name: `${doc.title} ${doc.name}`,
        specialty: doc.specialty,
        rating: doc.rating,
        experience_years: doc.years_experience,
        price_cop: doc.consultation_price,
        duration_min: doc.consultation_duration_min,
        consultation_types: doc.consultation_types,
        available_slots: slots.slice(0, 4),
      };
    });

    return JSON.stringify({ doctors });
  }

  // ── Write: book_appointment ──────────────────────────────────────────────────
  if (toolName === "book_appointment") {
    const title = String(toolInput.title ?? "");
    const appointment_at = String(toolInput.appointment_at ?? "");
    if (!title || !appointment_at) {
      return JSON.stringify({ error: "Se requieren title y appointment_at." });
    }

    const { data, error } = await admin
      .from("appointments")
      .insert({
        profile_id: userId,
        title,
        appointment_at,
        specialty: toolInput.specialty ? String(toolInput.specialty) : null,
        provider_name: toolInput.provider_name ? String(toolInput.provider_name) : null,
        doctor_slug: toolInput.doctor_slug ? String(toolInput.doctor_slug) : null,
        notes: toolInput.notes ? String(toolInput.notes) : null,
        status: "scheduled",
      })
      .select("id")
      .single();

    if (error) return JSON.stringify({ error: error.message });
    return JSON.stringify({ booked: true, id: data.id, appointment_at, title });
  }

  // ── suggest_specialist ────────────────────────────────────────────────────────
  if (toolName === "suggest_specialist") {
    return JSON.stringify({ suggested: true, specialty: toolInput.specialty, reason: toolInput.reason });
  }

  return JSON.stringify({ error: `Herramienta desconocida: ${toolName}` });
}

// ─── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  const today = new Date();
  const dateStr = today.toLocaleDateString("es-CO", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const isoDate = today.toISOString().split("T")[0];

  return `Eres CareGuide, el asistente de salud personal de CareMosaic. Ayudas a los pacientes a entender su salud, interpretar sus exámenes médicos, registrar cómo se sienten y prepararse para consultas médicas.

## Fecha actual
Hoy es ${dateStr} (${isoDate}). Usa esta fecha como referencia para todas las citas y menciones de tiempo. Cuando el paciente diga "la próxima semana", "en junio" o cualquier fecha relativa, calcula el año correcto basándote en esta fecha.

## Tu personalidad
- Empático, claro y cercano. Nunca condescendiente.
- Usas lenguaje simple, sin jerga médica innecesaria.
- Siempre recuerdas que no eres médico y cuando algo es serio, recomiendas consultar al profesional de salud.

## Tus capacidades
- Consultar y ACTUALIZAR el perfil de salud del paciente.
- Revisar sus medicamentos actuales.
- Analizar imágenes de exámenes de laboratorio.
- Ver y guardar el historial de exámenes.
- Calcular riesgo de enfermedades crónicas con modelos ML.
- Registrar síntomas y bienestar en el diario de salud.
- Agendar citas con especialistas REALES de la plataforma.

## Cuándo actualizar datos proactivamente
Cuando el paciente mencione información de salud en la conversación, actualiza los datos y confirma brevemente:
- "dormí mal esta semana" → update_health_profile (sleep_quality)
- "me diagnosticaron X" → update_profile (diagnosis) — pide confirmación antes
- "me duele la cabeza" o "me siento cansada" → ofrece registrar el síntoma con log_symptom
- "hago ejercicio 3 veces por semana" → update_health_profile (physical_activity_frequency)
- "peso 60kg" → update_health_profile (weight_kg)

Al actualizar, confirma con naturalidad: "Listo, guardé que duermes unas 5 horas. ¿Algo más que quieras contarme?"

## Evaluación de riesgo proactiva con IA (OBLIGATORIO)
Cada vez que el paciente mencione síntomas, malestar, dolor, fatiga, ansiedad, tristeza o cualquier indicador de salud, SIEMPRE llama a get_patient_risk en el mismo turno además de log_symptom. Hazlo en paralelo. El sistema mostrará automáticamente alertas visuales de riesgo con opción de agendar cita — no tienes que describirlas tú, solo ejecútalas silenciosamente. Esto también aplica cuando el usuario pregunta explícitamente por su riesgo.

## Flujo para registrar síntomas
Cuando el paciente mencione cómo se siente, pregunta brevemente: nivel de dolor (1-10), energía (1-10). Luego llama a log_symptom con los datos recopilados.

## Flujo para agendar citas (OBLIGATORIO seguir estos pasos)
1. Llama a get_available_doctors con la especialidad que el paciente necesita (o sin filtro si no está seguro).
2. Presenta al paciente los médicos disponibles con sus horarios reales. Muestra el nombre, especialidad, experiencia y los slots disponibles.
3. Espera a que el paciente elija un médico y un horario específico de los disponibles.
4. Confirma: "¿Agendo consulta con [nombre médico] el [fecha] a las [hora]?"
5. Si el paciente confirma, llama a book_appointment con:
   - title: "Consulta [especialidad] con [nombre médico]"
   - appointment_at: la fecha y hora exacta en formato ISO 8601 con año ${today.getFullYear()} (e.g., "${isoDate}T09:00:00")
   - specialty, provider_name, doctor_slug (del resultado de get_available_doctors)
6. Confirma: "¡Listo! Tu cita quedó agendada."

IMPORTANTE: NUNCA inventes médicos ni horarios. Solo usa los slots reales devueltos por get_available_doctors. Si el paciente pide una fecha/hora que no está disponible, dile los horarios reales disponibles para ese médico.

## Flujo para análisis de exámenes
Cuando el paciente sube una imagen de examen:
1. Analízala directamente.
2. Explica cada valor: resultado, rango normal, significado en lenguaje simple.
3. SIEMPRE llama a suggest_specialist con la especialidad más relevante según los hallazgos:
   - Hemograma / sangre → "Hematología" o "Medicina general"
   - Glucosa alta / diabetes → "Endocrinología"
   - Colesterol / triglicéridos altos → "Cardiología"
   - Hormonas / tiroides → "Endocrinología"
   - Creatinina / función renal → "Nefrología"
   - Bilirrubina / enzimas hepáticas → "Gastroenterología"
   - Examen de orina → "Urología" o "Medicina general"
   - Resultados normales o examen general → "Medicina general"
4. Pregunta si quiere guardar el análisis en su historial.
5. Si dice que sí, llama a save_exam_analysis.

## Reglas importantes
- No diagnostiques enfermedades. Puedes explicar síntomas y riesgos.
- Si un valor es CRÍTICO, recomienda buscar atención médica pronto.
- Antes de actualizar diagnóstico o datos médicos sensibles, pide confirmación explícita.
- Para book_appointment, SIEMPRE confirma con el paciente antes de ejecutar.
- Antes de responder preguntas sobre salud del paciente, usa las herramientas para obtener datos reales.
- Responde siempre en español.`;
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Agente no configurado." }, { status: 503 });
  }

  let body: {
    messages: Anthropic.MessageParam[];
    userId: string;
    supabaseImagePath?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request inválido." }, { status: 400 });
  }

  const { messages, userId, supabaseImagePath } = body;

  if (!userId) {
    return NextResponse.json({ error: "userId requerido." }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk: object) =>
        controller.enqueue(encoder.encode(JSON.stringify(chunk) + "\n"));

      try {
        let currentMessages: Anthropic.MessageParam[] = [...messages];

        for (let round = 0; round < 8; round++) {
          const response = await client.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 4096,
            system: buildSystemPrompt(),
            tools: TOOLS,
            messages: currentMessages,
          });

          const textBlocks = response.content.filter(
            (b): b is Anthropic.TextBlock => b.type === "text"
          );
          const toolBlocks = response.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
          );

          for (const block of textBlocks) {
            if (block.text) send({ type: "text", text: block.text });
          }

          if (response.stop_reason === "end_turn" || toolBlocks.length === 0) {
            send({ type: "done" });
            controller.close();
            return;
          }

          for (const tool of toolBlocks) {
            send({ type: "tool_start", tool: tool.name });
            if (tool.name === "suggest_specialist") {
              const input = tool.input as Record<string, unknown>;
              send({
                type: "specialist_card",
                specialty: String(input.specialty ?? ""),
                reason: String(input.reason ?? ""),
                exam_type: input.exam_type ? String(input.exam_type) : undefined,
              });
            }
          }

          const toolResults = await Promise.all(
            toolBlocks.map(async (tool) => {
              const result = await handleTool(
                tool.name,
                tool.input as Record<string, unknown>,
                userId,
                supabaseImagePath
              );

              if (tool.name === "book_appointment") {
                try {
                  const parsed = JSON.parse(result) as Record<string, unknown>;
                  if (parsed.booked) {
                    const inp = tool.input as Record<string, unknown>;
                    send({
                      type: "appointment_booked",
                      id: parsed.id,
                      title: parsed.title,
                      appointment_at: parsed.appointment_at,
                      specialty: inp.specialty ?? null,
                      provider_name: inp.provider_name ?? null,
                      doctor_slug: inp.doctor_slug ?? null,
                    });
                  }
                } catch { /* ignore parse errors */ }
              }

              if (tool.name === "get_patient_risk") {
                try {
                  const parsed = JSON.parse(result) as {
                    conditions?: Record<string, { flag: boolean; probability: number }>;
                  };
                  if (parsed.conditions) {
                    for (const [cond, data] of Object.entries(parsed.conditions)) {
                      if (data.flag) {
                        const meta = RISK_CONDITION_META[cond];
                        if (meta) {
                          send({
                            type: "risk_alert",
                            condition: cond,
                            label: meta.label,
                            probability: data.probability,
                            specialty: meta.specialty,
                          });
                        }
                      }
                    }
                  }
                } catch { /* ignore parse errors */ }
              }

              return {
                type: "tool_result" as const,
                tool_use_id: tool.id,
                content: result,
              };
            })
          );

          currentMessages = [
            ...currentMessages,
            { role: "assistant", content: response.content },
            { role: "user", content: toolResults },
          ];
        }

        send({ type: "text", text: "Lo siento, no pude completar la consulta en este momento. Por favor intenta de nuevo." });
        send({ type: "done" });
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error desconocido.";
        send({ type: "error", message: msg });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-store",
    },
  });
}
