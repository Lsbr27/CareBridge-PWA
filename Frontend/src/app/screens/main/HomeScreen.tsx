"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Circle,
  ClipboardList,
  Flame,
  FlaskConical,
  Pill,
  Send,
  Stethoscope,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { GlassCard } from "../../components/GlassCard";
import { GhostMascot } from "../../components/brand/GhostMascot";
import { useAuth } from "../../providers/AuthProvider";
import { supabase } from "../../../../lib/supabase";

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function formatDateTimeES(iso: string) {
  const d = new Date(iso);
  const date = `${d.getDate()} de ${MONTHS_ES[d.getMonth()]} de ${d.getFullYear()}`;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return { date, time: `${hh}:${mm}` };
}

function isTomorrow(isoString: string): boolean {
  const appt = new Date(isoString);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return (
    appt.getFullYear() === tomorrow.getFullYear() &&
    appt.getMonth() === tomorrow.getMonth() &&
    appt.getDate() === tomorrow.getDate()
  );
}

function isToday(isoString: string): boolean {
  const appt = new Date(isoString);
  const today = new Date();
  return (
    appt.getFullYear() === today.getFullYear() &&
    appt.getMonth() === today.getMonth() &&
    appt.getDate() === today.getDate()
  );
}

function getGreeting(hour: number): string {
  if (hour < 12) return "Buenos días";
  if (hour < 18) return "Buenas tardes";
  return "Buenas noches";
}

function getContextMessage(
  hour: number,
  pendingMeds: number,
  nextApptToday: boolean,
  loggedToday: boolean
): string {
  if (pendingMeds > 0 && hour < 14)
    return `Tienes ${pendingMeds} ${pendingMeds === 1 ? "medicamento pendiente" : "medicamentos pendientes"} de esta mañana.`;
  if (nextApptToday)
    return "Tienes una cita hoy. ¿Ya preparaste tus preguntas?";
  if (!loggedToday && hour >= 18)
    return "¿Cómo te fue hoy? Registra tu log antes de dormir.";
  if (pendingMeds === 0 && loggedToday)
    return "Todo al día. Así se construye la salud.";
  return "Bienvenida a tu resumen de salud.";
}

