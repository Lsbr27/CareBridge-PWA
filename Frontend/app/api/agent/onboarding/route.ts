import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 90;

// ─── Tools ────────────────────────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: "update_health_profile",
    description:
      "Guarda datos de salud que el usuario acaba de mencionar. Llama esta herramienta inmediatamente cuando el usuario comparta información sobre sueño, ejercicio, dieta, ánimo, estrés, trabajo o métricas corporales. Solo incluye los campos que el usuario mencionó.",
    input_schema: {
      type: "object" as const,
      properties: {
        sleep_hours: { type: "number", description: "Horas de sueño por noche." },
        sleep_quality: {
          type: "string",
          enum: ["Profundo y reparador", "Me despierto varias veces", "Muy ligero", "Depende del día"],
        },
        wake_up_feeling: {
          type: "string",
          enum: ["Con energía", "Cansada todavía", "Depende del día", "Con ansiedad"],
        },
        physical_activity_frequency: {
          type: "string",
          enum: ["Todos los días", "3-4 veces por semana", "1-2 veces por semana", "Rara vez o nunca"],
        },
        physical_activity_type: { type: "string" },
        typical_diet: { type: "string" },
        mood_general: {
          type: "string",
          enum: ["Muy bien", "Bien", "Regular", "Mal", "Muy mal"],
        },
        stress_level: {
          type: "string",
          enum: ["Bajo", "Moderado", "Alto", "Muy alto"],
        },
        profession: { type: "string" },
        work_schedule: { type: "string" },
        weight_kg: { type: "number" },
        height_cm: { type: "number" },
      },
      required: [],
    },
  },
  {
    name: "update_profile",
    description:
      "Guarda el diagnóstico, género u otros datos del perfil base cuando el usuario los mencione.",
    input_schema: {
      type: "object" as const,
      properties: {
        diagnosis: { type: "string", description: "Diagnóstico o condición de salud principal." },
        gender: { type: "string" },
        date_of_birth: { type: "string", description: "Formato YYYY-MM-DD." },
        location: { type: "string" },
      },
      required: [],
    },
  },
  {
    name: "complete_onboarding",
    description:
      "Marca el onboarding como completado. Llama esta herramienta cuando: (a) hayas cubierto al menos 3 temas de salud, (b) el usuario diga que quiere terminar o explorar la app, o (c) el usuario lleve más de 6 intercambios en la conversación.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
];

// ─── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres CareGuide dando la bienvenida a un nuevo paciente de CareMosaic. Tu objetivo es conocer sus hábitos y datos de salud a través de una conversación natural y cálida — no como un formulario.

## Tu tarea
Recopilar información de salud del paciente de forma conversacional. Cuando el usuario comparta un dato, guárdalo INMEDIATAMENTE con update_health_profile o update_profile, sin interrumpir el flujo de la conversación.

## Temas a cubrir (en orden flexible, no forzar todos)
1. **Sueño**: ¿cuántas horas? ¿calidad? ¿cómo despierta?
2. **Actividad física**: frecuencia y tipo
3. **Alimentación**: dieta típica
4. **Ánimo y estrés**: cómo se siente en general
5. **Trabajo/rutina**: profesión o estilo de vida
6. **Métricas** (opcional): peso y talla

## Reglas
- Una sola pregunta a la vez. Máximo 2 oraciones por turno.
- Guarda los datos silenciosamente — no menciones que los guardas a menos que sea necesario.
- Si el usuario responde vagamente, acepta lo que da y avanza.
- Si el usuario quiere saltar algo, no insistas.
- Cuando hayas cubierto ≥3 temas O el usuario quiera terminar, di algo como "¡Perfecto! Ya tengo una buena idea de cómo eres. Ahora puedes explorar la app." y llama a complete_onboarding.
- Responde siempre en español, en tono cálido y cercano.`;

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function handleTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  userId: string
): Promise<string> {
  const admin = getSupabaseAdmin();

  if (toolName === "update_health_profile") {
    const allowed = [
      "sleep_hours", "sleep_quality", "wake_up_feeling",
      "physical_activity_frequency", "physical_activity_type",
      "typical_diet", "mood_general", "stress_level",
      "profession", "work_schedule", "weight_kg", "height_cm",
    ];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (toolInput[key] !== undefined) updates[key] = toolInput[key];
    }
    if (!Object.keys(updates).length) return JSON.stringify({ skipped: true });

    await admin
      .from("health_profile")
      .upsert({ profile_id: userId, ...updates }, { onConflict: "profile_id" });
    return JSON.stringify({ updated: true, fields: Object.keys(updates) });
  }

  if (toolName === "update_profile") {
    const allowed = ["diagnosis", "gender", "date_of_birth", "location"];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (toolInput[key] !== undefined) updates[key] = toolInput[key];
    }
    if (!Object.keys(updates).length) return JSON.stringify({ skipped: true });

    await admin.from("profiles").update(updates).eq("id", userId);
    return JSON.stringify({ updated: true, fields: Object.keys(updates) });
  }

  if (toolName === "complete_onboarding") {
    await admin
      .from("profiles")
      .update({ onboarding_chat_completed: true })
      .eq("id", userId);
    return JSON.stringify({ completed: true });
  }

  return JSON.stringify({ error: `Herramienta desconocida: ${toolName}` });
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Agente no configurado." }, { status: 503 });

  let body: { messages: Anthropic.MessageParam[]; userId: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request inválido." }, { status: 400 });
  }

  const { messages, userId } = body;
  if (!userId) return NextResponse.json({ error: "userId requerido." }, { status: 400 });

  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk: object) =>
        controller.enqueue(encoder.encode(JSON.stringify(chunk) + "\n"));

      try {
        let currentMessages: Anthropic.MessageParam[] = [...messages];

        for (let round = 0; round < 10; round++) {
          const response = await client.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 512,
            system: SYSTEM_PROMPT,
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
          }

          const toolResults = await Promise.all(
            toolBlocks.map(async (tool) => ({
              type: "tool_result" as const,
              tool_use_id: tool.id,
              content: await handleTool(
                tool.name,
                tool.input as Record<string, unknown>,
                userId
              ),
            }))
          );

          currentMessages = [
            ...currentMessages,
            { role: "assistant", content: response.content },
            { role: "user", content: toolResults },
          ];
        }

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
