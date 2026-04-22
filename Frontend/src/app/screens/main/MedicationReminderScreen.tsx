"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { BellRing, Check, ChevronRight, Clock3, Pill } from "lucide-react";
import { GlassCard } from "../../components/GlassCard";
import { CareGuideCard } from "../../components/brand/CareGuideCard";
import { useAuth } from "../../providers/AuthProvider";
import { supabase } from "../../../../lib/supabase";

type Medication = {
  id: string;
  name: string;
  dosage: string | null;
  frequency: string | null;
  schedule_time: string | null;
  status: string;
};

const ACCENTS = [
  "from-orange-300 to-rose-400",
  "from-amber-300 to-yellow-400",
  "from-cyan-300 to-sky-400",
  "from-fuchsia-300 to-violet-400",
  "from-purple-300 to-pink-400",
  "from-green-300 to-emerald-400",
];

const WEEK_LABELS = ["D", "L", "M", "X", "J", "V", "S"];

function buildWeekDays() {
  const today = new Date();
  const dow = today.getDay();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - dow + i);
    return { label: WEEK_LABELS[i], day: d.getDate(), active: i === dow };
  });
}

function FloatingPill({ className, gradient }: { className: string; gradient: string }) {
  return (
    <div className={`absolute rounded-full shadow-[0_18px_48px_rgba(128,115,181,0.18)] ${className} ${gradient}`} />
  );
}

