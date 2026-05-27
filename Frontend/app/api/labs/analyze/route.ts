import { NextResponse } from "next/server";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string }>;

export const runtime = "nodejs";

type LabsAgentResponse = {
  ok: true;
  studyType: "laboratorio" | "imagen";
  overall: {
    label: "Estable" | "Seguimiento leve" | "Revisión sugerida" | "Prioritario";
    tone: "stable" | "mild" | "review" | "priority";
    score: number;
    summary: string;
  };
  quickStats: {
    totalRead: number;
    outOfRange: number;
    inRange: number;
  };
  keyFindings: Array<{
    title: string;
    status: "stable" | "mild" | "review" | "priority";
    note: string;
    action: string;
  }>;
  detailSections: Array<{
    title: string;
    items: Array<{
      name: string;
      value: string;
      status: "low" | "normal" | "high" | "unknown";
      position: number | null;
    }>;
  }>;
  trends: Array<{
    label: string;
    value: string;
    direction: "up" | "down" | "flat";
    note: string;
  }>;
  recommendations: string[];
  followUp: {
    timing: string;
    focus: string[];
  };
  patientSummary: string[];
  findings: string[];
  actionPlan: string[];
  questionsForDoctor: string[];
  extractedTextPreview: string;
  disclaimer: string;
};

type ParsedLab = {
  name: string;
  value: number;
  unit: string;
  refLow: number | null;
  refHigh: number | null;
  status: "low" | "normal" | "high" | "unknown";
};

function normalizeText(text: string) {
  return text.replace(/\r/g, "").trim();
}

