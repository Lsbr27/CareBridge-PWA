import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

const MEDICAL_PROMPT = `Eres un asistente médico empático que ayuda a pacientes a entender sus resultados de laboratorio. Tu tarea es leer la imagen de este examen médico y explicar cada valor de forma clara y sencilla en español.

Para CADA valor o parámetro que encuentres en el examen, usa EXACTAMENTE este formato:

**[Nombre del parámetro]**
Resultado: [valor] [unidad]
Rango normal: [rango que aparece en el papel, o el rango estándar si no está impreso]
Estado: [elige uno: 🟢 NORMAL | 🟡 EN LÍMITE | 🔴 CRÍTICO]
Qué significa: [explicación en 1-2 oraciones simples, sin jerga médica]

---

Después de analizar todos los valores, agrega:

**📋 Resumen**
[1-2 párrafos explicando los resultados más importantes y el panorama general]

**💡 Recomendación**
[Si hay valores críticos: recomendar con calma consultar al médico. Si todo está normal: tranquilizar al paciente.]

Recuerda: usa lenguaje simple y empático. No diagnostiques enfermedades. Si la imagen no es un examen médico, indícalo amablemente.`;

function buildPromptWithContext(patientContext: {
  diagnosis?: string | null;
  age?: number | null;
  medications?: string[] | null;
}) {
  let contextNote = "";

  if (patientContext.diagnosis || patientContext.age || patientContext.medications?.length) {
    contextNote = "\n\nContexto del paciente (considera esto al explicar los resultados):";
    if (patientContext.age) contextNote += `\n- Edad: ${patientContext.age} años`;
    if (patientContext.diagnosis) contextNote += `\n- Diagnóstico: ${patientContext.diagnosis}`;
    if (patientContext.medications?.length)
      contextNote += `\n- Medicamentos actuales: ${patientContext.medications.join(", ")}`;
  }

  return MEDICAL_PROMPT + contextNote;
}

function calculateAge(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null;
  const birth = new Date(dateOfBirth);
  const today = new Date();
  const age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  return m < 0 || (m === 0 && today.getDate() < birth.getDate()) ? age - 1 : age;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Servicio de análisis no configurado." }, { status: 503 });
  }

  let body: { imageBase64?: string; mimeType?: string; userId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request inválido." }, { status: 400 });
  }

  const { imageBase64, mimeType = "image/jpeg", userId } = body;

  if (!imageBase64) {
    return NextResponse.json({ error: "Se requiere una imagen." }, { status: 400 });
  }

  // Validar que el base64 no sea excesivamente grande (>4MB en base64 ≈ 3MB imagen)
  if (imageBase64.length > 4_200_000) {
    return NextResponse.json(
      { error: "La imagen es demasiado grande. Por favor usa una imagen más pequeña." },
      { status: 413 }
    );
  }

  // Leer contexto del paciente desde Supabase (nunca confiar en el cliente para esto)
  const patientContext: { diagnosis?: string | null; age?: number | null; medications?: string[] | null } = {};

  if (userId) {
    try {
      const admin = getSupabaseAdmin();
      const [profileResult, medsResult] = await Promise.all([
        admin.from("profiles").select("diagnosis, date_of_birth").eq("id", userId).maybeSingle(),
        admin
          .from("medications")
          .select("name")
          .eq("profile_id", userId)
          .eq("status", "pending"),
      ]);

      if (profileResult.data) {
        patientContext.diagnosis = profileResult.data.diagnosis;
        patientContext.age = calculateAge(profileResult.data.date_of_birth);
      }
      if (medsResult.data?.length) {
        patientContext.medications = medsResult.data.map((m: { name: string }) => m.name);
      }
    } catch {
      // No bloquear el análisis si falla la carga del contexto
    }
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = buildPromptWithContext(patientContext);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await ai.models.generateContentStream({
          model: "gemini-2.5-flash",
          contents: [
            {
              role: "user",
              parts: [
                {
                  inlineData: {
                    data: imageBase64,
                    mimeType,
                  },
                },
                { text: prompt },
              ],
            },
          ],
        });

        for await (const chunk of response) {
          const text = chunk.text;
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }

        controller.close();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Error al analizar la imagen.";
        controller.enqueue(
          encoder.encode(`\n\n❌ **Error:** ${message}\n\nPor favor intenta de nuevo.`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