export function MedicationReminderScreen() {
  const { profile } = useAuth();
  const profileId = profile?.id;
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState<Set<string>>(new Set());

  async function markTaken(id: string) {
    setMedications((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: "taken" } : m))
    );
    setMarking((prev) => new Set(prev).add(id));

    const { error } = await supabase
      .from("medications")
      .update({ status: "taken" })
      .eq("id", id);

    if (error) {
      setMedications((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: "pending" } : m))
      );
    }

    setMarking((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }
  const weekDays = buildWeekDays();
  const pendingCount = medications.filter((med) => med.status !== "taken").length;
  const guideMessage = loading
    ? "Estoy preparando tu plan de hoy para que puedas revisarlo con calma."
    : pendingCount === 0 && medications.length > 0
      ? "Todo marcado por hoy. Ese orden pequeño también cuenta como cuidado."
      : pendingCount > 0
        ? `Te acompaño con ${pendingCount} ${pendingCount === 1 ? "toma pendiente" : "tomas pendientes"} de hoy. Vamos paso a paso.`
        : "Cuando agregues tu tratamiento, te ayudaré a seguir horarios y dosis sin adivinar.";

  useEffect(() => {
    if (!profileId) return;

    async function fetchMedications() {
      setLoading(true);
      const { data } = await supabase
        .from("medications")
        .select("id, name, dosage, frequency, schedule_time, status")
        .eq("profile_id", profileId)
        .order("schedule_time", { ascending: true });

      setMedications(data ?? []);
      setLoading(false);
    }

    fetchMedications();
  }, [profileId]);

  return (
    <div className="p-6 pt-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#3b1060]">Medicamentos</h1>
            <p className="mt-1 text-sm text-gray-500">
              Tus recordatorios y dosis del día
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-sky-500 text-white">
            <BellRing className="h-6 w-6" />
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-cyan-700">
          <Pill className="h-4 w-4" />
          Plan indicado por tu médico
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06 }}
        className="mb-6"
      >
        <CareGuideCard
          title="Tratamiento sin ruido"
          message={guideMessage}
          tone="meds"
          mood={pendingCount === 0 && medications.length > 0 ? "celebrate" : "calm"}
        />
      </motion.div>

      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14 }}
        className="mb-6"
      >
        <div className="relative overflow-hidden rounded-[34px] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(247,251,255,0.9)_54%,rgba(241,246,255,0.95))] p-4 shadow-[0_24px_70px_rgba(145,169,201,0.16)]">
          <FloatingPill
            className="left-[-24px] top-[112px] h-20 w-20 blur-md"
            gradient="bg-[radial-gradient(circle_at_30%_30%,rgba(255,137,189,0.9),rgba(229,68,138,0.75))]"
          />
          <FloatingPill
            className="right-[-14px] top-[26px] h-16 w-16"
            gradient="bg-[radial-gradient(circle_at_35%_35%,rgba(213,184,255,0.95),rgba(117,73,223,0.9))]"
          />
          <FloatingPill
            className="bottom-[18px] right-[26px] h-14 w-14 blur-lg"
            gradient="bg-[radial-gradient(circle_at_30%_30%,rgba(154,218,255,0.7),rgba(88,163,255,0.45))]"
          />

          <div className="relative z-10">
            <GlassCard className="rounded-[28px] border-white/80 bg-white/76 p-5 shadow-[0_14px_34px_rgba(198,208,230,0.22)]">
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.26em] text-slate-400">Plan</p>
                  <h3 className="mt-1 text-[2rem] font-semibold tracking-[-0.05em] text-slate-950">
                    Hoy
                  </h3>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-700 shadow-[0_12px_28px_rgba(152,170,191,0.18)]">
                  <BellRing className="h-5 w-5" />
                </div>
              </div>

              {/* Week strip */}
              <div className="mb-6 grid grid-cols-7 gap-2">
                {weekDays.map((item) => (
                  <div key={`${item.label}-${item.day}`} className="text-center">
                    <p className="mb-2 text-[10px] uppercase tracking-[0.22em] text-slate-400">
                      {item.label}
                    </p>
                    <div
                      className={`mx-auto flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold ${
                        item.active
                          ? "bg-cyan-400 text-white shadow-[0_14px_26px_rgba(51,208,214,0.34)]"
                          : "bg-white/90 text-slate-700"
                      }`}
                    >
                      {item.day}
                    </div>
                  </div>
                ))}
              </div>

              {/* Medication list */}
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="h-[68px] animate-pulse rounded-[24px] bg-slate-100" />
                  ))}
                </div>
              ) : medications.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/50 px-5 py-8 text-center">
                  <Pill className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                  <p className="text-sm leading-relaxed text-slate-500">
                    Aún no tienes medicamentos. Agenda una cita para que tu médico agregue tu plan.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {medications.map((med, i) => {
                    const taken = med.status === "taken";
                    const busy = marking.has(med.id);
                    return (
                      <div
                        key={med.id}
                        className={`rounded-[24px] border px-4 py-4 transition-all ${
                          taken
                            ? "border-emerald-100 bg-emerald-50/60"
                            : "border-transparent bg-white/55 hover:scale-[1.01]"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-gradient-to-br ${ACCENTS[i % ACCENTS.length]} text-white shadow-[0_12px_24px_rgba(132,146,177,0.16)] ${taken ? "opacity-50" : ""}`}
                          >
                            <Pill className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className={`truncate text-lg font-semibold tracking-[-0.04em] ${taken ? "text-slate-400 line-through" : "text-slate-900"}`}>
                                  {med.name}
                                </p>
                                <p className="text-sm text-slate-500">
                                  {[med.dosage, med.frequency].filter(Boolean).join(" · ")}
                                </p>
                                {med.schedule_time && (
                                  <div className="mt-0.5 flex items-center gap-1 text-xs font-medium text-slate-400">
                                    <Clock3 className="h-3.5 w-3.5" />
                                    {med.schedule_time.slice(0, 5)}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => !taken && !busy && markTaken(med.id)}
                                disabled={taken || busy}
                                className={`shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                                  taken
                                    ? "bg-emerald-100 text-emerald-600 cursor-default"
                                    : "bg-slate-100 text-slate-600 hover:bg-cyan-100 hover:text-cyan-700 active:scale-95"
                                }`}
                              >
                                <Check className="h-3.5 w-3.5" />
                                {taken ? "Tomado" : busy ? "..." : "Tomar"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <button className="mt-5 flex w-full items-center justify-between rounded-[20px] bg-slate-950 px-5 py-4 text-sm font-medium text-white shadow-[0_18px_28px_rgba(15,23,42,0.18)]">
                Ver historial de adherencia
                <ChevronRight className="h-4 w-4" />
              </button>
            </GlassCard>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