function calcLogStreak(logs: { logged_at: string }[]): number {
  const days = new Set(logs.map((l) => l.logged_at.split("T")[0]));
  let streak = 0;
  const today = new Date();
  for (let i = 0; i <= 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    if (days.has(dateStr)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}

type Appointment = {
  id: string;
  title: string;
  appointment_at: string;
  provider_name: string | null;
};

type MedCounts = { pending: number; taken: number; total: number };

type Nudge = {
  tone: "default" | "meds" | "daily" | "appointments" | "insights";
  title: string;
  message: string;
  prompt: string;
};

function resolveNudge(
  medCounts: MedCounts | undefined,
  nextAppt: Appointment | null | undefined,
  todayLogExists: boolean
): Nudge {
  if (medCounts && medCounts.pending > 0) {
    return {
      tone: "meds",
      title: `${medCounts.pending} medicamento${medCounts.pending > 1 ? "s" : ""} pendiente${medCounts.pending > 1 ? "s" : ""}`,
      message: "¿Ya los tomaste hoy? Puedo recordarte cuáles son.",
      prompt: "¿Cuáles son mis medicamentos pendientes de hoy?",
    };
  }
  if (nextAppt && isTomorrow(nextAppt.appointment_at)) {
    return {
      tone: "appointments",
      title: "Cita mañana",
      message: `Con ${nextAppt.provider_name ?? "tu especialista"}. ¿Preparamos tus preguntas?`,
      prompt: "Tengo una cita mañana, ayúdame a prepararme",
    };
  }
  if (!todayLogExists) {
    return {
      tone: "daily",
      title: "¿Cómo estás hoy?",
      message: "Cuéntame cómo te sientes y lo registro en tu diario de salud.",
      prompt: "Quiero registrar cómo me siento hoy",
    };
  }
  return {
    tone: "default",
    title: "Tu salud toma forma",
    message: "Pregúntame sobre tus medicamentos, citas o cómo te sientes.",
    prompt: "",
  };
}

export function HomeScreen() {
  const { profile, user } = useAuth();
  const router = useRouter();
  const displayName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "there";
  const profileId = profile?.id;

  const [nextAppt, setNextAppt] = useState<Appointment | null | undefined>(undefined);
  const [medCounts, setMedCounts] = useState<MedCounts | undefined>(undefined);
  const [todayLogExists, setTodayLogExists] = useState(true);
  const [loggedToday, setLoggedToday] = useState(false);
  const [logStreak, setLogStreak] = useState(0);
  const [quickInput, setQuickInput] = useState("");

  useEffect(() => {
    if (!profileId) return;

    async function load() {
      const now = new Date().toISOString();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [apptRes, medsRes, logRes, recentLogsRes] = await Promise.all([
        supabase
          .from("appointments")
          .select("id, title, appointment_at, provider_name")
          .eq("profile_id", profileId)
          .eq("status", "scheduled")
          .gt("appointment_at", now)
          .order("appointment_at", { ascending: true })
          .limit(1)
          .maybeSingle(),

        supabase
          .from("medications")
          .select("status")
          .eq("profile_id", profileId),

        supabase
          .from("daily_logs")
          .select("id")
          .eq("profile_id", profileId)
          .gte("logged_at", todayStart.toISOString())
          .limit(1)
          .maybeSingle(),

        supabase
          .from("daily_logs")
          .select("logged_at")
          .eq("profile_id", profileId)
          .gte("logged_at", thirtyDaysAgo.toISOString())
          .order("logged_at", { ascending: false }),
      ]);

      setNextAppt(apptRes.data ?? null);

      if (medsRes.data) {
        const rows = medsRes.data;
        setMedCounts({
          total: rows.length,
          taken: rows.filter((r) => r.status === "taken").length,
          pending: rows.filter((r) => r.status === "pending").length,
        });
      } else {
        setMedCounts({ total: 0, taken: 0, pending: 0 });
      }

      const hasLog = !!logRes.data;
      setTodayLogExists(hasLog);
      setLoggedToday(hasLog);

      if (recentLogsRes.data) {
        setLogStreak(calcLogStreak(recentLogsRes.data));
      }
    }

    load();
  }, [profileId]);

  const hour = new Date().getHours();
  const nextApptToday = nextAppt ? isToday(nextAppt.appointment_at) : false;
  const pendingMeds = medCounts?.pending ?? 0;

  const apptFormatted = nextAppt ? formatDateTimeES(nextAppt.appointment_at) : null;
  const medsLoading = medCounts === undefined;
  const apptLoading = nextAppt === undefined;

  const nudge = resolveNudge(medCounts, nextAppt, todayLogExists);

  const handleQuickSend = () => {
    if (!quickInput.trim()) return;
    router.push(`/app/chat?new=1&q=${encodeURIComponent(quickInput.trim())}`);
    setQuickInput("");
  };

  const priorityCard = (() => {
    if (pendingMeds > 0 && hour < 22) return "meds";
    if (nextApptToday) return "appt";
    if (!loggedToday && hour >= 16) return "log";
    if (logStreak >= 3) return "streak";
    return null;
  })();

  return (
    <div className="p-6 pt-8 pb-28">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-semibold text-[#3b1060]">
              {getGreeting(hour)}, {displayName}
            </h1>
            {profile?.diagnosis ? (
              <p className="text-sm text-purple-600 mt-1 font-medium">{profile.diagnosis}</p>
            ) : (
              <p className="text-sm text-gray-500 mt-1">
                {getContextMessage(hour, pendingMeds, nextApptToday, loggedToday)}
              </p>
            )}
            {logStreak >= 2 && (
              <p className="text-xs text-purple-500 font-medium mt-1">
                🔥 {logStreak} días seguidos
              </p>
            )}
          </div>
          <GhostMascot size="xs" mood="happy" />
        </div>
      </motion.div>

      {/* Onboarding CTA — visible until health profile is completed */}
      {profile && !profile.onboarding_chat_completed && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="mb-6"
        >
          <button
            onClick={() => router.push("/app/onboarding")}
            className="w-full text-left active:scale-[0.98] transition-transform"
            aria-label="Completar perfil de salud"
          >
            <div className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-[#6b21d6] to-[#db2777] p-5 shadow-xl">
              <div className="absolute -top-5 -right-5 w-28 h-28 rounded-full bg-white/10" />
              <div className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full bg-white/10" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-purple-200 mb-1">
                    Paso 2 de 2
                  </p>
                  <h3 className="text-lg font-semibold text-white leading-tight mb-1.5">
                    Completa tu perfil de salud
                  </h3>
                  <p className="text-sm text-purple-100 leading-relaxed">
                    Cuéntame sobre ti en una conversación corta para acompañarte mejor.
                  </p>
                </div>
                <GhostMascot size="xs" mood="happy" />
              </div>
              <div className="relative mt-4 flex items-center gap-1.5">
                <span className="text-sm font-semibold text-white">Empezar ahora</span>
                <ArrowRight className="w-4 h-4 text-white" />
              </div>
            </div>
          </button>
        </motion.div>
      )}

      {/* Daily check-in chat widget — shown when onboarding is complete */}
      {profile?.onboarding_chat_completed && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="mb-6"
        >
          <div className="bg-white/70 backdrop-blur-xl border border-white/80 rounded-[24px] p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <GhostMascot size="xs" mood="happy" />
                <div>
                  <p className="text-xs font-semibold text-purple-700">CareGuide</p>
                  <p className="text-[10px] text-slate-400">Tu asistente de salud</p>
                </div>
              </div>
              <button
                onClick={() => router.push("/app/chat")}
                className="text-[11px] text-purple-500 font-medium active:opacity-60"
              >
                Ver historial →
              </button>
            </div>

            <div className="bg-gradient-to-br from-purple-50/80 to-pink-50/60 border border-purple-100/60 rounded-[16px] rounded-tl-sm px-4 py-3 mb-3">
              <p className="text-sm text-slate-700 leading-relaxed">{nudge.message}</p>
            </div>

            <div className="flex items-center gap-2">
              <input
                value={quickInput}
                onChange={(e) => setQuickInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleQuickSend(); }}
                placeholder="Cuéntame cómo estás…"
                className="flex-1 bg-purple-50/40 border border-purple-100 rounded-full px-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-purple-300 transition-colors"
              />
              <button
                onClick={handleQuickSend}
                disabled={!quickInput.trim()}
                className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-md disabled:opacity-40 active:scale-95 transition-transform"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Priority action card */}
      {priorityCard && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="mb-6"
        >
          {priorityCard === "meds" && (
            <button
              onClick={() => router.push("/app/medications")}
              className="w-full text-left active:scale-[0.98] transition-transform"
            >
              <GlassCard className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                    <Pill className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">
                      {pendingMeds} {pendingMeds === 1 ? "medicamento pendiente" : "medicamentos pendientes"}
                    </p>
                    <p className="text-xs text-gray-500">Mantén tu tratamiento al día</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </GlassCard>
            </button>
          )}

          {priorityCard === "appt" && nextAppt && (
            <GlassCard className="bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800">Tienes una cita hoy</p>
                  <p className="text-xs text-gray-500">
                    {nextAppt.provider_name ?? "Especialista"} · {apptFormatted?.time}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </GlassCard>
          )}

          {priorityCard === "log" && (
            <button
              onClick={() => router.push("/app/add")}
              className="w-full text-left active:scale-[0.98] transition-transform"
            >
              <GlassCard className="bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-400 flex items-center justify-center flex-shrink-0">
                    <ClipboardList className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">¿Cómo te sientes hoy?</p>
                    <p className="text-xs text-gray-500">Registra tu log antes de dormir</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </GlassCard>
            </button>
          )}

          {priorityCard === "streak" && (
            <GlassCard className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-400 flex items-center justify-center flex-shrink-0">
                  <Flame className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800">
                    🔥 {logStreak} días seguidos registrando tu salud
                  </p>
                  <p className="text-xs text-gray-500">¡Sigue así!</p>
                </div>
              </div>
            </GlassCard>
          )}
        </motion.div>
      )}

      {/* Medications summary */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.16 }}
        className="mb-6"
      >
        <GlassCard className="bg-gradient-to-br from-purple-100/60 to-pink-100/60">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-medium text-gray-800">Medicamentos de hoy</h3>
            <Pill className="w-5 h-5 text-purple-600" />
          </div>

          {medsLoading ? (
            <div className="h-10 animate-pulse rounded-xl bg-white/40" />
          ) : medCounts!.total === 0 ? (
            <p className="text-sm text-gray-500">
              Aún no tienes medicamentos asignados.
            </p>
          ) : (
            <>
              <div className="flex items-end gap-2 mb-3">
                <span className="text-5xl font-light text-gray-800">{medCounts!.taken}</span>
                <span className="text-xl text-gray-500 mb-2">/ {medCounts!.total}</span>
              </div>
              <div className="h-3 w-full bg-white/50 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-gradient-to-r from-purple-400 to-pink-400 rounded-full transition-all"
                  style={{ width: `${Math.round((medCounts!.taken / medCounts!.total) * 100)}%` }}
                />
              </div>
              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1.5 text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                  {medCounts!.taken} tomados
                </span>
                <span className="flex items-center gap-1.5 text-gray-400">
                  <Circle className="w-4 h-4" />
                  {medCounts!.pending} pendientes
                </span>
              </div>
            </>
          )}
        </GlassCard>
      </motion.div>

      {/* Diagnosis card */}
      {profile?.diagnosis && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
          className="mb-6"
        >
          <h3 className="text-sm font-semibold text-[#6b21d6] mb-3 uppercase tracking-wider">Tu diagnóstico</h3>
          <GlassCard>
            <div className="bg-gradient-to-br from-purple-100/70 to-pink-100/70 rounded-[16px] p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-white/70 flex items-center justify-center">
                  <Stethoscope className="w-5 h-5 text-purple-600" />
                </div>
                <h4 className="text-sm font-medium text-gray-800">Condición principal</h4>
              </div>
              <p className="text-sm text-gray-700 pl-13">{profile.diagnosis}</p>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* Next Appointment */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.32 }}
        className="mb-6"
      >
        <h3 className="text-sm font-semibold text-[#6b21d6] mb-3 uppercase tracking-wider">Próxima cita</h3>

        {apptLoading ? (
          <div className="h-24 animate-pulse rounded-[20px] bg-white/40" />
        ) : nextAppt ? (
          <GlassCard className="bg-gradient-to-br from-indigo-100/60 to-blue-100/60">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">{nextAppt.title}</p>
                <p className="text-xl font-light text-gray-800">{apptFormatted!.date}</p>
                <p className="text-sm text-gray-600 mt-1">
                  {nextAppt.provider_name ?? "Especialista"} · {apptFormatted!.time}
                </p>
              </div>
              <Calendar className="w-8 h-8 text-indigo-600 shrink-0" />
            </div>
          </GlassCard>
        ) : (
          <GlassCard className="bg-gradient-to-br from-indigo-100/60 to-blue-100/60">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Sin citas programadas</p>
                <p className="text-sm text-gray-500 mt-1">
                  Dile a CareGuide que quieres agendar con un especialista.
                </p>
              </div>
              <Calendar className="w-8 h-8 text-indigo-300 shrink-0" />
            </div>
          </GlassCard>
        )}
      </motion.div>

      {/* Labs entry card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <h3 className="text-sm font-semibold text-[#6b21d6] mb-3 uppercase tracking-wider">Herramientas</h3>
        <button
          onClick={() => router.push("/app/laboratorios")}
          className="w-full text-left active:scale-[0.98] transition-transform"
        >
          <GlassCard className="bg-gradient-to-br from-teal-50 to-emerald-50 border-teal-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center flex-shrink-0">
                <FlaskConical className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">CareGuide Laboratorios</p>
                <p className="text-xs text-gray-500">Sube tu PDF y entiende tus resultados</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </div>
          </GlassCard>
        </button>
      </motion.div>
    </div>
  );
}