function toNumber(value: string) {
  const n = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function normalizeForMatch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function normalizeLabName(name: string) {
  const cleaned = name
    .replace(/\s+/g, " ")
    .replace(/\.$/, "")
    .trim()
    .toLowerCase();

  const titled = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

  return titled
    .replace(/\bLdl\b/g, "LDL")
    .replace(/\bHdl\b/g, "HDL")
    .replace(/\bVldl\b/g, "VLDL")
    .replace(/\bTsh\b/g, "TSH")
    .replace(/\bAst\b/g, "AST")
    .replace(/\bAlt\b/g, "ALT")
    .replace(/\bHcg\b/g, "HCG")
    .replace(/\bBhcg\b/g, "BHCG")
    .replace(/\bVmc\b/g, "VMC")
    .replace(/\bHcm\b/g, "HCM")
    .replace(/\bCcmh\b/g, "CCMH")
    .replace(/\bRdw\b/g, "RDW")
    .replace(/\bTgo\b/g, "TGO")
    .replace(/\bTgp\b/g, "TGP");
}

function classifyWithThresholdRules(name: string, value: number): ParsedLab["status"] {
  const n = normalizeForMatch(name);

  if (n.includes("triglicer")) {
    if (value < 150) return "normal";
    return "high";
  }

  if (n.includes("colesterol total")) {
    if (value < 200) return "normal";
    return "high";
  }

  if (n.includes("colesterol de alta densidad") || /\bhdl\b/i.test(name)) {
    if (value < 40) return "low";
    return "normal";
  }

  if (n.includes("gonadotropina corionica")) {
    if (value < 5.3) return "normal";
  }

  if (n.includes("tsh")) {
    if (value < 0.48) return "low";
    if (value > 4.17) return "high";
    return "normal";
  }

  if (n.includes("vitamina d")) {
    if (value < 10) return "low";
    if (value < 30) return "low";
    if (value > 100) return "high";
    return "normal";
  }

  return "unknown";
}

function classifyLab(name: string, value: number, low: number | null, high: number | null): ParsedLab["status"] {
  if (low !== null && high !== null && (low !== 0 || high !== 0)) {
    if (value < low) return "low";
    if (value > high) return "high";
    return "normal";
  }
  return classifyWithThresholdRules(name, value);
}

function rangePosition(lab: ParsedLab) {
  if (lab.refLow === null || lab.refHigh === null || lab.refLow === lab.refHigh) return null;
  const span = lab.refHigh - lab.refLow;
  if (span <= 0) return null;
  const raw = ((lab.value - lab.refLow) / span) * 100;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function deviationRatio(lab: ParsedLab) {
  if (lab.refLow === null || lab.refHigh === null) return 0;
  const span = Math.max(1e-6, lab.refHigh - lab.refLow);
  if (lab.status === "high") return (lab.value - lab.refHigh) / span;
  if (lab.status === "low") return (lab.refLow - lab.value) / span;
  return 0;
}

function isMinorDeviation(lab: ParsedLab) {
  const ratio = deviationRatio(lab);
  return ratio > 0 && ratio < 0.18;
}

function parseLabsFromText(text: string): ParsedLab[] {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const parsed: ParsedLab[] = [];
  const seen = new Set<string>();
  const rangeRegex = /^(.+?)\s+(\*?\s*-?\d+(?:[.,]\d+)?)\s+([^\s]+)\s+(-?\d+(?:[.,]\d+)?)\s*(?:-|a)\s*(-?\d+(?:[.,]\d+)?)$/i;
  const lessThanRegex = /^(.+?)\s+(?:MENOR\s+DE|<)\s*(\d+(?:[.,]\d+)?)\s+([^\s]+)$/i;
  const valueOnlyRegex = /^(.+?)\s+(-?\d+(?:[.,]\d+)?)\s+([^\s]+)$/i;
  const skipStarts = [
    "pagina",
    "fecha",
    "nombre",
    "identificacion",
    "medico",
    "empresa",
    "examen resultado",
    "metodo",
    "v. de referencia",
    "valores de referencia",
    "procesado por",
    "importante",
  ];

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+/g, " ");
    const lineLower = normalizeForMatch(line);
    if (skipStarts.some((s) => lineLower.startsWith(s))) continue;

    const rangeMatch = line.match(rangeRegex);
    if (rangeMatch) {
      const [, rawName, rawValue, unit, rawLow, rawHigh] = rangeMatch;
      const name = normalizeLabName(rawName);
      const value = toNumber(rawValue.replace("*", "").trim());
      const refLow = toNumber(rawLow);
      const refHigh = toNumber(rawHigh);
      if (value === null) continue;

      const key = `${name.toLowerCase()}|${value}|${unit.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      parsed.push({
        name,
        value,
        unit,
        refLow,
        refHigh,
        status: classifyLab(name, value, refLow, refHigh),
      });
      continue;
    }

    const ltMatch = line.match(lessThanRegex);
    if (ltMatch) {
      const [, rawName, rawValue, unit] = ltMatch;
      const name = normalizeLabName(rawName);
      const value = toNumber(rawValue);
      if (value === null) continue;

      const key = `${name.toLowerCase()}|${value}|${unit.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      parsed.push({
        name,
        value,
        unit,
        refLow: null,
        refHigh: null,
        status: classifyWithThresholdRules(name, value),
      });
      continue;
    }

    const valueOnlyMatch = line.match(valueOnlyRegex);
    if (valueOnlyMatch) {
      const [, rawName, rawValue, unit] = valueOnlyMatch;
      const name = normalizeLabName(rawName);
      const value = toNumber(rawValue);
      if (value === null) continue;

      const key = `${name.toLowerCase()}|${value}|${unit.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      parsed.push({
        name,
        value,
        unit,
        refLow: null,
        refHigh: null,
        status: classifyWithThresholdRules(name, value),
      });
    }
  }

  return parsed;
}

function labStatusText(status: ParsedLab["status"]) {
  if (status === "high") return "alto";
  if (status === "low") return "bajo";
  if (status === "normal") return "en rango";
  return "por confirmar";
}

function explainMeaning(lab: ParsedLab) {
  const n = normalizeForMatch(lab.name);
  if (n.includes("colesterol total")) {
    return "Esto sugiere más carga de grasa circulante de la ideal; conviene revisar riesgo cardiometabólico y hábitos.";
  }
  if (n.includes("colesterol de baja densidad") || /\bldl\b/i.test(lab.name)) {
    return "El LDL alto puede favorecer acumulación de grasa en arterias a largo plazo; es un punto clave para prevención.";
  }
  if (n.includes("triglicer")) {
    return "Se relaciona con cómo manejas grasas y carbohidratos; puede subir por alimentación, sedentarismo o resistencia a la insulina.";
  }
  if (n.includes("neutrofil")) {
    return "Puede reflejar variaciones de respuesta inmune; aislado y sin síntomas muchas veces se controla con seguimiento.";
  }
  if (n.includes("linfocit")) {
    return "Puede subir por respuesta inmune reciente; vale la pena correlacionarlo con síntomas e historia clínica.";
  }
  if (n.includes("eosinofil")) {
    return "Puede asociarse a alergias, inflamación o respuesta inmune específica; no siempre implica gravedad.";
  }
  if (n.includes("tgo") || n.includes("ast") || n.includes("tgp") || n.includes("alt")) {
    return "Sirve para vigilar hígado; en tu reporte se interpreta junto a medicamentos, suplementos y síntomas.";
  }
  return "Merece revisión clínica contextual para definir si requiere cambio de manejo o solo seguimiento.";
}

function isHematologyMarker(name: string) {
  const n = normalizeForMatch(name);
  return [
    "leucocit",
    "neutrofil",
    "linfocit",
    "eosinofil",
    "monocit",
    "basofil",
    "eritrocit",
    "hemoglobin",
    "hematocrito",
    "plaquetas",
    "vcm",
    "hcm",
    "mchc",
    "rdw",
    "normoblast",
  ].some((k) => n.includes(k));
}

function mentionableLab(lab: ParsedLab) {
  if (lab.status === "normal") return false;
  if (isMinorDeviation(lab)) {
    const n = normalizeForMatch(lab.name);
    if (n.includes("ldl") || n.includes("colesterol total") || n.includes("triglicer")) return true;
    return false;
  }
  return true;
}

function groupForLab(name: string) {
  const n = normalizeForMatch(name);
  if (isHematologyMarker(name)) return "Hemograma";
  if (n.includes("colesterol") || n.includes("triglicer") || n.includes("hdl") || n.includes("ldl") || n.includes("vldl")) return "Perfil lipídico";
  if (n.includes("tgo") || n.includes("ast") || n.includes("tgp") || n.includes("alt")) return "Función hepática";
  if (n.includes("testosterona") || n.includes("dehidroep") || n.includes("gonadotropina")) return "Hormonas";
  return "Otros";
}

function examMeaning(name: string) {
  const n = normalizeForMatch(name);
  if (isHematologyMarker(name)) return "Sangre: células, defensas y oxigenación";
  if (n.includes("colesterol") || n.includes("triglicer") || /\bhdl\b|\bldl\b|\bvldl\b/i.test(name)) return "Metabolismo: grasas y riesgo cardiovascular";
  if (n.includes("tgo") || n.includes("ast") || n.includes("tgp") || n.includes("alt")) return "Hígado: enzimas hepáticas";
  if (n.includes("gonadotropina") || n.includes("bhcg") || n.includes("beta")) return "Embarazo: hormona beta-hCG";
  if (n.includes("vitamina d")) return "Metabolismo óseo e inmunidad: reserva de vitamina D";
  if (n.includes("tsh") || n.includes("tiroid")) return "Tiroides: regulación hormonal y metabolismo";
  if (n.includes("dhea") || n.includes("testosterona")) return "Hormonas: eje androgénico";
  return "Parámetro clínico general";
}

function detectStudyType(text: string) {
  const t = normalizeForMatch(text);
  const looksLikeImaging =
    t.includes("ecografia") ||
    t.includes("ultrason") ||
    t.includes("transabdominal") ||
    t.includes("ovario") ||
    t.includes("utero") ||
    t.includes("endometrio");

  const strongLabSignals =
    (t.includes("cuadro hematico") ? 1 : 0) +
    (t.includes("perfil lipidico") ? 1 : 0) +
    (t.includes("trigliceridos") ? 1 : 0) +
    (t.includes("colesterol total") ? 1 : 0) +
    (t.includes("tsh") ? 1 : 0) +
    (/\bmg\/dl\b|\bui\/ml\b|\buiu\/ml\b|\bng\/ml\b|\bu\/l\b/.test(t) ? 1 : 0);

  if (looksLikeImaging && strongLabSignals < 2) return "imagen";
  if (strongLabSignals >= 2) return "laboratorio";
  return "laboratorio";
}

function extractOpinion(text: string) {
  const match = text.match(/OPINI[ÓO]N\s*:?\s*([\s\S]*?)(?:NOTA:|IMPORTANTE:|Transcrito por:|$)/i);
  return match ? match[1].replace(/\s+/g, " ").trim() : null;
}

function normalizeImagingOpinion(opinion: string) {
  let out = opinion.trim();
  out = out.replace(/\bFORMACI[ÓO]N\b/gi, "Formación");
  out = out.replace(/\bSUGESTIVA DE\b/gi, "sugestiva de");
  out = out.replace(/\bTERATOMA\b/gi, "teratoma");
  out = out.replace(/\bDE OVARIO IZQUIERDO\b/gi, "de ovario izquierdo");
  out = out.replace(/\.$/, "");
  return out;
}

function toPrudentImagingPhrase(summary: string) {
  const clean = summary.replace(/\s+/g, " ").trim();
  const normalized = clean
    .replace(/\bhallazgo\s+sugestivo\s+de\s+teratoma\b/gi, "teratoma")
    .replace(/\bsugestiv[oa]\s+de\s+teratoma\b/gi, "teratoma")
    .replace(/\bteratoma\b/gi, "hallazgo sugestivo de teratoma");

  return normalized.replace(/\s+/g, " ").trim();
}

function toUiStatus(status: ParsedLab["status"]): "stable" | "mild" | "review" | "priority" {
  if (status === "normal") return "stable";
  if (status === "unknown") return "mild";
  return "review";
}

function containsAny(text: string, words: string[]) {
  const base = normalizeForMatch(text);
  return words.some((word) => base.includes(normalizeForMatch(word)));
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer);
  return normalizeText(data.text);
}

function buildAgentResponse(text: string, notes: string): LabsAgentResponse {
  const lowered = text.toLowerCase();
  const studyType = detectStudyType(text);
  const parsedLabsRaw = parseLabsFromText(text);
  const parsedLabs = parsedLabsRaw.filter((lab) => {
    const n = normalizeForMatch(lab.name);
    return (
      n.includes("hemat") ||
      n.includes("leuco") ||
      n.includes("neutro") ||
      n.includes("linfo") ||
      n.includes("eosino") ||
      n.includes("plaqueta") ||
      n.includes("colesterol") ||
      n.includes("triglicer") ||
      n.includes("ldl") ||
      n.includes("hdl") ||
      n.includes("vldl") ||
      n.includes("tsh") ||
      n.includes("tgo") ||
      n.includes("tgp") ||
      n.includes("ast") ||
      n.includes("alt") ||
      n.includes("hcg") ||
      n.includes("gonadotropina") ||
      n.includes("vitamina d") ||
      n.includes("testosterona") ||
      n.includes("dhea")
    );
  });
  const abnormalLabs = parsedLabs.filter((lab) => lab.status === "high" || lab.status === "low");
  const relevantAbnormalLabs = abnormalLabs.filter(mentionableLab);
  const normalLabs = parsedLabs.filter((lab) => lab.status === "normal");
  const moderateCount = relevantAbnormalLabs.filter((l) => !isMinorDeviation(l)).length;

  const findings: string[] = [];
  const actionPlan: string[] = [];
  const questionsForDoctor: string[] = [];

  if (studyType === "imagen") {
    const opinion = extractOpinion(text);
    const likelyTeratoma = /teratoma/i.test(text);
    const summaryRaw = opinion ?? "Se detectó un hallazgo de imagen que requiere revisión por el equipo tratante.";
    const summary = normalizeImagingOpinion(summaryRaw);
    const carefulSummary = toPrudentImagingPhrase(summary);

    return {
      ok: true,
      studyType: "imagen",
      overall: likelyTeratoma
        ? { label: "Revisión sugerida", tone: "review", score: 66, summary: "Hallazgo de imagen para valoración especializada, sin conclusiones absolutas desde este resumen." }
        : { label: "Seguimiento leve", tone: "mild", score: 78, summary: "Estudio de imagen con hallazgos para contextualizar en consulta." },
      quickStats: { totalRead: 1, outOfRange: 1, inRange: 0 },
      keyFindings: [
        {
          title: "Ecografía pélvica",
          status: likelyTeratoma ? "review" : "mild",
          note: "Qué mide: anatomía de útero, ovarios y estructuras pélvicas (imagen, no sangre).",
          action: "Validar conducta con ginecología tratante.",
        },
        {
          title: "Opinión del informe",
          status: likelyTeratoma ? "review" : "mild",
          note: carefulSummary,
          action: "Definir si requiere control o estudio complementario.",
        },
      ],
      detailSections: [
        {
          title: "Informe de imagen",
          items: [
            { name: "Tipo", value: "Ecografía pélvica/ginecológica", status: "unknown", position: null },
            { name: "Hallazgo principal", value: carefulSummary, status: likelyTeratoma ? "high" : "unknown", position: null },
          ],
        },
      ],
      trends: [{ label: "Estudio", value: "Imagen", direction: "flat", note: "No aplica tendencia numérica directa." }],
      recommendations: [
        "Este tipo de examen se interpreta por contexto clínico e imagen, no por rangos de laboratorio.",
        "Lleva el informe a ginecología para definir plan de seguimiento.",
        "No asumir diagnóstico definitivo sin evaluación médica integral.",
      ],
      followUp: {
        timing: "Seguimiento según indicación de ginecología tratante.",
        focus: ["Correlación clínica", "Control por imagen", "Plan diagnóstico"],
      },
      patientSummary: [
        "Este estudio es de imagen diagnóstica, no un panel de sangre.",
        "El hallazgo es sugestivo y requiere correlación clínica especializada, sin asumir diagnóstico definitivo desde este resumen.",
      ],
      findings: [
        "Qué mide este examen: estructura pélvica (útero, ovarios, endometrio).",
        `Hallazgo resumido: ${carefulSummary}.`,
      ],
      actionPlan: [
        "Agenda control con ginecología y lleva este informe completo.",
        "Pide claridad sobre tiempos de control y señales de alarma específicas para tu caso.",
      ],
      questionsForDoctor: [
        "¿Qué significa este hallazgo en mi contexto clínico?",
        "¿Necesito control por imagen en corto plazo?",
        "¿Requiere estudio complementario para confirmar conducta?",
        "¿Qué síntomas ameritan consulta antes del próximo control?",
      ],
      extractedTextPreview: text.slice(0, 1600),
      disclaimer: "Resumen educativo. En imagen diagnóstica se usa lenguaje de probabilidad clínica (sugestivo/compatible) y la interpretación final depende del equipo médico tratante.",
    };
  }

  const hema = parsedLabs.filter((l) => isHematologyMarker(l.name));
  const hemaAbnormal = hema.filter((l) => l.status !== "normal");
  const hemaRelevant = hemaAbnormal.filter(mentionableLab);
  if (hema.length > 0) {
    if (hemaRelevant.length === 0) {
      findings.push("Tu hemograma se ve estable en general.");
    } else {
      findings.push("Tu hemograma se ve estable en general, con variaciones leves que vale la pena vigilar.");
    }
  }

  if (hemaRelevant.some((l) => l.name.toLowerCase().includes("neutrofil"))) {
    findings.push("Los neutrófilos están levemente por debajo de lo esperado; esto puede ser transitorio y aislado no suele ser urgente.");
  }
  if (hemaRelevant.some((l) => l.name.toLowerCase().includes("linfocit"))) {
    findings.push("Los linfocitos aparecen algo elevados, un patrón que puede verse en respuestas inmunes recientes.");
  }
  if (hemaRelevant.some((l) => l.name.toLowerCase().includes("eosinofil"))) {
    findings.push("Los eosinófilos merecen seguimiento clínico si se mantienen altos en controles posteriores.");
  }

  for (const lab of relevantAbnormalLabs.slice(0, 4)) {
    const nameLower = lab.name.toLowerCase();
    if (nameLower.includes("neutrofil") || nameLower.includes("linfocit") || nameLower.includes("eosinofil")) {
      continue;
    }
    findings.push(`${lab.name}: ${labStatusText(lab.status)}. ${explainMeaning(lab)}`);
  }

  if (relevantAbnormalLabs.length === 0 && parsedLabs.length > 0) {
    findings.push("No veo hallazgos de alto peso clínico en lo parseado automáticamente.");
  }

  const keyNormals = normalLabs.filter((lab) =>
    containsAny(lab.name.toLowerCase(), ["tgo", "tgp", "ast", "alt", "hemoglobina", "plaquetas", "hdl", "triglicer"])
  );
  if (keyNormals.length > 0) {
    const shortList = keyNormals
      .slice(0, 3)
      .map((lab) => `${lab.name} (${lab.value} ${lab.unit})`)
      .join(", ");
    findings.push(`Punto tranquilizador: hay parámetros relevantes en rango (${shortList}).`);
  }

  if (containsAny(lowered, ["triglicer", "trigly"])) {
    questionsForDoctor.push(
      "¿En mi caso, los triglicéridos están en rango esperado o requieren cambios en alimentación/hábitos?"
    );
  }

  if (containsAny(lowered, ["transamin", "alt", "ast", "tgp", "tgo"])) {
    questionsForDoctor.push(
      "¿Mis transaminasas pueden estar relacionadas con medicamentos, suplementos o el tratamiento actual?"
    );
  }

  if (containsAny(lowered, ["glucosa", "hemoglobina glicosilada", "hba1c"])) {
    findings.push(
      "El reporte incluye marcadores de azúcar en sangre. Son útiles para evaluar metabolismo y riesgo cardiometabólico."
    );
    questionsForDoctor.push(
      "¿Necesito control adicional de glucosa o repetir exámenes en los próximos meses?"
    );
  }

  if (findings.length === 0 || parsedLabs.length === 0) {
    findings.push(
      "Tu PDF fue leído correctamente, pero para darte una interpretación más precisa necesito valores numéricos más legibles en el documento."
    );
    questionsForDoctor.push(
      "¿Podríamos revisar juntos cuáles de mis valores fueron los más importantes en este examen?"
    );
  }

  if (notes.trim().length > 0) {
    findings.push(
      `Tomé en cuenta tu nota adicional: "${notes.trim().slice(0, 180)}${notes.trim().length > 180 ? "..." : ""}".`
    );
  }

  actionPlan.push("En consulta, prioriza los hallazgos persistentes y evita sobrerreaccionar a variaciones mínimas aisladas.");
  actionPlan.push("Pide un plan concreto de seguimiento: qué repetir y en cuánto tiempo para ver tendencia.");
  actionPlan.push("No cambies ni suspendas medicamentos sin validarlo con tu médica tratante.");
  actionPlan.push("Si presentas síntomas nuevos o te preocupa un valor, prioriza consulta médica.");

  while (questionsForDoctor.length < 4) {
    const fallback = [
      "¿Qué valor de este examen considera prioritario para mi caso y por qué?",
      "¿Cada cuánto debo repetir estos laboratorios para hacer seguimiento?",
      "¿Qué cambios concretos en hábitos me recomienda esta semana?",
      "¿Hay algo en estos resultados que cambie mi plan de tratamiento?",
    ];
    const next = fallback[questionsForDoctor.length];
    if (next) questionsForDoctor.push(next);
    else break;
  }

  const overall =
    moderateCount >= 4
      ? {
          label: "Revisión sugerida" as const,
          tone: "review" as const,
          score: 64,
          summary: "Hay varios hallazgos para revisar con calma en consulta, sin señales de urgencia inmediata.",
        }
      : relevantAbnormalLabs.length >= 2
        ? {
            label: "Seguimiento leve" as const,
            tone: "mild" as const,
            score: 78,
            summary: "Perfil general estable con algunos puntos puntuales para seguimiento.",
          }
        : {
            label: "Estable" as const,
            tone: "stable" as const,
            score: 90,
            summary: "Panorama general estable en el corte actual.",
          };

  const keyFindings = relevantAbnormalLabs.slice(0, 3).map((lab) => ({
    title: lab.name,
    status: toUiStatus(lab.status),
    note: `Qué mide: ${examMeaning(lab.name)}. ${explainMeaning(lab)}`,
    action: "Seguimiento en próxima consulta clínica.",
  }));

  if (keyFindings.length === 0 && parsedLabs.length > 0) {
    keyFindings.push({
      title: "Sin hallazgos prioritarios",
      status: "stable",
      note: "No se identifican alteraciones de alto peso clínico en la lectura automática.",
      action: "Mantener control periódico según indicación médica.",
    });
  }

  const grouped = new Map<string, ParsedLab[]>();
  for (const lab of parsedLabs) {
    const group = groupForLab(lab.name);
    const current = grouped.get(group) ?? [];
    current.push(lab);
    grouped.set(group, current);
  }

  const detailSections = Array.from(grouped.entries()).map(([title, items]) => ({
    title,
    items: items
      .sort((a, b) => {
        const aW = a.status === "normal" ? 1 : 0;
        const bW = b.status === "normal" ? 1 : 0;
        return aW - bW;
      })
      .slice(0, 12)
      .map((lab) => ({
        name: lab.name,
        value: `${lab.value} ${lab.unit}`.trim(),
        status: lab.status,
        position: rangePosition(lab),
      })),
  }));

  const trends = [
    {
      label: "LDL",
      value: (parsedLabs.find((l) => /\bldl\b/i.test(l.name))?.value ?? 0).toString(),
      direction: "flat" as const,
      note: "Sin histórico suficiente para tendencia.",
    },
    {
      label: "Triglicéridos",
      value: (parsedLabs.find((l) => l.name.toLowerCase().includes("triglicer"))?.value ?? 0).toString(),
      direction: "flat" as const,
      note: "Primer corte en CareMosaic.",
    },
    {
      label: "Neutrófilos %",
      value: (parsedLabs.find((l) => l.name.toLowerCase().includes("neutrofilos %"))?.value ?? 0).toString(),
      direction: "flat" as const,
      note: "Comparar en próximo control.",
    },
  ];

  const hcg = parsedLabs.find((l) => {
    const n = normalizeForMatch(l.name);
    return n.includes("gonadotropina") || n.includes("hcg") || n.includes("bhcg");
  });
  const vitaminD = parsedLabs.find((l) => normalizeForMatch(l.name).includes("vitamina d"));

  if (hcg) {
    const hcgIsNegative = hcg.value < 6;
    findings.unshift(
      hcgIsNegative
        ? "Prueba de embarazo (β-hCG): resultado compatible con negativa en este corte."
        : "Prueba de embarazo (β-hCG): resultado por encima del umbral de negativa; requiere correlación clínica."
    );
  }

  if (vitaminD) {
    if (vitaminD.value < 10) {
      findings.unshift("Vitamina D: nivel en rango de deficiencia.");
    } else if (vitaminD.value < 30) {
      findings.unshift("Vitamina D: nivel en rango de insuficiencia.");
    } else {
      findings.unshift("Vitamina D: nivel dentro de suficiencia.");
    }
  }

  return {
    ok: true,
    studyType: "laboratorio",
    overall,
    quickStats: {
      totalRead: parsedLabs.length,
      outOfRange: abnormalLabs.length,
      inRange: normalLabs.length,
    },
    keyFindings,
    detailSections,
    trends,
    recommendations: [
      "Prioriza control de perfil lipídico en tu próxima consulta.",
      "Evita cambios de tratamiento sin validación médica.",
      "Repite laboratorios para confirmar tendencia, no solo un valor aislado.",
    ],
    followUp: {
      timing: "Control sugerido en 8-12 semanas (según criterio médico).",
      focus: ["Perfil lipídico", "Diferencial leucocitario", "Correlación con síntomas"],
    },
    patientSummary: [
      "Ya revisé tu PDF y te traduzco lo importante en lenguaje simple.",
      relevantAbnormalLabs.length > 0
        ? "Veo un patrón de cambios leves que se puede manejar con seguimiento prudente y contexto clínico."
        : "En conjunto, no veo señales de alarma mayores en lo parseado automáticamente.",
    ],
    findings,
    actionPlan,
    questionsForDoctor: questionsForDoctor.slice(0, 6),
    extractedTextPreview: text.slice(0, 1600),
    disclaimer:
      "Este resumen es educativo y no reemplaza una consulta médica. Si tienes dolor fuerte, mareo intenso o empeoramiento súbito, busca atención prioritaria.",
  };
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const notes = (form.get("notes") as string) ?? "";

    if (!file) {
      return NextResponse.json({ error: "Falta el archivo PDF" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "El archivo debe ser PDF" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const text = await extractTextFromPdf(buffer);

    if (!text) {
      return NextResponse.json(
        { error: "No se pudo extraer texto del PDF" },
        { status: 422 }
      );
    }

    return NextResponse.json(buildAgentResponse(text, notes));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error procesando PDF";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
