"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  Calendar,
  CheckCircle2,
  Circle,
  Pill,
  Stethoscope,
  User as UserIcon,
} from "lucide-react";
import { GlassCard } from "../../components/GlassCard";
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

type Appointment = {
  id: string;
  title: string;
  appointment_at: string;
  provider_name: string | null;
};

type MedCounts = { pending: number; taken: number; total: number };

export function HomeScreen() {
  const { profile, user } = useAuth();
  const displayName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "there";

  const [nextAppt, setNextAppt] = useState<Appointment | null | undefined>(undefined);
  const [medCounts, setMedCounts] = useState<MedCounts | undefined>(undefined);

  useEffect(() => {
    if (!profile?.id) return;

    async function load() {
      const now = new Date().toISOString();

      const [apptRes, medsRes] = await Promise.all([
        supabase
          .from("appointments")
          .select("id, title, appointment_at, provider_name")
          .eq("profile_id", profile!.id)
          .eq("status", "scheduled")
          .gt("appointment_at", now)
          .order("appointment_at", { ascending: true })
          .limit(1)
          .maybeSingle(),

        supabase
          .from("medications")
          .select("status")
          .eq("profile_id", profile!.id),
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
    }

    load();
  }, [profile?.id]);

  const apptFormatted = nextAppt ? formatDateTimeES(nextAppt.appointment_at) : null;
  const medsLoading = medCounts === undefined;
  const apptLoading = nextAppt === undefined;

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
            <h1 className="text-2xl font-light text-gray-800">Hola, {displayName}</h1>
            {profile?.diagnosis ? (
              <p className="text-sm text-purple-600 mt-1 font-medium">{profile.diagnosis}</p>
            ) : (
              <p className="text-sm text-gray-500 mt-1">Bienvenida a tu resumen de salud</p>
            )}
          </div>
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-300 to-pink-300 flex items-center justify-center">
            <UserIcon className="w-6 h-6 text-white" />
          </div>
        </div>
      </motion.div>

      {/* Medications summary */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
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

      {/* Diagnosis card — only if profile has diagnosis */}
      {profile?.diagnosis && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <h3 className="text-sm text-gray-500 mb-3 uppercase tracking-wider">Tu diagnóstico</h3>
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
        transition={{ delay: 0.3 }}
      >
        <h3 className="text-sm text-gray-500 mb-3 uppercase tracking-wider">Próxima cita</h3>

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
                  Visita la pestaña Citas para agendar con un especialista.
                </p>
              </div>
              <Calendar className="w-8 h-8 text-indigo-300 shrink-0" />
            </div>
          </GlassCard>
        )}
      </motion.div>
    </div>
  );
}
