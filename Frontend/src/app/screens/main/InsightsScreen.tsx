"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
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
} from "lucide-react";
import { GlassCard } from "../../components/GlassCard";
import { useAuth } from "../../providers/AuthProvider";
import { supabase } from "../../../../lib/supabase";

// ── Diagnosis → symptoms mapping ───────────────────────────────────────────

const DIAGNOSIS_PATTERNS: Record<
  string,
  { items: string[]; insight: string }
> = {
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

function getDiagnosisPattern(diagnosis: string | null) {
  if (!diagnosis) return null;
  const key = diagnosis.toLowerCase().replace(/\s+/g, "_");
  if (DIAGNOSIS_PATTERNS[key]) return DIAGNOSIS_PATTERNS[key];
  // partial match
  for (const [k, v] of Object.entries(DIAGNOSIS_PATTERNS)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  // fallback: use the diagnosis text itself as a tag
  return {
    items: [diagnosis],
    insight: `Llevar un registro diario de cómo te sientes con ${diagnosis} ayuda a tu médico a ajustar tu tratamiento.`,
  };
}

// ── Score calculation ───────────────────────────────────────────────────────

function calcScore(taken: number, total: number) {
  if (total === 0) return 65;
  return Math.round(60 + (taken / total) * 30);
}

// ── Static visual data (structure stays identical) ──────────────────────────

const metrics = [
  { label: "Medicación", value: "—", status: "good", icon: Heart, trend: "" },
  { label: "Actividad", value: "Activa", status: "good", icon: Activity, trend: "" },
  { label: "Sueño", value: "—", status: "good", icon: Moon, trend: "" },
  { label: "Hidratación", value: "—", status: "good", icon: Droplet, trend: "" },
];

export function InsightsScreen() {
  const { profile, user } = useAuth();

  const [score, setScore] = useState<number | null>(null);
  const [takenCount, setTakenCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;

    async function load() {
      const { data } = await supabase
        .from("medications")
        .select("status")
        .eq("profile_id", profile!.id);

      const rows = data ?? [];
      const taken = rows.filter((r) => r.status === "taken").length;
      const total = rows.length;
      setTakenCount(taken);
      setTotalCount(total);
      setScore(calcScore(taken, total));
      setLoading(false);
    }

    load();
  }, [profile?.id]);

  const displayName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    null;

  const pattern = getDiagnosisPattern(profile?.diagnosis ?? null);

  const scoreValue = score ?? 65;
  const scoreWidth = `${scoreValue}%`;

  // Medication metric: show taken/total
  const metricsWithData = metrics.map((m) => {
    if (m.label === "Medicación" && totalCount > 0) {
      return {
        ...m,
        value: `${takenCount}/${totalCount}`,
        status: takenCount === totalCount ? "good" : "alert",
        trend: totalCount > 0 ? `${Math.round((takenCount / totalCount) * 100)}%` : "",
      };
    }
    return m;
  });

  const insights = [
    {
      type: "recommendation",
      title: "Adherencia al tratamiento",
      description:
        totalCount === 0
          ? "Agenda una consulta para que tu médico asigne tu plan de medicamentos."
          : takenCount === totalCount
          ? "¡Tomaste todos tus medicamentos hoy! Mantener la constancia es clave para tu recuperación."
          : `Tomaste ${takenCount} de ${totalCount} medicamentos hoy. Recuerda completar tu plan para mejores resultados.`,
      icon: CheckCircle,
      color: takenCount === totalCount ? "from-green-50/80 to-emerald-50/80" : "from-amber-50/80 to-yellow-50/80",
      iconColor: takenCount === totalCount ? "text-green-500" : "text-amber-500",
      priority: takenCount < totalCount && totalCount > 0 ? "high" : "low",
    },
    {
      type: "recommendation",
      title: "Calidad del sueño",
      description:
        "Dormir 7–8 horas favorece la regulación hormonal y reduce la fatiga. Intenta mantener un horario constante.",
      icon: Moon,
      color: "from-indigo-50/80 to-purple-50/80",
      iconColor: "text-indigo-500",
      priority: "medium",
    },
    {
      type: "positive",
      title: "Registra tu día",
      description:
        "Cuantos más datos registres, más precisa es la imagen que tu médico tiene de tu salud. ¡Sigue así!",
      icon: CheckCircle,
      color: "from-green-50/80 to-emerald-50/80",
      iconColor: "text-green-500",
      priority: "low",
    },
  ];

  return (
    <div className="p-6 pt-8 pb-28">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-light text-gray-800 mb-2">
          {displayName ? `Insights de ${displayName.split(" ")[0]}` : "Health Insights"}
        </h1>
        <p className="text-sm text-gray-500">Análisis basado en tus datos de salud</p>
      </motion.div>

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
          {loading ? (
            <div className="h-14 animate-pulse rounded-xl bg-white/40" />
          ) : (
            <>
              <div className="flex items-end gap-2 mb-3">
                <span className="text-5xl font-light text-gray-800">{scoreValue}</span>
                <span className="text-xl text-gray-500 mb-2">/100</span>
                {totalCount > 0 && (
                  <span className="text-sm text-purple-600 mb-2 ml-2">
                    {takenCount}/{totalCount} meds
                  </span>
                )}
              </div>
              <div className="h-3 w-full bg-white/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-400 to-pink-400 rounded-full transition-all duration-700"
                  style={{ width: scoreWidth }}
                />
              </div>
            </>
          )}
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
          {metricsWithData.map((metric, index) => {
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

      {/* Connected Patterns */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mb-6"
      >
        <h3 className="text-sm text-gray-500 mb-3 uppercase tracking-wider flex items-center gap-2">
          <Brain className="w-4 h-4" />
          Connected Patterns
        </h3>
        {pattern ? (
          <GlassCard className="bg-gradient-to-br from-amber-50/70 to-yellow-50/70">
            <h4 className="text-sm font-medium text-gray-800 mb-3">Patrón detectado para tu diagnóstico</h4>
            <div className="flex flex-wrap gap-2 mb-3">
              {pattern.items.map((item, i) => (
                <div key={i} className="bg-white/60 px-3 py-1.5 rounded-full text-xs text-gray-700">
                  {item}
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">{pattern.insight}</p>
          </GlassCard>
        ) : (
          <GlassCard className="bg-gradient-to-br from-amber-50/70 to-yellow-50/70">
            <h4 className="text-sm font-medium text-gray-800 mb-2">Sin diagnóstico registrado</h4>
            <p className="text-sm text-gray-600 leading-relaxed">
              Completa tu perfil con tu diagnóstico para ver patrones personalizados.
            </p>
          </GlassCard>
        )}
      </motion.div>

      {/* AI Insights */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mb-6"
      >
        <h3 className="text-sm text-gray-500 mb-3 uppercase tracking-wider">AI Insights</h3>
        <div className="space-y-3">
          {insights.map((insight, index) => {
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
          Agendar consulta médica
        </button>
      </motion.div>
    </div>
  );
}
