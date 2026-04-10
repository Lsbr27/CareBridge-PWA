"use client";

import { motion } from "motion/react";
import {
  BellRing,
  ChevronRight,
  Clock3,
  Pill,
  Plus,
  Sparkles,
  Syringe,
} from "lucide-react";
import { GlassCard } from "./GlassCard";

const weekDays = [
  { label: "M", day: 7 },
  { label: "T", day: 8 },
  { label: "W", day: 9, active: true },
  { label: "T", day: 10 },
  { label: "F", day: 11 },
  { label: "S", day: 12 },
  { label: "S", day: 13 },
];

const reminders = [
  {
    name: "Centrum",
    detail: "1 capsule",
    time: "09:00",
    accent: "from-orange-300 to-rose-400",
    icon: Pill,
  },
  {
    name: "Sinupret",
    detail: "2 pills",
    time: "13:00",
    accent: "from-amber-300 to-yellow-400",
    icon: Pill,
  },
  {
    name: "Mixture",
    detail: "1 dosing sp.",
    time: "18:30",
    accent: "from-cyan-300 to-sky-400",
    icon: Syringe,
    featured: true,
  },
  {
    name: "Centrum",
    detail: "1 capsule",
    time: "20:00",
    accent: "from-fuchsia-300 to-violet-400",
    icon: Pill,
  },
];

function FloatingPill({
  className,
  gradient,
}: {
  className: string;
  gradient: string;
}) {
  return (
    <div
      className={`absolute rounded-full shadow-[0_18px_48px_rgba(128,115,181,0.18)] ${className} ${gradient}`}
    />
  );
}

export function MedicationReminderFeature() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 }}
      className="mb-6"
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.26em] text-cyan-600/80">
            Medication Reminder
          </p>
          <h2 className="mt-2 text-[1.55rem] font-semibold tracking-[-0.04em] text-slate-900">
            Stay on time with your meds
          </h2>
        </div>
        <button className="flex h-11 w-11 items-center justify-center rounded-full bg-white/80 text-slate-700 shadow-[0_10px_28px_rgba(143,162,184,0.18)]">
          <Plus className="h-5 w-5" />
        </button>
      </div>

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

        <div className="relative z-10 space-y-4">
          <GlassCard className="overflow-hidden rounded-[28px] border-white/80 bg-white/75 p-5 shadow-[0_14px_34px_rgba(198,208,230,0.22)]">
            <div className="relative">
              <div className="absolute inset-x-8 top-8 h-28 rounded-full bg-[radial-gradient(circle,rgba(135,220,241,0.23),transparent_70%)] blur-2xl" />
              <div className="mx-auto mb-5 flex h-44 max-w-[220px] items-center justify-center">
                <div className="relative h-full w-full">
                  <div className="absolute left-8 top-10 h-12 w-12 rounded-full bg-[radial-gradient(circle_at_30%_30%,#ff9c67,#f35b1a)] shadow-[0_16px_32px_rgba(245,119,63,0.34)]" />
                  <div className="absolute left-20 top-0 h-16 w-16 rounded-full bg-[radial-gradient(circle_at_30%_30%,#d6b7ff,#8c46ea)] shadow-[0_16px_34px_rgba(135,80,226,0.3)]" />
                  <div className="absolute left-3 top-20 h-[72px] w-[112px] rounded-[999px] bg-[linear-gradient(145deg,#f9da7b,#ebbd3a)] shadow-[0_18px_34px_rgba(228,178,38,0.3)] before:absolute before:left-[18px] before:top-[34px] before:h-[3px] before:w-[70px] before:rounded-full before:bg-amber-200/70" />
                  <div className="absolute right-3 top-6 h-[120px] w-[64px] rotate-[32deg] rounded-[999px] bg-[linear-gradient(180deg,#ff7f56_0%,#ff7f56_44%,#fff5ef_44%,#ffffff_100%)] shadow-[0_20px_38px_rgba(232,142,114,0.28)]" />
                  <div className="absolute left-[112px] top-[84px] h-10 w-10 rounded-full bg-[radial-gradient(circle_at_30%_30%,#7ef0b7,#39c88d)] shadow-[0_12px_24px_rgba(69,194,138,0.3)]" />
                  <div className="absolute left-[156px] top-[142px] h-9 w-9 rounded-full bg-[radial-gradient(circle_at_30%_30%,#ffd870,#d6a316)] shadow-[0_10px_20px_rgba(217,172,48,0.28)]" />
                  <div className="absolute left-[78px] top-[126px] h-[58px] w-[34px] rotate-[24deg] rounded-[999px] bg-[linear-gradient(180deg,#ffffff_0%,#f6f6f6_62%,#d8dbe3_100%)] opacity-75 shadow-[0_18px_28px_rgba(154,166,185,0.22)]" />
                </div>
              </div>

              <div className="text-center">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-700">
                  <Sparkles className="h-3.5 w-3.5" />
                  Inspired medicine flow
                </div>
                <h3 className="mx-auto max-w-[11ch] text-[2rem] font-semibold leading-[1.02] tracking-[-0.06em] text-slate-950">
                  Be in control of your meds
                </h3>
                <p className="mx-auto mt-3 max-w-[26ch] text-sm leading-6 text-slate-500">
                  Gentle reminders, clear daily timing, and a visual journal so
                  patients never guess what comes next.
                </p>
                <button className="mt-5 inline-flex w-full items-center justify-center rounded-[18px] bg-cyan-500 px-5 py-4 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(34,193,195,0.28)] transition-transform hover:scale-[1.01]">
                  Create reminder plan
                </button>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="rounded-[28px] border-white/80 bg-white/76 p-5 shadow-[0_14px_34px_rgba(198,208,230,0.22)]">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.26em] text-slate-400">
                  Journal
                </p>
                <h3 className="mt-1 text-[2rem] font-semibold tracking-[-0.05em] text-slate-950">
                  Today
                </h3>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-700 shadow-[0_12px_28px_rgba(152,170,191,0.18)]">
                <BellRing className="h-5 w-5" />
              </div>
            </div>

            <div className="mb-6 grid grid-cols-7 gap-2">
              {weekDays.map((item) => (
                <div
                  key={`${item.label}-${item.day}`}
                  className="text-center"
                >
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

            <div className="space-y-3">
              {reminders.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={`${item.name}-${item.time}`}
                    className={`rounded-[24px] border px-4 py-4 transition-transform hover:scale-[1.01] ${
                      item.featured
                        ? "border-white/90 bg-white shadow-[0_18px_32px_rgba(170,185,207,0.2)]"
                        : "border-transparent bg-white/55"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-[18px] bg-gradient-to-br ${item.accent} text-white shadow-[0_12px_24px_rgba(132,146,177,0.16)]`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-lg font-semibold tracking-[-0.04em] text-slate-900">
                              {item.name}
                            </p>
                            <p className="text-sm text-slate-500">{item.detail}</p>
                          </div>
                          <div className="flex items-center gap-1 text-sm font-medium text-slate-400">
                            <Clock3 className="h-4 w-4" />
                            {item.time}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button className="mt-5 flex w-full items-center justify-between rounded-[20px] bg-slate-950 px-5 py-4 text-sm font-medium text-white shadow-[0_18px_28px_rgba(15,23,42,0.18)]">
              Review adherence details
              <ChevronRight className="h-4 w-4" />
            </button>
          </GlassCard>
        </div>
      </div>
    </motion.section>
  );
}
