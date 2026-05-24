"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import { X, Calendar, Clock, CheckCircle2, ChevronRight } from "lucide-react";
import { GlassCard } from "../../components/GlassCard";
import { useAuth } from "../../providers/AuthProvider";
import { supabase } from "../../../../lib/supabase";
import specialists, { type Specialist, type TimeSlot } from "../../../data/specialists";

const WEEKDAY = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTH = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function formatSlotDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${WEEKDAY[dt.getDay()]} ${d} ${MONTH[m - 1]}`;
}

function toLocalIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function groupSlotsByDate(slots: TimeSlot[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const map = new Map<string, string[]>();
  for (const s of slots) {
    const slotDate = new Date(`${s.date}T00:00:00`);
    if (slotDate <= today) continue;

    if (!map.has(s.date)) map.set(s.date, []);
    map.get(s.date)!.push(s.time);
  }

  if (map.size > 0 || slots.length === 0) {
    return map;
  }

  // If static mock dates are stale, rebuild them from tomorrow onward.
  const templateByDate = new Map<string, string[]>();
  for (const s of slots) {
    if (!templateByDate.has(s.date)) templateByDate.set(s.date, []);
    templateByDate.get(s.date)!.push(s.time);
  }

  const orderedTemplateDates = Array.from(templateByDate.keys()).sort();
  const fallback = new Map<string, string[]>();

  orderedTemplateDates.forEach((templateDate, index) => {
    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + index + 1);
    fallback.set(toLocalIsoDate(nextDate), templateByDate.get(templateDate) ?? []);
  });

  return fallback;
}

function hasSlots(slotGroups: Map<string, string[]>) {
  for (const times of slotGroups.values()) {
    if (times.length > 0) return true;
  }
  return false;
}

type BookingState = "idle" | "loading" | "success" | "error";

export function AppointmentsScreen() {
  const { profile } = useAuth();
  const [selected, setSelected] = useState<Specialist | null>(null);
  const [pickedSlot, setPickedSlot] = useState<TimeSlot | null>(null);
  const [bookingState, setBookingState] = useState<BookingState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function openModal(spec: Specialist) {
    setSelected(spec);
    setPickedSlot(null);
    setBookingState("idle");
    setErrorMsg("");
  }

  function closeModal() {
    setSelected(null);
    setPickedSlot(null);
    setBookingState("idle");
    setErrorMsg("");
  }

  async function confirmBooking() {
    if (!profile || !selected || !pickedSlot) return;
    setBookingState("loading");
    setErrorMsg("");

    const appointmentAt = `${pickedSlot.date}T${pickedSlot.time}:00`;

    const { error: apptError } = await supabase.from("appointments").insert({
      profile_id: profile.id,
      title: `Consulta con ${selected.name}`,
      appointment_at: appointmentAt,
      provider_name: selected.name,
      status: "scheduled",
    });

    if (apptError) {
      setErrorMsg("No se pudo agendar la cita. Intenta de nuevo.");
      setBookingState("error");
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const medsPayload = selected.medications.map((med) => ({
      profile_id: profile.id,
      name: med.name,
      dosage: med.dosage,
      frequency: med.frequency,
      schedule_time: med.schedule_time,
      start_date: today,
      status: "pending" as const,
    }));

    const { error: medsError } = await supabase.from("medications").insert(medsPayload);

    if (medsError) {
      setErrorMsg("Cita agendada pero no se pudieron agregar los medicamentos.");
      setBookingState("error");
      return;
    }

    setBookingState("success");
  }

  const slotGroups = selected ? groupSlotsByDate(selected.availableSlots) : new Map<string, string[]>();

  return (
    <div className="p-6 pt-8 pb-28">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-light text-gray-800">Especialistas</h1>
        <p className="text-sm text-gray-500 mt-1">Agenda tu próxima consulta</p>
      </motion.div>

      {/* Specialist cards */}
      <div className="space-y-4">
        {specialists.map((spec, i) => (
          <motion.div
            key={spec.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * i }}
          >
            <GlassCard>
              <div className="flex gap-4 items-start">
                <div className="relative w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-purple-200 to-pink-200">
                  <Image
                    src={spec.photo}
                    alt={spec.name}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-purple-600 uppercase tracking-wider mb-0.5">
                    {spec.specialty}
                  </p>
                  <h3 className="text-sm font-semibold text-gray-800 leading-tight">{spec.name}</h3>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{spec.tagline}</p>
                </div>
              </div>
              <button
                onClick={() => openModal(spec)}
                className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium active:scale-95 transition-transform"
              >
                <Calendar className="w-4 h-4" />
                Agendar consulta
                <ChevronRight className="w-4 h-4" />
              </button>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {selected && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
              onClick={bookingState === "success" ? closeModal : undefined}
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[425px] z-50 bg-white/90 backdrop-blur-xl rounded-t-3xl shadow-2xl border-t border-white/60 max-h-[90dvh] overflow-y-auto"
            >
              {bookingState === "success" ? (
                <SuccessView specialist={selected} slot={pickedSlot!} onClose={closeModal} />
              ) : (
                <BookingView
                  specialist={selected}
                  slotGroups={slotGroups}
                  pickedSlot={pickedSlot}
                  onPickSlot={setPickedSlot}
                  onConfirm={confirmBooking}
                  onClose={closeModal}
                  loading={bookingState === "loading"}
                  errorMsg={errorMsg}
                />
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Sub-components ── */

function BookingView({
  specialist,
  slotGroups,
  pickedSlot,
  onPickSlot,
  onConfirm,
  onClose,
  loading,
  errorMsg,
}: {
  specialist: Specialist;
  slotGroups: Map<string, string[]>;
  pickedSlot: TimeSlot | null;
  onPickSlot: (s: TimeSlot) => void;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
  errorMsg: string;
}) {
  return (
    <div className="p-6 pb-10">
      {/* Handle + close */}
      <div className="flex items-center justify-between mb-5">
        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-3" />
        <div />
        <button onClick={onClose} className="p-1.5 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Specialist header */}
      <div className="flex gap-4 items-center mb-6">
        <div className="relative w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-purple-200 to-pink-200">
          <Image src={specialist.photo} alt={specialist.name} fill className="object-cover" sizes="80px" />
        </div>
        <div>
          <p className="text-xs font-medium text-purple-600 uppercase tracking-wider">{specialist.specialty}</p>
          <h2 className="text-base font-semibold text-gray-800 mt-0.5">{specialist.name}</h2>
        </div>
      </div>

      {/* Approach */}
      <div className="mb-5">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Enfoque</h4>
        <p className="text-sm text-gray-700 leading-relaxed">{specialist.approach}</p>
      </div>

      {/* Interests */}
      <div className="mb-6">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Áreas de interés</h4>
        <div className="flex flex-wrap gap-2">
          {specialist.interests.map((interest) => (
            <span
              key={interest}
              className="text-xs px-3 py-1 rounded-full bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 border border-purple-200/50"
            >
              {interest}
            </span>
          ))}
        </div>
      </div>

      {/* Slots */}
      <div className="mb-6">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          Horarios disponibles
        </h4>
        {hasSlots(slotGroups) ? (
          <div className="space-y-3">
            {Array.from(slotGroups.entries()).map(([date, times]) => (
              <div key={date}>
                <p className="text-xs text-gray-500 mb-2 font-medium">{formatSlotDate(date)}</p>
                <div className="flex flex-wrap gap-2">
                  {times.map((time) => {
                    const isActive = pickedSlot?.date === date && pickedSlot?.time === time;
                    return (
                      <button
                        key={time}
                        onClick={() => onPickSlot({ date, time })}
                        className={`text-xs px-3 py-1.5 rounded-xl border transition-all font-medium ${
                          isActive
                            ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white border-transparent shadow-md scale-105"
                            : "bg-white/60 text-gray-700 border-gray-200 hover:border-purple-300"
                        }`}
                      >
                        {time}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No hay horarios disponibles para fechas futuras.</p>
        )}
      </div>

      {/* Error */}
      {errorMsg && (
        <p className="text-xs text-red-500 mb-3 text-center">{errorMsg}</p>
      )}

      {/* Confirm button */}
      <button
        onClick={onConfirm}
        disabled={!pickedSlot || loading}
        className="w-full py-3 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold disabled:opacity-40 disabled:scale-100 active:scale-95 transition-all shadow-lg shadow-purple-200"
      >
        {loading ? "Agendando..." : pickedSlot ? `Confirmar ${pickedSlot.time}` : "Selecciona un horario"}
      </button>
    </div>
  );
}

function SuccessView({
  specialist,
  slot,
  onClose,
}: {
  specialist: Specialist;
  slot: TimeSlot;
  onClose: () => void;
}) {
  return (
    <div className="p-8 flex flex-col items-center text-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", damping: 14, stiffness: 200, delay: 0.1 }}
        className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center mb-5"
      >
        <CheckCircle2 className="w-10 h-10 text-purple-500" />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">¡Cita agendada!</h2>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          Tu cita fue agendada. Tu médico revisará tu caso y agregará medicamentos a tu plan.
        </p>

        <div className="w-full bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-4 mb-6 text-left border border-purple-100">
          <p className="text-xs text-purple-600 font-semibold uppercase tracking-wider mb-1">{specialist.specialty}</p>
          <p className="text-sm font-semibold text-gray-800">{specialist.name}</p>
          <p className="text-xs text-gray-500 mt-1">
            {formatSlotDate(slot.date)} · {slot.time}
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold active:scale-95 transition-transform shadow-lg shadow-purple-200"
        >
          Listo
        </button>
      </motion.div>
    </div>
  );
}
