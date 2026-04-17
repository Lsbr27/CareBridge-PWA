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
  type LucideIcon,
} from "lucide-react";
import { GlassCard } from "../../components/GlassCard";
import { useAuth } from "../../providers/AuthProvider";
import { supabase } from "../../../../lib/supabase";

// ─── types ────────────────────────────────────────────────────────────────────

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

// ─── static fallbacks (shown when no health_profile row exists) ───────────────

const FALLBACK_SCORE = 72;
const FALLBACK_SCORE_TREND = "↑ 3 pts";

const FALLBACK_INSIGHTS: InsightItem[] = [
  {
    title: "Attention Needed",
    description: "Your symptoms may be related to high blood pressure. Consider scheduling a checkup.",
    icon: AlertCircle,
    color: "from-red-50/80 to-orange-50/80",
    iconColor: "text-red-500",
    priority: "high",
  },
  {
    title: "Sleep Quality",
    description: "Irregular sleep patterns may contribute to headaches and dizziness. Aim for 7-8 hours.",
    icon: Moon,
    color: "from-indigo-50/80 to-purple-50/80",
    iconColor: "text-indigo-500",
    priority: "medium",
  },
  {
    title: "Great Progress",
    description: "Your daily exercise routine supports cardiovascular health. Keep it up!",
    icon: CheckCircle,
    color: "from-green-50/80 to-emerald-50/80",
    iconColor: "text-green-500",
    priority: "low",
  },
];

const FALLBACK_METRICS: MetricItem[] = [
  { label: "Blood Pressure", value: "High", status: "alert", icon: Heart, trend: "+5%" },
  { label: "Activity Level", value: "Active", status: "good", icon: Activity, trend: "+12%" },
  { label: "Sleep Quality", value: "Poor", status: "alert", icon: Moon, trend: "-8%" },
  { label: "Hydration", value: "Good", status: "good", icon: Droplet, trend: "+3%" },
];

const FALLBACK_CONNECTIONS: ConnectionItem[] = [
  {
    title: "Connected Pattern Detected",
    items: ["Headaches", "High BP", "Poor Sleep"],
    insight: "These symptoms often occur together and may indicate stress-related hypertension",
  },
];

// ─── derivation helpers ───────────────────────────────────────────────────────

function deriveSleepInsight(hp: HealthProfile): InsightItem {
  const poorQuality = ["Me despierto varias veces", "Muy ligero"].includes(
    hp.sleep_quality ?? ""
  );
  const poorWake = ["Cansada todavía", "Con ansiedad"].includes(
    hp.wake_up_feeling ?? ""
  );
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
  const poorMood =
    hp.mood_general === "Mal" || hp.mood_general === "Con altibajos";

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

  const score = 10 + sleepPts + activityPts + moodPts;
  return { score, trend: "" };
}

export function InsightsScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [healthProfile, setHealthProfile] = useState<HealthProfile | null | undefined>(
    undefined // undefined = not yet fetched
  );

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

  const hasHealthProfile = healthProfile !== null && healthProfile !== undefined;

  const activeInsights = hasHealthProfile
    ? [
        deriveSleepInsight(healthProfile!),
        deriveActivityInsight(healthProfile!),
        deriveMoodInsight(healthProfile!),
      ]
    : FALLBACK_INSIGHTS;

  const activeMetrics = hasHealthProfile
    ? deriveMetrics(healthProfile!)
    : FALLBACK_METRICS;

  const activeConnections = hasHealthProfile
    ? deriveConnections(healthProfile!)
    : FALLBACK_CONNECTIONS;

  const { score, trend } = hasHealthProfile
    ? deriveScore(healthProfile!)
    : { score: FALLBACK_SCORE, trend: FALLBACK_SCORE_TREND };

  return (
    <div className="p-6 pt-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-light text-gray-800 mb-2">Health Insights</h1>
        <p className="text-sm text-gray-500">AI-powered analysis of your health data</p>
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
            <h3 className="text-base font-medium text-gray-800">Overall Health Score</h3>
            <TrendingUp className="w-5 h-5 text-purple-600" />
          </div>
          <div className="flex items-end gap-2 mb-3">
            <span className="text-5xl font-light text-gray-800">{score}</span>
            <span className="text-xl text-gray-500 mb-2">/100</span>
            {trend && <span className="text-sm text-purple-600 mb-2 ml-2">{trend}</span>}
          </div>
          <div className="h-3 w-full bg-white/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-400 to-pink-400 rounded-full"
              style={{ width: `${score}%` }}
            ></div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Key Metrics */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-6"
      >
        <h3 className="text-sm text-gray-500 mb-3 uppercase tracking-wider">Key Metrics</h3>
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
                  <div className={`absolute top-2 right-2 ${
                    metric.status === "alert" 
                      ? "text-red-600" 
                      : "text-green-600"
                  }`}>
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                  <Icon className={`w-5 h-5 mb-2 ${
                    metric.status === "alert" 
                      ? "text-red-600" 
                      : "text-green-600"
                  }`} />
                  <p className="text-xs text-gray-500 mb-1">{metric.label}</p>
                  <p className={`text-lg font-medium ${
                    metric.status === "alert" 
                      ? "text-red-700" 
                      : "text-green-700"
                  }`}>{metric.value}</p>
                  <p className="text-xs text-gray-400 mt-1">{metric.trend}</p>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Connected Patterns */}
      {activeConnections.length > 0 && <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mb-6"
      >
        <h3 className="text-sm text-gray-500 mb-3 uppercase tracking-wider flex items-center gap-2">
          <Brain className="w-4 h-4" />
          Connected Patterns
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
      </motion.div>}

      {/* AI Insights */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mb-6"
      >
        <h3 className="text-sm text-gray-500 mb-3 uppercase tracking-wider">AI Insights</h3>
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
                              High
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 leading-relaxed">{insight.description}</p>
                      </div>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Action Button */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
      >
        <button className="w-full py-4 rounded-[20px] bg-gradient-to-r from-purple-400 to-pink-400 text-white font-medium shadow-lg shadow-purple-300/30 hover:shadow-xl hover:shadow-purple-300/40 transition-all duration-300">
          Schedule Doctor Consultation
        </button>
      </motion.div>
    </div>
  );
}
