"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import {
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Heart,
  Activity,
  Moon,
  Droplet,
  Brain,
  ArrowUpRight,
  Sparkles,
  ShieldAlert,
  FileText,
  ChevronDown,
  ChevronUp,
  type LucideIcon,
} from "lucide-react";
import { GlassCard } from "../../components/GlassCard";
import { CareGuideCard } from "../../components/brand/CareGuideCard";
import { useAuth } from "../../providers/AuthProvider";
import { supabase } from "../../../../lib/supabase";

// ─── types ────────────────────────────────────────────────────────────────────

type ConditionResult = {
  probability: number;
  flag: boolean;
  threshold: number;
};

type RiskResult = {
  conditions: Record<string, ConditionResult>;
  health_score: {
    label: "bajo" | "medio" | "alto";
    class: number;
    probabilities: Record<string, number>;
  };
};

type HealthProfile = {
  sleep_hours: number | null;
  sleep_quality: string | null;
  wake_up_feeling: string | null;
  physical_activity_frequency: string | null;
  mood_general: string | null;
};

type InsightItem = {
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  iconColor: string;
  priority: "high" | "medium" | "low";
};

type MetricItem = {
  label: string;
  value: string;
  status: "alert" | "good";
  icon: LucideIcon;
  trend: string;
};

type ConnectionItem = {
  title: string;
  items: string[];
  insight: string;
};

type ExamRecord = {
  id: string;
  analysis_text: string | null;
  uploaded_at: string;
};

type AppleHealthSample = {
  metric: string;
  value: number;
  unit: string;
  measured_at: string;
};

type AppleConnectionStatus = "not_connected" | "pending" | "connected";

type AppleConnection = {
  status: AppleConnectionStatus;
  requestedAt: string | null;
  connectedAt: string | null;
  lastSyncAt: string | null;
};

// ── Diagnosis → symptoms mapping ───────────────────────────────────────────

const DIAGNOSIS_PATTERNS: Record<string, { items: string[]; insight: string }> = {
  hipotiroidismo: {
    items: ["Fatiga", "Niebla mental", "Sensibilidad al frío"],
    insight:
      "Estos síntomas son frecuentes en hipotiroidismo no compensado. Mantener tu medicación y monitorear los niveles de TSH es clave.",
  },
  hipotiroidismo_autoinmune: {
    items: ["Fatiga", "Niebla mental", "Sensibilidad al frío"],
    insight:
      "Estos síntomas son frecuentes en hipotiroidismo no compensado. Mantener tu medicación y monitorear los niveles de TSH es clave.",
  },
  endometriosis: {
    items: ["Dolor pélvico", "Fatiga", "Hinchazón"],
    insight:
      "El dolor pélvico y la fatiga tienden a intensificarse en ciclos hormonales. Registrar tu ciclo junto a estos síntomas puede ayudar a tu médica.",
  },
  dermatitis: {
    items: ["Irritación de piel", "Picazón", "Inflamación"],
    insight:
      "La dermatitis atópica tiene un componente inflamatorio sistémico. Registrar brotes junto con alimentación y estrés puede revelar patrones.",
  },
  dermatitis_atopica: {
    items: ["Irritación de piel", "Picazón", "Inflamación"],
    insight:
      "La dermatitis atópica tiene un componente inflamatorio sistémico. Registrar brotes junto con alimentación y estrés puede revelar patrones.",
  },
};

// ── ML condition metadata ──────────────────────────────────────────────────────

const CONDITION_META: Record<
  string,
  { label: string; icon: LucideIcon; color: string; iconColor: string; advice: string }
> = {
  diabetes: {
    label: "Riesgo de diabetes",
    icon: Droplet,
    color: "from-orange-50/80 to-amber-50/80",
    iconColor: "text-orange-500",
    advice: "Considera controlar tu glucosa en ayunas y reducir el consumo de azúcares.",
  },
  high_bp: {
    label: "Riesgo de hipertensión",
    icon: Heart,
    color: "from-red-50/80 to-rose-50/80",
    iconColor: "text-red-500",
    advice: "Reducir el sodio, hacer ejercicio regular y monitorear tu presión puede marcar la diferencia.",
  },
  heart_disease: {
    label: "Riesgo cardiovascular",
    icon: Heart,
    color: "from-red-50/80 to-pink-50/80",
    iconColor: "text-rose-600",
    advice: "Un chequeo cardiológico preventivo es recomendable, especialmente si tienes antecedentes familiares.",
  },
  depression: {
    label: "Riesgo de depresión",
    icon: Brain,
    color: "from-indigo-50/80 to-purple-50/80",
    iconColor: "text-indigo-500",
    advice: "El bienestar mental merece atención. Hablar con un profesional puede ser un gran primer paso.",
  },
  asthma: {
    label: "Riesgo de asma",
    icon: Activity,
    color: "from-blue-50/80 to-indigo-50/80",
    iconColor: "text-blue-500",
    advice: "Evitar irritantes del aire y consultar si tienes episodios de dificultad para respirar.",
  },
  high_cholesterol: {
    label: "Colesterol potencialmente alto",
    icon: TrendingUp,
    color: "from-amber-50/80 to-yellow-50/80",
    iconColor: "text-amber-500",
    advice: "Una dieta baja en grasas saturadas y un análisis de sangre te darán una imagen clara.",
  },
  stroke: {
    label: "Riesgo de ACV",
    icon: AlertCircle,
    color: "from-red-50/80 to-rose-50/80",
    iconColor: "text-red-600",
    advice: "Controlar la presión arterial y llevar un estilo de vida activo reduce significativamente el riesgo.",
  },
};

const HEALTH_SCORE_LABEL: Record<string, { text: string; color: string }> = {
  bajo:  { text: "Salud percibida baja",   color: "text-red-600" },
  medio: { text: "Salud percibida media",  color: "text-amber-600" },
  alto:  { text: "Salud percibida alta",   color: "text-green-600" },
};

function getDiagnosisPattern(diagnosis: string | null) {
  if (!diagnosis) return null;
  const key = diagnosis.toLowerCase().replace(/\s+/g, "_");
  if (DIAGNOSIS_PATTERNS[key]) return DIAGNOSIS_PATTERNS[key];
  for (const [k, v] of Object.entries(DIAGNOSIS_PATTERNS)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return {
    items: [diagnosis],
    insight: `Llevar un registro diario de cómo te sientes con ${diagnosis} ayuda a tu médico a ajustar tu tratamiento.`,
  };
}

// ─── static fallbacks (shown when no health_profile row exists) ───────────────

const FALLBACK_SCORE = 72;
const FALLBACK_SCORE_TREND = "↑ 3 pts";

const FALLBACK_INSIGHTS: InsightItem[] = [
  {
    title: "Atención necesaria",
    description: "Tus síntomas pueden estar relacionados con presión arterial alta. Considera agendar una revisión.",
    icon: AlertCircle,
    color: "from-red-50/80 to-orange-50/80",
    iconColor: "text-red-500",
    priority: "high",
  },
  {
    title: "Calidad del sueño",
    description: "Los patrones de sueño irregular pueden contribuir a dolores de cabeza y mareos. Apunta a 7-8 horas.",
    icon: Moon,
    color: "from-indigo-50/80 to-purple-50/80",
    iconColor: "text-indigo-500",
    priority: "medium",
  },
  {
    title: "Buen progreso",
    description: "Tu rutina diaria de ejercicio apoya la salud cardiovascular. ¡Sigue así!",
    icon: CheckCircle,
    color: "from-green-50/80 to-emerald-50/80",
    iconColor: "text-green-500",
    priority: "low",
  },
];

const FALLBACK_METRICS: MetricItem[] = [
  { label: "Presión arterial", value: "Alta", status: "alert", icon: Heart, trend: "+5%" },
  { label: "Actividad", value: "Activa", status: "good", icon: Activity, trend: "+12%" },
  { label: "Sueño", value: "Deficiente", status: "alert", icon: Moon, trend: "-8%" },
  { label: "Hidratación", value: "Bien", status: "good", icon: Droplet, trend: "+3%" },
];

const FALLBACK_CONNECTIONS: ConnectionItem[] = [
  {
    title: "Patrón detectado",
    items: ["Dolores de cabeza", "Presión alta", "Sueño deficiente"],
    insight: "Estos síntomas suelen aparecer juntos y pueden indicar hipertensión relacionada con el estrés.",
  },
];

// ─── derivation helpers ───────────────────────────────────────────────────────

function deriveSleepInsight(hp: HealthProfile): InsightItem {
  const poorQuality = ["Me despierto varias veces", "Muy ligero"].includes(
    hp.sleep_quality ?? ""
  );
  const poorWake = ["Cansada todavía", "Con ansiedad"].includes(hp.wake_up_feeling ?? "");
  const h = hp.sleep_hours;
  const tooFew = h !== null && h < 6;
  const tooMany = h !== null && h > 9;
  const goodHours = h !== null && h >= 6 && h <= 9;
  const goodQuality = hp.sleep_quality === "Profundo y reparador";

  if (tooFew || (poorQuality && poorWake)) {
    return {
      title: "Sueño insuficiente",
      description: tooFew
        ? `Estás durmiendo ${h}h, por debajo de las 6-8 recomendadas. Esto puede afectar tu energía y concentración.`
        : "La calidad de tu sueño y cómo amaneces sugieren que no estás descansando bien. Vale la pena revisarlo.",
      icon: Moon,
      color: "from-indigo-50/80 to-purple-50/80",
      iconColor: "text-indigo-500",
      priority: "high",
    };
  }
  if (tooMany) {
    return {
      title: "Mucho tiempo en cama",
      description:
        "Dormir más de 9 horas regularmente puede ser señal de fatiga acumulada o bajo estado de ánimo. Escucha cómo se siente tu cuerpo.",
      icon: Moon,
      color: "from-indigo-50/80 to-purple-50/80",
      iconColor: "text-indigo-500",
      priority: "medium",
    };
  }
  if (poorQuality) {
    return {
      title: "Calidad del sueño mejorable",
      description: `Aunque duermes${h ? ` ${h}h` : ""}, la calidad no es la mejor.${poorWake ? " El hecho de que te despiertes cansada lo confirma." : ""} Revisar tu rutina nocturna puede marcar la diferencia.`,
      icon: Moon,
      color: "from-indigo-50/80 to-purple-50/80",
      iconColor: "text-indigo-500",
      priority: "medium",
    };
  }
  return {
    title: goodQuality && goodHours ? "Sueño reparador" : "Sueño en rango normal",
    description: goodQuality
      ? `Duermes ${h}h con buena calidad. Un descanso profundo es clave para tu salud física y mental. ¡Sigue así!`
      : `Tu sueño está dentro del rango normal.${hp.wake_up_feeling === "Con energía" ? " ¡Y te levantas con energía! Eso es genial." : ""}`,
    icon: Moon,
    color: "from-green-50/80 to-emerald-50/80",
    iconColor: "text-green-500",
    priority: "low",
  };
}

function deriveActivityInsight(hp: HealthProfile): InsightItem {
  const freq = hp.physical_activity_frequency;
  if (freq === "Todos los días") {
    return {
      title: "Actividad física excelente",
      description:
        "Te mueves todos los días — eso tiene un impacto enorme en tu salud cardiovascular, tu humor y tu energía. ¡Increíble!",
      icon: Activity,
      color: "from-green-50/80 to-emerald-50/80",
      iconColor: "text-green-500",
      priority: "low",
    };
  }
  if (freq === "3-4 veces por semana") {
    return {
      title: "Buena actividad física",
      description:
        "3-4 veces por semana es una frecuencia muy saludable. Estás cumpliendo con las recomendaciones generales. ¡Buen ritmo!",
      icon: Activity,
      color: "from-green-50/80 to-emerald-50/80",
      iconColor: "text-green-500",
      priority: "low",
    };
  }
  if (freq === "1-2 veces") {
    return {
      title: "Puedes moverte un poco más",
      description:
        "Hacer ejercicio 1-2 veces por semana es un buen comienzo, pero aumentar a 3-4 veces puede mejorar tu energía y bienestar general.",
      icon: Activity,
      color: "from-amber-50/80 to-yellow-50/80",
      iconColor: "text-amber-500",
      priority: "medium",
    };
  }
  return {
    title: "Actividad física baja",
    description:
      "Moverse regularmente tiene beneficios enormes para la salud mental y física. Incluso 20 minutos de caminata al día pueden marcar una diferencia real.",
    icon: Activity,
    color: "from-red-50/80 to-orange-50/80",
    iconColor: "text-red-500",
    priority: "high",
  };
}

function deriveMoodInsight(hp: HealthProfile): InsightItem {
  const mood = hp.mood_general;
  if (mood === "Muy bien" || mood === "Bien") {
    return {
      title: "Buen estado de ánimo",
      description:
        mood === "Muy bien"
          ? "Tu estado de ánimo general es muy positivo. Eso tiene un impacto directo en tu salud física y tus relaciones. ¡Cuídalo!"
          : "Tu estado de ánimo es bueno. Mantener ese equilibrio emocional es parte fundamental de tu salud integral.",
      icon: Brain,
      color: "from-green-50/80 to-emerald-50/80",
      iconColor: "text-green-500",
      priority: "low",
    };
  }
  if (mood === "Regular" || mood === "Con altibajos") {
    return {
      title: "Bienestar emocional",
      description:
        mood === "Con altibajos"
          ? "Los altibajos emocionales son normales, pero si son frecuentes puede valer la pena explorar qué los desencadena. Pequeños hábitos hacen la diferencia."
          : "Tu ánimo está en un punto intermedio. Revisar el sueño, el ejercicio y los momentos de descanso puede ayudarte a sentirte mejor.",
      icon: Brain,
      color: "from-amber-50/80 to-yellow-50/80",
      iconColor: "text-amber-500",
      priority: "medium",
    };
  }
  if (mood === "Mal") {
    return {
      title: "Atención al bienestar emocional",
      description:
        "Sentirse mal emocionalmente de forma sostenida merece atención. Hablar con alguien de confianza o un profesional puede ser un gran paso.",
      icon: Brain,
      color: "from-red-50/80 to-orange-50/80",
      iconColor: "text-red-500",
      priority: "high",
    };
  }
  return {
    title: "Bienestar emocional",
    description:
      "El estado de ánimo es un indicador clave de salud integral. Completa tu perfil para recibir insights más personalizados.",
    icon: Brain,
    color: "from-amber-50/80 to-yellow-50/80",
    iconColor: "text-amber-500",
    priority: "medium",
  };
}

function deriveMetrics(hp: HealthProfile): MetricItem[] {
  const poorSleep =
    (hp.sleep_hours !== null && hp.sleep_hours < 6) ||
    ["Me despierto varias veces", "Muy ligero"].includes(hp.sleep_quality ?? "");
  const poorActivity =
    hp.physical_activity_frequency === "Casi nunca" ||
    hp.physical_activity_frequency === "1-2 veces";
  const poorMood = hp.mood_general === "Mal" || hp.mood_general === "Con altibajos";

  const sleepValue = hp.sleep_hours
    ? `${hp.sleep_hours}h`
    : hp.sleep_quality === "Profundo y reparador"
    ? "Bueno"
    : hp.sleep_quality
    ? "Regular"
    : "—";

  const activityValue =
    hp.physical_activity_frequency === "Todos los días"
      ? "Diario"
      : hp.physical_activity_frequency === "3-4 veces por semana"
      ? "Regular"
      : hp.physical_activity_frequency === "1-2 veces"
      ? "Poco"
      : hp.physical_activity_frequency === "Casi nunca"
      ? "Mínimo"
      : "—";

  const moodValue =
    hp.mood_general === "Muy bien"
      ? "Muy bien"
      : hp.mood_general === "Bien"
      ? "Bien"
      : hp.mood_general === "Regular"
      ? "Regular"
      : hp.mood_general === "Con altibajos"
      ? "Altibajos"
      : hp.mood_general === "Mal"
      ? "Mal"
      : "—";

  return [
    {
      label: "Sueño",
      value: sleepValue,
      status: poorSleep ? "alert" : "good",
      icon: Moon,
      trend: "—",
    },
    {
      label: "Actividad",
      value: activityValue,
      status: poorActivity ? "alert" : "good",
      icon: Activity,
      trend: "—",
    },
    {
      label: "Ánimo",
      value: moodValue,
      status: poorMood ? "alert" : "good",
      icon: Brain,
      trend: "—",
    },
    {
      label: "Hidratación",
      value: "Sin datos",
      status: "good",
      icon: Droplet,
      trend: "—",
    },
  ];
}

function deriveConnections(hp: HealthProfile): ConnectionItem[] {
  const poorSleep =
    (hp.sleep_hours !== null && hp.sleep_hours < 6) ||
    ["Me despierto varias veces", "Muy ligero"].includes(hp.sleep_quality ?? "");
  const poorActivity =
    hp.physical_activity_frequency === "Casi nunca" ||
    hp.physical_activity_frequency === "1-2 veces";
  const poorMood = hp.mood_general === "Mal" || hp.mood_general === "Con altibajos";

  if (poorSleep && poorMood) {
    return [
      {
        title: "Patrón detectado: sueño y ánimo",
        items: ["Sueño deficiente", "Ánimo bajo"],
        insight:
          "El sueño y el estado de ánimo están estrechamente relacionados. Mejorar el descanso suele tener un impacto positivo directo en cómo te sientes emocionalmente.",
      },
    ];
  }
  if (poorActivity && poorMood) {
    return [
      {
        title: "Patrón detectado: movimiento y bienestar",
        items: ["Poca actividad física", "Ánimo bajo"],
        insight:
          "La actividad física regular es uno de los mejores reguladores del ánimo. Pequeñas dosis de movimiento pueden marcar una gran diferencia.",
      },
    ];
  }
  if (poorSleep && poorActivity) {
    return [
      {
        title: "Patrón detectado: descanso y movimiento",
        items: ["Sueño deficiente", "Poca actividad física"],
        insight:
          "El ejercicio regular mejora la calidad del sueño, y dormir bien da energía para moverse más. Son hábitos que se refuerzan mutuamente.",
      },
    ];
  }
  return [];
}

function deriveScore(hp: HealthProfile): { score: number; trend: string } {
  const poorSleep =
    (hp.sleep_hours !== null && hp.sleep_hours < 6) ||
    ["Me despierto varias veces", "Muy ligero"].includes(hp.sleep_quality ?? "");
  const goodSleep =
    hp.sleep_hours !== null &&
    hp.sleep_hours >= 6 &&
    hp.sleep_hours <= 9 &&
    hp.sleep_quality === "Profundo y reparador";

  const sleepPts = goodSleep ? 35 : poorSleep ? 5 : 20;

  const activityPts =
    hp.physical_activity_frequency === "Todos los días"
      ? 35
      : hp.physical_activity_frequency === "3-4 veces por semana"
      ? 28
      : hp.physical_activity_frequency === "1-2 veces"
      ? 15
      : hp.physical_activity_frequency === "Casi nunca"
      ? 5
      : 20;

  const moodPts =
    hp.mood_general === "Muy bien"
      ? 30
      : hp.mood_general === "Bien"
      ? 24
      : hp.mood_general === "Regular"
      ? 15
      : hp.mood_general === "Con altibajos"
      ? 10
      : hp.mood_general === "Mal"
      ? 5
      : 18;

  return { score: 10 + sleepPts + activityPts + moodPts, trend: "" };
}

export function InsightsScreen() {
  const { profile, user } = useAuth();
  const router = useRouter();
  const [healthProfile, setHealthProfile] = useState<HealthProfile | null | undefined>(undefined);
  const [takenCount, setTakenCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [mlRisk, setMlRisk] = useState<RiskResult | null>(null);
  const [mlLoading, setMlLoading] = useState(false);
  const [appleSamples, setAppleSamples] = useState<AppleHealthSample[]>([]);
  const [appleLoading, setAppleLoading] = useState(false);
  const [appleConnection, setAppleConnection] = useState<AppleConnection | null>(null);
  const [appleActionLoading, setAppleActionLoading] = useState(false);
  const [exams, setExams] = useState<ExamRecord[]>([]);
  const [examsLoading, setExamsLoading] = useState(true);
  const [expandedExamId, setExpandedExamId] = useState<string | null>(null);

  const displayName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    null;

  useEffect(() => {
    if (!profile?.id) return;
    supabase
      .from("health_profile")
      .select(
        "sleep_hours, sleep_quality, wake_up_feeling, physical_activity_frequency, mood_general"
      )
      .eq("profile_id", profile.id)
      .maybeSingle()
      .then(({ data }) => setHealthProfile((data as HealthProfile) ?? null));
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;
    setAppleLoading(true);
    fetch(`/api/health-sync/apple?userId=${profile.id}&limit=300&days=30`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setAppleSamples((data?.samples ?? []) as AppleHealthSample[]);
        setAppleConnection((data?.connection ?? null) as AppleConnection | null);
      })
      .catch(() => setAppleSamples([]))
      .finally(() => setAppleLoading(false));
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;
    supabase
      .from("medications")
      .select("status")
      .eq("profile_id", profile.id)
      .then(({ data }) => {
        const rows = data ?? [];
        setTakenCount(rows.filter((r) => r.status === "taken").length);
        setTotalCount(rows.length);
      });
  }, [profile?.id]);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("exam_documents")
      .select("id, analysis_text, uploaded_at")
      .eq("profile_id", user.id)
      .order("uploaded_at", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        setExams((data ?? []) as ExamRecord[]);
        setExamsLoading(false);
      });
  }, [user?.id]);

  useEffect(() => {
    if (!profile?.id) return;
    setMlLoading(true);
    fetch("/api/risk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: profile.id }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setMlRisk(data as RiskResult))
      .catch(() => null)
      .finally(() => setMlLoading(false));
  }, [profile?.id]);

  const isLoading = healthProfile === undefined;
  const hasHealthProfile = healthProfile !== null && healthProfile !== undefined;

  const medicationInsight: InsightItem = {
    title: "Adherencia al tratamiento",
    description:
      totalCount === 0
        ? "Agenda una consulta para que tu médico asigne tu plan de medicamentos."
        : takenCount === totalCount
        ? "¡Tomaste todos tus medicamentos hoy! Mantener la constancia es clave para tu recuperación."
        : `Tomaste ${takenCount} de ${totalCount} medicamentos hoy. Recuerda completar tu plan para mejores resultados.`,
    icon: CheckCircle,
    color:
      takenCount === totalCount
        ? "from-green-50/80 to-emerald-50/80"
        : "from-amber-50/80 to-yellow-50/80",
    iconColor: takenCount === totalCount ? "text-green-500" : "text-amber-500",
    priority: takenCount < totalCount && totalCount > 0 ? "high" : "low",
  };

  const activeInsights = hasHealthProfile
    ? [
        deriveSleepInsight(healthProfile!),
        deriveActivityInsight(healthProfile!),
        deriveMoodInsight(healthProfile!),
        medicationInsight,
      ]
    : [...FALLBACK_INSIGHTS, medicationInsight];

  const activeMetrics = hasHealthProfile ? deriveMetrics(healthProfile!) : FALLBACK_METRICS;

  const latestByMetric = appleSamples.reduce<Record<string, AppleHealthSample>>((acc, sample) => {
    if (!acc[sample.metric]) acc[sample.metric] = sample;
    return acc;
  }, {});
  const latestAppleAt = appleConnection?.lastSyncAt ?? appleSamples[0]?.measured_at ?? null;
  const appleStatus: AppleConnectionStatus = appleConnection?.status ?? "not_connected";
  const appleConnected = appleStatus === "connected";

  const appleSteps = latestByMetric.steps;
  const appleSleep = latestByMetric.sleep_hours;
  const appleRestingHr = latestByMetric.heart_rate_resting;

  async function updateAppleConnectionStatus(nextStatus: AppleConnectionStatus) {
    if (!profile?.id) return;
    setAppleActionLoading(true);
    try {
      const r = await fetch("/api/health-sync/apple", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: profile.id, status: nextStatus }),
      });
      const data = await r.json().catch(() => null);
      if (r.ok && data?.connection) {
        setAppleConnection({
          status: data.connection.status,
          requestedAt: data.connection.requested_at ?? null,
          connectedAt: data.connection.connected_at ?? null,
          lastSyncAt: data.connection.last_sync_at ?? latestAppleAt ?? null,
        });
      }
    } finally {
      setAppleActionLoading(false);
    }
  }

  const diagnosisPattern = getDiagnosisPattern(profile?.diagnosis ?? null);
  const activeConnections: ConnectionItem[] = [
    ...(hasHealthProfile ? deriveConnections(healthProfile!) : FALLBACK_CONNECTIONS),
    ...(diagnosisPattern
      ? [{ title: "Patrón detectado para tu diagnóstico", ...diagnosisPattern }]
      : []),
  ];

  const { score, trend } = hasHealthProfile
    ? deriveScore(healthProfile!)
    : { score: FALLBACK_SCORE, trend: FALLBACK_SCORE_TREND };

  if (isLoading) {
    return (
      <div className="p-6 pt-8 space-y-4">
        <div className="h-8 w-48 bg-gray-200/70 rounded-full animate-pulse" />
        <div className="h-4 w-64 bg-gray-200/70 rounded-full animate-pulse" />
        <div className="h-32 w-full bg-gray-200/70 rounded-2xl animate-pulse mt-6" />
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200/70 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="h-28 w-full bg-gray-200/70 rounded-2xl animate-pulse" />
        <div className="h-28 w-full bg-gray-200/70 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-6 pt-8 pb-28">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-semibold text-[#3b1060] mb-2">Insights de salud</h1>
        <p className="text-sm text-gray-500">Tu resumen de bienestar personalizado</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06 }}
        className="mb-6"
      >
        <CareGuideCard
          title="Tu bienestar en contexto"
          message="Analizo tus hábitos de sueño, actividad y estado de ánimo para darte una imagen clara de cómo estás."
          tone="insights"
          mood="happy"
        />
      </motion.div>

      {/* Incomplete health profile banner */}
      {healthProfile === null && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-6"
        >
          <GlassCard className="bg-gradient-to-br from-purple-50/80 to-pink-50/80 border-purple-200/60">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-200 to-pink-200 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-purple-700" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800 mb-1">
                  Tu perfil de salud está incompleto
                </p>
                <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                  Cuéntanos un poco más sobre ti para recibir insights personalizados.
                </p>
                <button
                  onClick={() => router.push("/app/health-profile")}
                  className="text-sm px-4 py-2 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 text-white font-medium shadow-sm"
                >
                  Completar mi perfil
                </button>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* Health Score */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <GlassCard className="bg-gradient-to-br from-purple-100/60 to-pink-100/60">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-[#3b1060]">Puntuación de salud</h3>
            <TrendingUp className="w-5 h-5 text-purple-600" />
          </div>
          <div className="flex items-end gap-2 mb-3">
            <span className="text-5xl font-light text-gray-800">{score}</span>
            <span className="text-xl text-gray-500 mb-2">/100</span>
            {trend && <span className="text-sm text-purple-600 mb-2 ml-2">{trend}</span>}
            {totalCount > 0 && (
              <span className="text-sm text-purple-600 mb-2 ml-2">
                {takenCount}/{totalCount} meds
              </span>
            )}
          </div>
          {mlRisk?.health_score?.label && (
            <p className={`text-xs font-medium mb-2 ${HEALTH_SCORE_LABEL[mlRisk.health_score.label]?.color ?? "text-gray-500"}`}>
              {HEALTH_SCORE_LABEL[mlRisk.health_score.label]?.text} · evaluación IA
            </p>
          )}
          <div className="h-3 w-full bg-white/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-400 to-pink-400 rounded-full"
              style={{ width: `${score}%` }}
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* Key Metrics */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16 }}
        className="mb-6"
      >
        <h3 className="text-sm font-semibold text-[#6b21d6] mb-3 uppercase tracking-wider">
          Apple Health
        </h3>
        <GlassCard
          className={
            appleConnected
              ? "bg-gradient-to-br from-emerald-50/70 to-teal-50/70"
              : "bg-gradient-to-br from-gray-50/80 to-slate-50/80"
          }
        >
          {appleLoading ? (
            <div className="h-16 bg-gray-200/70 rounded-xl animate-pulse" />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-800">
                  {appleStatus === "connected"
                    ? "Conectado y sincronizando"
                    : appleStatus === "pending"
                    ? "Conexión solicitada"
                    : "Sin conexión detectada"}
                </p>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    appleStatus === "connected"
                      ? "bg-emerald-100 text-emerald-700"
                      : appleStatus === "pending"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {appleStatus === "connected"
                    ? "Activo"
                    : appleStatus === "pending"
                    ? "En proceso"
                    : "Pendiente"}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                {latestAppleAt
                  ? `Última sincronización: ${new Date(latestAppleAt).toLocaleString()}`
                  : "Aún no recibimos datos de Apple Health para este perfil."}
              </p>
              {appleConnected && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white/70 rounded-xl p-2">
                    <p className="text-[11px] text-gray-500">Pasos</p>
                    <p className="text-sm font-semibold text-gray-800">
                      {appleSteps ? Math.round(appleSteps.value).toLocaleString() : "—"}
                    </p>
                  </div>
                  <div className="bg-white/70 rounded-xl p-2">
                    <p className="text-[11px] text-gray-500">Sueño</p>
                    <p className="text-sm font-semibold text-gray-800">
                      {appleSleep ? `${appleSleep.value} h` : "—"}
                    </p>
                  </div>
                  <div className="bg-white/70 rounded-xl p-2">
                    <p className="text-[11px] text-gray-500">FC reposo</p>
                    <p className="text-sm font-semibold text-gray-800">
                      {appleRestingHr ? `${Math.round(appleRestingHr.value)} bpm` : "—"}
                    </p>
                  </div>
                </div>
              )}
              <div className="pt-1">
                {appleStatus === "not_connected" && (
                  <button
                    disabled={appleActionLoading}
                    onClick={() => updateAppleConnectionStatus("pending")}
                    className="text-xs px-3 py-2 rounded-full bg-[#6b21d6] text-white font-medium disabled:opacity-60"
                  >
                    {appleActionLoading ? "Guardando..." : "Conectar Apple Health"}
                  </button>
                )}
                {appleStatus === "pending" && (
                  <button
                    disabled={appleActionLoading}
                    onClick={() => updateAppleConnectionStatus("not_connected")}
                    className="text-xs px-3 py-2 rounded-full bg-gray-200 text-gray-700 font-medium disabled:opacity-60"
                  >
                    {appleActionLoading ? "Guardando..." : "Cancelar solicitud"}
                  </button>
                )}
              </div>
            </div>
          )}
        </GlassCard>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-6"
      >
        <h3 className="text-sm font-semibold text-[#6b21d6] mb-3 uppercase tracking-wider">Métricas clave</h3>
        <div className="grid grid-cols-2 gap-3">
          {activeMetrics.map((metric, index) => {
            const Icon = metric.icon;
            return (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + index * 0.05 }}
              >
                <GlassCard className="relative overflow-hidden">
                  <div
                    className={`absolute top-2 right-2 ${
                      metric.status === "alert" ? "text-red-600" : "text-green-600"
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                  <Icon
                    className={`w-5 h-5 mb-2 ${
                      metric.status === "alert" ? "text-red-600" : "text-green-600"
                    }`}
                  />
                  <p className="text-xs text-gray-500 mb-1">{metric.label}</p>
                  <p
                    className={`text-lg font-medium ${
                      metric.status === "alert" ? "text-red-700" : "text-green-700"
                    }`}
                  >
                    {metric.value}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{metric.trend}</p>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* ML Risk Alerts */}
      {(mlLoading || mlRisk) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="mb-6"
        >
          <h3 className="text-sm font-semibold text-[#6b21d6] mb-3 uppercase tracking-wider flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            Evaluación de riesgo IA
          </h3>
          {mlLoading && (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-20 bg-gray-200/70 rounded-2xl animate-pulse" />
              ))}
            </div>
          )}
          {!mlLoading && mlRisk && (() => {
            const flagged = Object.entries(mlRisk.conditions).filter(([, v]) => v.flag);
            if (flagged.length === 0) {
              return (
                <GlassCard className="bg-gradient-to-br from-green-50/80 to-emerald-50/80">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
                    <p className="text-sm text-gray-700">
                      Sin alertas de riesgo elevado detectadas por el modelo. ¡Buenas noticias!
                    </p>
                  </div>
                </GlassCard>
              );
            }
            return (
              <div className="space-y-3">
                {flagged.map(([cond, result]) => {
                  const meta = CONDITION_META[cond];
                  if (!meta) return null;
                  const Icon = meta.icon;
                  const pct = Math.round(result.probability * 100);
                  return (
                    <GlassCard key={cond} className="hover:scale-[1.02] transition-transform">
                      <div className={`bg-gradient-to-r ${meta.color} rounded-[16px] p-4`}>
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-full bg-white/70 flex items-center justify-center flex-shrink-0">
                            <Icon className={`w-5 h-5 ${meta.iconColor}`} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-1">
                              <h4 className="text-sm font-medium text-gray-800">{meta.label}</h4>
                              <span className="text-xs bg-red-200/60 text-red-700 px-2 py-0.5 rounded-full">
                                {pct}% prob.
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 leading-relaxed">{meta.advice}</p>
                          </div>
                        </div>
                      </div>
                    </GlassCard>
                  );
                })}
              </div>
            );
          })()}
        </motion.div>
      )}

      {/* Connected Patterns */}
      {activeConnections.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-6"
        >
          <h3 className="text-sm font-semibold text-[#6b21d6] mb-3 uppercase tracking-wider flex items-center gap-2">
            <Brain className="w-4 h-4" />
            Patrones conectados
          </h3>
          {activeConnections.map((connection, index) => (
            <GlassCard key={index} className="bg-gradient-to-br from-amber-50/70 to-yellow-50/70">
              <h4 className="text-sm font-medium text-gray-800 mb-3">{connection.title}</h4>
              <div className="flex flex-wrap gap-2 mb-3">
                {connection.items.map((item, i) => (
                  <div key={i} className="bg-white/60 px-3 py-1.5 rounded-full text-xs text-gray-700">
                    {item}
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">{connection.insight}</p>
            </GlassCard>
          ))}
        </motion.div>
      )}

      {/* AI Insights */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mb-6"
      >
        <h3 className="text-sm font-semibold text-[#6b21d6] mb-3 uppercase tracking-wider">Tus insights</h3>
        <div className="space-y-3">
          {activeInsights.map((insight, index) => {
            const Icon = insight.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + index * 0.1 }}
              >
                <GlassCard className="hover:scale-[1.02] transition-transform">
                  <div className={`bg-gradient-to-r ${insight.color} rounded-[16px] p-4`}>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/70 flex items-center justify-center flex-shrink-0">
                        <Icon className={`w-5 h-5 ${insight.iconColor}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-1">
                          <h4 className="text-sm font-medium text-gray-800">{insight.title}</h4>
                          {insight.priority === "high" && (
                            <span className="text-xs bg-red-200/60 text-red-700 px-2 py-0.5 rounded-full">
                              Urgente
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 leading-relaxed">
                          {insight.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Exam History */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
        className="mb-6"
      >
        <h3 className="text-sm font-semibold text-[#6b21d6] mb-3 uppercase tracking-wider flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Mis exámenes
        </h3>
        {examsLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 bg-gray-200/70 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : exams.length === 0 ? (
          <GlassCard>
            <p className="text-sm text-slate-400 text-center py-3">
              Aún no has guardado ningún examen. Usa el asistente para analizar uno.
            </p>
          </GlassCard>
        ) : (
          <div className="space-y-2">
            {exams.map((exam) => {
              const date = new Date(exam.uploaded_at).toLocaleDateString("es-CO", {
                day: "numeric",
                month: "long",
                year: "numeric",
              });
              const isOpen = expandedExamId === exam.id;
              const preview = exam.analysis_text?.slice(0, 100) ?? "";
              return (
                <GlassCard
                  key={exam.id}
                  className="cursor-pointer"
                  onClick={() => setExpandedExamId(isOpen ? null : exam.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-400 font-medium">{date}</p>
                      <p className="text-sm text-slate-700 mt-0.5 line-clamp-2">{preview}…</p>
                    </div>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                    )}
                  </div>
                  {isOpen && exam.analysis_text && (
                    <div className="mt-3 pt-3 border-t border-white/50 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {exam.analysis_text}
                    </div>
                  )}
                </GlassCard>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Action Button */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
      >
        <button className="w-full py-4 rounded-[20px] bg-[#6b21d6] text-white font-semibold shadow-lg shadow-purple-900/25 hover:shadow-xl hover:shadow-purple-900/35 transition-all duration-300">
          Agendar consulta médica
        </button>
      </motion.div>
    </div>
  );
}
