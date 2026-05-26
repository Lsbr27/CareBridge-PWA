"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import {
  X, Calendar, Clock, CheckCircle2, ChevronRight,
  Star, MapPin, Globe, ShieldCheck, ChevronDown, ChevronUp,
  History, CalendarDays, Plus, BookOpen, Lightbulb, Video,
  BarChart2, Heart, Sparkles, Loader2, Stethoscope,
} from "lucide-react";
import { GlassCard } from "../../components/GlassCard";
import { useAuth } from "../../providers/AuthProvider";
import { supabase } from "../../../../lib/supabase";

// ── Types ──────────────────────────────────────────────────────────────────────

type Education = { degree: string; institution: string; year: number };

type Doctor = {
  id: string; slug: string; title: string; name: string;
  specialty: string; category: string; tagline: string;
  bio_short: string; bio_long: string;
  education: Education[]; certifications: string[];
  interests: string[]; languages: string[];
  consultation_price: number; consultation_duration_min: number;
  photo_url: string; verified: boolean;
  rating: number; review_count: number; years_experience: number;
  location: string; consultation_types: string[];
  conditions_treated: string[];
  weekly_schedule: Record<string, string[]>;
};

type DoctorPost = {
  id: string; doctor_slug: string;
  post_type: "article" | "tip" | "video" | "infographic";
  title: string; content: string; image_url: string;
  tag: string; read_time_min: number; likes_count: number;
  published_at: string;
};

type DoctorReview = {
  id: string; doctor_slug: string; profile_id: string;
  appointment_id: string | null;
  rating: number; review_text: string | null;
  reviewer_name: string | null; created_at: string;
};

type Appointment = {
  id: string; title: string; appointment_at: string;
  provider_name: string; location: string | null;
  notes: string | null; status: string;
  doctor_slug: string | null; specialty: string | null;
  doctor_notes: string | null;
  lab_orders: unknown[]; prescription: unknown[];
  patient_rating: number | null;
  patient_review: string | null;
};

type TimeSlot = { date: string; time: string };
type MainTab = "historial" | "proximas" | "agendar";
type ProfileTab = "posts" | "sobre" | "agendar";
type BookingState = "idle" | "loading" | "success" | "error";

// ── Helpers ────────────────────────────────────────────────────────────────────

const WEEKDAY_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTH_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function toLocalIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatSlotDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${WEEKDAY_ES[dt.getDay()]} ${d} ${MONTH_ES[m - 1]}`;
}

function formatDatetime(iso: string) {
  const d = new Date(iso);
  return `${WEEKDAY_ES[d.getDay()]} ${d.getDate()} ${MONTH_ES[d.getMonth()]} · ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  if (days < 30) return `hace ${Math.floor(days / 7)} sem.`;
  return `hace ${Math.floor(days / 30)} mes.`;
}

function slotsFromSchedule(schedule: Record<string, string[]>): TimeSlot[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const slots: TimeSlot[] = [];
  for (let i = 1; i <= 21; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dayName = DAY_NAMES[d.getDay()];
    const times = schedule[dayName] ?? [];
    const dateStr = toLocalIsoDate(d);
    for (const t of times) slots.push({ date: dateStr, time: t });
  }
  return slots;
}

function groupSlotsByDate(slots: TimeSlot[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const s of slots) {
    if (!map.has(s.date)) map.set(s.date, []);
    map.get(s.date)!.push(s.time);
  }
  return map;
}

function formatCOP(amount: number) {
  return `$ ${amount.toLocaleString("es-CO")}`;
}

const POST_TYPE_ICON: Record<string, React.ReactNode> = {
  article: <BookOpen className="w-3.5 h-3.5" />,
  tip: <Lightbulb className="w-3.5 h-3.5" />,
  video: <Video className="w-3.5 h-3.5" />,
  infographic: <BarChart2 className="w-3.5 h-3.5" />,
};
const POST_TYPE_LABEL: Record<string, string> = {
  article: "Artículo", tip: "Consejo", video: "Video", infographic: "Infografía",
};
const POST_TYPE_COLOR: Record<string, string> = {
  article: "bg-purple-50 text-purple-700 border-purple-100",
  tip: "bg-amber-50 text-amber-700 border-amber-100",
  video: "bg-blue-50 text-blue-700 border-blue-100",
  infographic: "bg-emerald-50 text-emerald-700 border-emerald-100",
};

// ── Main screen ───────────────────────────────────────────────────────────────

export function AppointmentsScreen() {
  const { profile } = useAuth();
  const searchParams = useSearchParams();
  const specialtyParam = searchParams.get("specialty");
  const tabParam = searchParams.get("tab") as MainTab | null;
  const appliedParam = useRef(false);

  const [mainTab, setMainTab] = useState<MainTab>(
    tabParam === "proximas" || tabParam === "historial" ? tabParam : "agendar"
  );
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [loadingAppts, setLoadingAppts] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Profile sheet state
  const [profileDoc, setProfileDoc] = useState<Doctor | null>(null);
  const [profileTab, setProfileTab] = useState<ProfileTab>("posts");
  const [posts, setPosts] = useState<DoctorPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [doctorReviews, setDoctorReviews] = useState<DoctorReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

  // Booking state
  const [pickedSlot, setPickedSlot] = useState<TimeSlot | null>(null);
  const [bookingState, setBookingState] = useState<BookingState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Rating state
  const [ratingAppt, setRatingAppt] = useState<Appointment | null>(null);

  useEffect(() => {
    supabase.from("doctors").select("*").order("rating", { ascending: false })
      .then(({ data }) => {
        const list = (data as Doctor[]) ?? [];
        setDoctors(list);
        setLoadingDoctors(false);
        if (specialtyParam && !appliedParam.current) {
          appliedParam.current = true;
          setMainTab("agendar");
          // Match by exact specialty or partial (case-insensitive)
          const match = list.find(
            (d) => d.specialty.toLowerCase() === specialtyParam.toLowerCase()
          );
          setActiveCategory(match?.specialty ?? specialtyParam);
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!profile) return;
    supabase.from("appointments").select("*")
      .eq("profile_id", profile.id)
      .order("appointment_at", { ascending: false })
      .then(({ data }) => { setAppointments((data as Appointment[]) ?? []); setLoadingAppts(false); });
  }, [profile]);

  function openProfileBySlug(slug: string) {
    const doc = doctors.find((d) => d.slug === slug);
    if (doc) { openProfile(doc); return; }
    supabase.from("doctors").select("*").eq("slug", slug).single()
      .then(({ data }) => { if (data) openProfile(data as Doctor); });
  }

  async function submitRating(apptId: string, rating: number, review: string) {
    const { error } = await supabase
      .from("appointments")
      .update({ patient_rating: rating, patient_review: review.trim() || null })
      .eq("id", apptId);
    if (!error) {
      setAppointments((prev) =>
        prev.map((a) =>
          a.id === apptId
            ? { ...a, patient_rating: rating, patient_review: review.trim() || null }
            : a
        )
      );
      // Publish review publicly so other users can see it on the doctor profile
      const appt = appointments.find((a) => a.id === apptId);
      if (appt?.doctor_slug && profile) {
        const nameParts = (profile.full_name ?? "").split(" ").filter(Boolean);
        const reviewerName = nameParts.length >= 2
          ? `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.`
          : nameParts[0] ?? "Paciente";
        const { data: saved } = await supabase
          .from("doctor_reviews")
          .upsert({
            doctor_slug: appt.doctor_slug,
            profile_id: profile.id,
            appointment_id: apptId,
            rating,
            review_text: review.trim() || null,
            reviewer_name: reviewerName,
          }, { onConflict: "appointment_id" })
          .select()
          .single();
        if (saved && profileDoc?.slug === appt.doctor_slug) {
          setDoctorReviews((prev) => {
            const idx = prev.findIndex((r) => r.appointment_id === apptId);
            if (idx >= 0) return prev.map((r, i) => i === idx ? (saved as DoctorReview) : r);
            return [saved as DoctorReview, ...prev];
          });
        }
      }
      setRatingAppt(null);
    }
  }

  function openProfile(doc: Doctor) {
    setProfileDoc(doc);
    setProfileTab("posts");
    setPickedSlot(null);
    setBookingState("idle");
    setErrorMsg("");
    setLoadingPosts(true);
    setLoadingReviews(true);
    supabase.from("doctor_posts").select("*")
      .eq("doctor_slug", doc.slug)
      .order("published_at", { ascending: false })
      .then(({ data }) => { setPosts((data as DoctorPost[]) ?? []); setLoadingPosts(false); });
    supabase.from("doctor_reviews").select("*")
      .eq("doctor_slug", doc.slug)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setDoctorReviews((data as DoctorReview[]) ?? []); setLoadingReviews(false); });
  }

  function closeProfile() {
    setProfileDoc(null);
    setPosts([]);
    setDoctorReviews([]);
    setPickedSlot(null);
    setBookingState("idle");
  }

  async function confirmBooking() {
    if (!profile || !profileDoc || !pickedSlot) return;
    setBookingState("loading");
    setErrorMsg("");
    const { error } = await supabase.from("appointments").insert({
      profile_id: profile.id,
      title: `Consulta con ${profileDoc.title} ${profileDoc.name}`,
      appointment_at: `${pickedSlot.date}T${pickedSlot.time}:00`,
      provider_name: `${profileDoc.title} ${profileDoc.name}`,
      status: "scheduled",
      doctor_slug: profileDoc.slug,
      specialty: profileDoc.specialty,
    });
    if (error) { setErrorMsg("No se pudo agendar la cita. Intenta de nuevo."); setBookingState("error"); return; }
    setBookingState("success");
    // Refresh appointments list
    if (profile) {
      supabase.from("appointments").select("*")
        .eq("profile_id", profile.id)
        .order("appointment_at", { ascending: false })
        .then(({ data }) => setAppointments((data as Appointment[]) ?? []));
    }
  }

  const now = new Date().toISOString();
  const past = appointments.filter((a) => a.appointment_at < now || a.status === "completed");
  const upcoming = appointments.filter((a) => a.appointment_at >= now && a.status === "scheduled");

  const categories = ["Todos", ...Array.from(new Set(doctors.map((d) => d.specialty)))];
  const visible = activeCategory && activeCategory !== "Todos"
    ? doctors.filter((d) => d.specialty === activeCategory)
    : doctors;

  // Smart recommendation: first doctor whose conditions_treated overlaps common risk conditions
  const recommended = doctors.find((d) =>
    d.conditions_treated.some((c) => ["diabetes", "high_bp", "heart_disease"].includes(c))
  ) ?? doctors[0];

  const slots = profileDoc ? slotsFromSchedule(profileDoc.weekly_schedule) : [];
  const slotGroups = groupSlotsByDate(slots);

  const TABS: { id: MainTab; label: string; icon: React.ReactNode }[] = [
    { id: "historial", label: "Historial", icon: <History className="w-4 h-4" /> },
    { id: "proximas", label: "Próximas", icon: <CalendarDays className="w-4 h-4" /> },
    { id: "agendar", label: "Agendar", icon: <Plus className="w-4 h-4" /> },
  ];

  return (
    <div className="pb-28">
      {/* Header */}
      <div className="px-6 pt-8 pb-4">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-light text-gray-800">Citas</h1>
          <p className="text-sm text-gray-500 mt-1">Gestiona tus consultas</p>
        </motion.div>
      </div>

      {/* Main tabs */}
      <div className="flex gap-1 mx-6 mb-5 p-1 bg-white/50 backdrop-blur-sm rounded-2xl border border-white/60">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setMainTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all ${
              mainTab === tab.id
                ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-sm"
                : "text-gray-500"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {mainTab === "historial" && (
          <HistorialTab
            key="historial"
            appointments={past}
            loading={loadingAppts}
            onRate={setRatingAppt}
            onOpenDoctor={openProfileBySlug}
          />
        )}
        {mainTab === "proximas" && (
          <ProximasTab
            key="proximas"
            appointments={upcoming}
            loading={loadingAppts}
            onBook={() => setMainTab("agendar")}
            onOpenDoctor={openProfileBySlug}
          />
        )}
        {mainTab === "agendar" && (
          <AgendarTab
            key="agendar"
            doctors={visible}
            loading={loadingDoctors}
            categories={categories}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            recommended={recommended}
            onOpenProfile={openProfile}
          />
        )}
      </AnimatePresence>

      {/* Rating sheet */}
      <AnimatePresence>
        {ratingAppt && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
              onClick={() => setRatingAppt(null)}
            />
            <RatingSheet
              appointment={ratingAppt}
              onClose={() => setRatingAppt(null)}
              onSubmit={submitRating}
            />
          </>
        )}
      </AnimatePresence>

      {/* Doctor profile sheet */}
      <AnimatePresence>
        {profileDoc && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
              onClick={bookingState === "success" ? closeProfile : undefined}
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[425px] z-50 bg-white/95 backdrop-blur-xl rounded-t-3xl shadow-2xl border-t border-white/60 max-h-[95dvh] flex flex-col"
            >
              {bookingState === "success" ? (
                <SuccessView doc={profileDoc} slot={pickedSlot!} onClose={closeProfile} />
              ) : (
                <DoctorProfileSheet
                  doc={profileDoc}
                  tab={profileTab}
                  onTabChange={setProfileTab}
                  posts={posts}
                  loadingPosts={loadingPosts}
                  doctorReviews={doctorReviews}
                  loadingReviews={loadingReviews}
                  slotGroups={slotGroups}
                  pickedSlot={pickedSlot}
                  onPickSlot={setPickedSlot}
                  onConfirm={confirmBooking}
                  onClose={closeProfile}
                  bookingLoading={bookingState === "loading"}
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

// ── Historial tab ─────────────────────────────────────────────────────────────

function HistorialTab({
  appointments, loading, onRate, onOpenDoctor,
}: {
  appointments: Appointment[];
  loading: boolean;
  onRate: (appt: Appointment) => void;
  onOpenDoctor: (slug: string) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="px-6 space-y-3"
    >
      {loading ? (
        <SkeletonList />
      ) : appointments.length === 0 ? (
        <EmptyState icon={<History className="w-8 h-8 text-gray-300" />} text="Aún no tienes consultas pasadas" />
      ) : (
        appointments.map((a) => (
          <GlassCard key={a.id}>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5 text-purple-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{a.provider_name}</p>
                {a.specialty && <p className="text-xs text-purple-600 font-medium">{a.specialty}</p>}
                <p className="text-xs text-gray-400 mt-0.5">{formatDatetime(a.appointment_at)}</p>
              </div>
              <button
                onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                className="p-1 text-gray-400"
              >
                {expanded === a.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            <AnimatePresence>
              {expanded === a.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }} className="overflow-hidden"
                >
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                    {a.doctor_notes ? (
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Observaciones</p>
                        <p className="text-xs text-gray-700 leading-relaxed">{a.doctor_notes}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic">El médico no dejó observaciones para esta consulta.</p>
                    )}
                    {(a.lab_orders as unknown[]).length > 0 && (
                      <button className="flex items-center gap-1.5 text-xs text-purple-600 font-medium mt-1">
                        <Calendar className="w-3.5 h-3.5" /> Descargar órdenes de laboratorio
                      </button>
                    )}
                    {(a.prescription as unknown[]).length > 0 && (
                      <button className="flex items-center gap-1.5 text-xs text-purple-600 font-medium">
                        <BookOpen className="w-3.5 h-3.5" /> Descargar prescripción
                      </button>
                    )}

                    {/* Doctor profile + rating actions */}
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      {a.doctor_slug && (
                        <button
                          onClick={() => onOpenDoctor(a.doctor_slug!)}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 border border-purple-100 font-medium"
                        >
                          <Stethoscope className="w-3.5 h-3.5" /> Ver médico
                        </button>
                      )}
                      {a.patient_rating ? (
                        <div className="flex items-center gap-1 ml-auto">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <Star
                              key={n}
                              className={`w-3.5 h-3.5 ${n <= a.patient_rating! ? "fill-amber-400 stroke-amber-400" : "stroke-gray-200 fill-transparent"}`}
                            />
                          ))}
                          {a.patient_review && (
                            <span className="text-xs text-gray-400 ml-1 max-w-[120px] truncate">{a.patient_review}</span>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => onRate(a)}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-100 font-medium ml-auto"
                        >
                          <Star className="w-3.5 h-3.5" /> Calificar
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </GlassCard>
        ))
      )}
    </motion.div>
  );
}

// ── Próximas tab ──────────────────────────────────────────────────────────────

function ProximasTab({
  appointments, loading, onBook, onOpenDoctor,
}: {
  appointments: Appointment[];
  loading: boolean;
  onBook: () => void;
  onOpenDoctor: (slug: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="px-6 space-y-3"
    >
      {loading ? (
        <SkeletonList />
      ) : appointments.length === 0 ? (
        <div className="flex flex-col items-center pt-8 gap-4">
          <EmptyState icon={<CalendarDays className="w-8 h-8 text-gray-300" />} text="No tienes citas próximas agendadas" />
          <button
            onClick={onBook}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium shadow-lg shadow-purple-200"
          >
            <Plus className="w-4 h-4" /> Agendar una consulta
          </button>
        </div>
      ) : (
        appointments.map((a) => (
          <GlassCard key={a.id}>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-5 h-5 text-purple-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{a.provider_name}</p>
                {a.specialty && <p className="text-xs text-purple-600 font-medium">{a.specialty}</p>}
                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {formatDatetime(a.appointment_at)}
                </p>
              </div>
              <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 font-medium">
                Agendada
              </span>
            </div>
            {a.doctor_slug && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <button
                  onClick={() => onOpenDoctor(a.doctor_slug!)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 border border-purple-100 font-medium"
                >
                  <Stethoscope className="w-3.5 h-3.5" /> Ver perfil del médico
                </button>
              </div>
            )}
          </GlassCard>
        ))
      )}
    </motion.div>
  );
}

// ── Agendar tab ───────────────────────────────────────────────────────────────

function AgendarTab({
  doctors, loading, categories, activeCategory, onCategoryChange, recommended, onOpenProfile,
}: {
  doctors: Doctor[]; loading: boolean;
  categories: string[]; activeCategory: string | null;
  onCategoryChange: (c: string | null) => void;
  recommended: Doctor | undefined;
  onOpenProfile: (d: Doctor) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
    >
      {/* Smart recommendation banner */}
      {!loading && recommended && (
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="mx-6 mb-5 p-4 rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100"
        >
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-purple-500" />
            <p className="text-xs font-semibold text-purple-700 uppercase tracking-wider">Sugerido para ti</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-purple-200 to-pink-200">
              <Image src={recommended.photo_url} alt={recommended.name} fill className="object-cover" sizes="48px" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{recommended.title} {recommended.name}</p>
              <p className="text-xs text-gray-500">{recommended.specialty} · {recommended.years_experience} años exp.</p>
            </div>
            <button
              onClick={() => onOpenProfile(recommended)}
              className="flex-shrink-0 flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl bg-white border border-purple-200 text-purple-700 font-medium"
            >
              Ver <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </motion.div>
      )}

      {/* Category filter — full width so overflow-x-auto can scroll */}
      {!loading && (
        <div className="flex gap-2 overflow-x-scroll pb-3 mb-4 scrollbar-hide px-6 w-full">
          {categories.map((cat) => {
            const isActive = cat === "Todos" ? !activeCategory || activeCategory === "Todos" : activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => onCategoryChange(cat === "Todos" ? null : cat)}
                className={`flex-shrink-0 text-xs px-3.5 py-1.5 rounded-full border font-medium transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white border-transparent shadow-sm"
                    : "bg-white/60 text-gray-600 border-gray-200"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      )}

      {/* Doctor list */}
      {loading ? (
        <div className="px-6"><SkeletonList /></div>
      ) : (
        <div className="px-6 space-y-4">
          {doctors.map((doc, i) => (
            <motion.div key={doc.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 * i }}>
              <DoctorCard doc={doc} onOpen={() => onOpenProfile(doc)} />
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ── Doctor card ───────────────────────────────────────────────────────────────

function DoctorCard({ doc, onOpen }: { doc: Doctor; onOpen: () => void }) {
  return (
    <GlassCard>
      <button className="w-full text-left" onClick={onOpen}>
        <div className="flex gap-4 items-start">
          <div className="relative w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-purple-200 to-pink-200">
            <Image src={doc.photo_url} alt={doc.name} fill className="object-cover" sizes="64px" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <p className="text-xs font-medium text-purple-600 uppercase tracking-wider">{doc.specialty}</p>
              {doc.verified && <ShieldCheck className="w-3 h-3 text-purple-400 flex-shrink-0" />}
            </div>
            <h3 className="text-sm font-semibold text-gray-800 leading-tight">{doc.title} {doc.name}</h3>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed line-clamp-2">{doc.tagline}</p>
            <div className="flex items-center gap-3 mt-2">
              <span className="flex items-center gap-0.5 text-xs text-amber-500 font-medium">
                <Star className="w-3 h-3 fill-amber-400 stroke-amber-400" />
                {doc.rating.toFixed(1)}
                <span className="text-gray-400 font-normal">({doc.review_count})</span>
              </span>
              <span className="text-xs text-gray-400">·</span>
              <span className="text-xs text-gray-500">{doc.years_experience} años exp.</span>
              <span className="text-xs text-gray-400">·</span>
              <span className="text-xs font-medium text-gray-700">{formatCOP(doc.consultation_price)}</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 mt-1" />
        </div>
      </button>
    </GlassCard>
  );
}

// ── Static placeholder reviews (shown when a doctor has no real reviews yet) ──

const STATIC_REVIEWS: DoctorReview[] = [
  { id: "s1", doctor_slug: "", profile_id: "", appointment_id: null, rating: 5, review_text: "Excelente atención. Me explicó todo con paciencia y claridad. Muy recomendada.", reviewer_name: "María L.", created_at: "2026-03-10T10:00:00Z" },
  { id: "s2", doctor_slug: "", profile_id: "", appointment_id: null, rating: 5, review_text: "Muy profesional y puntual. Me sentí bien atendido desde el primer momento.", reviewer_name: "Carlos R.", created_at: "2026-03-18T14:00:00Z" },
  { id: "s3", doctor_slug: "", profile_id: "", appointment_id: null, rating: 4, review_text: "Buena consulta, resolvió todas mis dudas y el plan de tratamiento es muy claro.", reviewer_name: "Ana M.", created_at: "2026-04-02T09:00:00Z" },
  { id: "s4", doctor_slug: "", profile_id: "", appointment_id: null, rating: 5, review_text: "Increíble experiencia. Es una de las mejores consultas que he tenido.", reviewer_name: "Diego P.", created_at: "2026-04-15T11:00:00Z" },
  { id: "s5", doctor_slug: "", profile_id: "", appointment_id: null, rating: 5, review_text: "Muy buena atención, empática y paciente. Totalmente recomendada.", reviewer_name: "Lucía V.", created_at: "2026-04-28T16:00:00Z" },
];

function getPlaceholderReviews(slug: string): DoctorReview[] {
  const hash = slug.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const idx = hash % (STATIC_REVIEWS.length - 1);
  return [STATIC_REVIEWS[idx], STATIC_REVIEWS[idx + 1]];
}

// ── Doctor profile sheet ──────────────────────────────────────────────────────

function DoctorProfileSheet({
  doc, tab, onTabChange, posts, loadingPosts, doctorReviews, loadingReviews,
  slotGroups, pickedSlot, onPickSlot, onConfirm, onClose, bookingLoading, errorMsg,
}: {
  doc: Doctor; tab: ProfileTab; onTabChange: (t: ProfileTab) => void;
  posts: DoctorPost[]; loadingPosts: boolean;
  doctorReviews: DoctorReview[]; loadingReviews: boolean;
  slotGroups: Map<string, string[]>;
  pickedSlot: TimeSlot | null; onPickSlot: (s: TimeSlot) => void;
  onConfirm: () => void; onClose: () => void;
  bookingLoading: boolean; errorMsg: string;
}) {
  const PROFILE_TABS: { id: ProfileTab; label: string }[] = [
    { id: "posts", label: "Publicaciones" },
    { id: "sobre", label: "Sobre mí" },
    { id: "agendar", label: "Agendar" },
  ];

  return (
    <>
      {/* Sticky header */}
      <div className="flex-shrink-0 px-6 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center justify-center mb-4 relative h-5">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
          <button onClick={onClose} className="absolute right-0 p-1.5 rounded-full bg-gray-100 text-gray-500">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-3 items-center mb-4">
          <div className="relative w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-purple-200 to-pink-200">
            <Image src={doc.photo_url} alt={doc.name} fill className="object-cover" sizes="56px" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-0.5">
              <p className="text-xs font-medium text-purple-600 uppercase tracking-wider truncate">{doc.specialty}</p>
              {doc.verified && <ShieldCheck className="w-3 h-3 text-purple-400 flex-shrink-0" />}
            </div>
            <h2 className="text-base font-semibold text-gray-800 leading-tight">{doc.title} {doc.name}</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Star className="w-3 h-3 fill-amber-400 stroke-amber-400" />
              <span className="text-xs font-semibold text-amber-500">{doc.rating.toFixed(1)}</span>
              <span className="text-xs text-gray-400">({doc.review_count} reseñas) · {doc.years_experience} años</span>
            </div>
          </div>
        </div>
        {/* Tab switcher */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
          {PROFILE_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                tab === t.id ? "bg-white text-gray-800 shadow-sm" : "text-gray-500"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {tab === "posts" && (
            <PostsTab key="posts" posts={posts} loading={loadingPosts} />
          )}
          {tab === "sobre" && (
            <SobreTab key="sobre" doc={doc} reviews={doctorReviews} loadingReviews={loadingReviews} />
          )}
          {tab === "agendar" && (
            <BookingTab
              key="agendar"
              doc={doc}
              slotGroups={slotGroups}
              pickedSlot={pickedSlot}
              onPickSlot={onPickSlot}
              onConfirm={onConfirm}
              loading={bookingLoading}
              errorMsg={errorMsg}
            />
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

// ── Posts tab ─────────────────────────────────────────────────────────────────

function PostsTab({ posts, loading }: { posts: DoctorPost[]; loading: boolean }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (loading) return <div className="p-6 space-y-3"><SkeletonList /></div>;

  if (posts.length === 0) {
    return <EmptyState icon={<BookOpen className="w-8 h-8 text-gray-300" />} text="Este médico aún no tiene publicaciones" />;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 space-y-3">
      {posts.map((post) => (
        <div key={post.id} className="bg-white/60 rounded-2xl border border-white/80 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${POST_TYPE_COLOR[post.post_type]}`}>
              {POST_TYPE_ICON[post.post_type]} {POST_TYPE_LABEL[post.post_type]}
            </span>
            <span className="text-xs text-gray-400">{formatRelative(post.published_at)}</span>
          </div>

          <h4 className="text-sm font-semibold text-gray-800 leading-snug mb-1.5">{post.title}</h4>

          {post.tag && (
            <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 mb-2">{post.tag}</span>
          )}

          <AnimatePresence>
            {expanded === post.id ? (
              <motion.p
                initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="text-sm text-gray-600 leading-relaxed overflow-hidden"
              >
                {post.content}
              </motion.p>
            ) : (
              <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">{post.content}</p>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-1 text-xs text-gray-400">
                <Heart className="w-3.5 h-3.5" /> {post.likes_count}
              </button>
              <span className="text-xs text-gray-400">{post.read_time_min} min lectura</span>
            </div>
            <button
              onClick={() => setExpanded(expanded === post.id ? null : post.id)}
              className="text-xs text-purple-600 font-medium"
            >
              {expanded === post.id ? "Ver menos" : "Leer más"}
            </button>
          </div>
        </div>
      ))}
    </motion.div>
  );
}

// ── Sobre mí tab ──────────────────────────────────────────────────────────────

function SobreTab({ doc, reviews, loadingReviews }: { doc: Doctor; reviews: DoctorReview[]; loadingReviews: boolean }) {
  const [showEducation, setShowEducation] = useState(false);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-6 space-y-5">
      {/* Meta */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <span className="flex items-center gap-1 text-xs text-gray-500"><MapPin className="w-3 h-3" /> {doc.location}</span>
        <span className="flex items-center gap-1 text-xs text-gray-500"><Globe className="w-3 h-3" /> {doc.languages.join(", ")}</span>
        <span className="flex items-center gap-1 text-xs text-gray-500"><Clock className="w-3 h-3" /> {doc.consultation_duration_min} min · {formatCOP(doc.consultation_price)}</span>
      </div>

      {/* Bio */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Enfoque</p>
        <p className="text-sm text-gray-700 leading-relaxed">{doc.bio_short}</p>
        {doc.bio_long && <p className="text-sm text-gray-600 leading-relaxed mt-2">{doc.bio_long}</p>}
      </div>

      {/* Interests */}
      {doc.interests.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Áreas de interés</p>
          <div className="flex flex-wrap gap-1.5">
            {doc.interests.map((t) => (
              <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-100">{t}</span>
            ))}
          </div>
        </div>
      )}

      {/* Education */}
      {doc.education.length > 0 && (
        <div>
          <button
            onClick={() => setShowEducation((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 w-full text-left"
          >
            Formación académica
            {showEducation ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
          </button>
          <AnimatePresence>
            {showEducation && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }} className="overflow-hidden"
              >
                <div className="space-y-2">
                  {doc.education.map((e, i) => (
                    <div key={i} className="flex gap-3 items-start">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-gray-800">{e.degree}</p>
                        <p className="text-xs text-gray-500">{e.institution} · {e.year}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {doc.certifications.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {doc.certifications.map((c) => (
                      <span key={c} className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">{c}</span>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Patient reviews */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Lo que dicen los pacientes</p>
        {loadingReviews ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <div key={i} className="h-20 rounded-2xl bg-white/40 animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-3">
            {(reviews.length > 0 ? reviews.slice(0, 5) : getPlaceholderReviews(doc.slug)).map((r) => (
              <div key={r.id} className="bg-white/60 rounded-2xl border border-white/80 shadow-sm p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-xs font-semibold text-gray-700">{r.reviewer_name ?? "Paciente"}</p>
                    <div className="flex items-center gap-0.5 mt-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} className={`w-3 h-3 ${n <= r.rating ? "fill-amber-400 stroke-amber-400" : "stroke-gray-200 fill-transparent"}`} />
                      ))}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">{formatRelative(r.created_at)}</span>
                </div>
                {r.review_text && (
                  <p className="text-xs text-gray-600 leading-relaxed">{r.review_text}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Booking tab ───────────────────────────────────────────────────────────────

function BookingTab({
  doc, slotGroups, pickedSlot, onPickSlot, onConfirm, loading, errorMsg,
}: {
  doc: Doctor; slotGroups: Map<string, string[]>;
  pickedSlot: TimeSlot | null; onPickSlot: (s: TimeSlot) => void;
  onConfirm: () => void; loading: boolean; errorMsg: string;
}) {
  const hasSlots = Array.from(slotGroups.values()).some((t) => t.length > 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-6">
      <div className="mb-4 p-3 rounded-xl bg-purple-50 border border-purple-100">
        <p className="text-xs text-purple-700 font-medium">{doc.consultation_duration_min} min · {formatCOP(doc.consultation_price)} · {doc.consultation_types.join(", ")}</p>
      </div>

      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5" /> Horarios disponibles
      </h4>

      {hasSlots ? (
        <div className="space-y-3 mb-6">
          {Array.from(slotGroups.entries()).slice(0, 5).map(([date, times]) => (
            <div key={date}>
              <p className="text-xs text-gray-500 mb-1.5 font-medium">{formatSlotDate(date)}</p>
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
                          : "bg-white/60 text-gray-700 border-gray-200"
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
        <p className="text-sm text-gray-500 mb-6">No hay horarios disponibles en las próximas semanas.</p>
      )}

      {errorMsg && <p className="text-xs text-red-500 mb-3 text-center">{errorMsg}</p>}

      <button
        onClick={onConfirm}
        disabled={!pickedSlot || loading}
        className="w-full py-3 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold disabled:opacity-40 active:scale-95 transition-all shadow-lg shadow-purple-200"
      >
        {loading ? "Agendando..." : pickedSlot ? `Confirmar · ${pickedSlot.time}` : "Selecciona un horario"}
      </button>
    </motion.div>
  );
}

// ── Success view ──────────────────────────────────────────────────────────────

function SuccessView({ doc, slot, onClose }: { doc: Doctor; slot: TimeSlot; onClose: () => void }) {
  return (
    <div className="p-8 flex flex-col items-center text-center">
      <motion.div
        initial={{ scale: 0 }} animate={{ scale: 1 }}
        transition={{ type: "spring", damping: 14, stiffness: 200, delay: 0.1 }}
        className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center mb-5"
      >
        <CheckCircle2 className="w-10 h-10 text-purple-500" />
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">¡Cita agendada!</h2>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">Tu cita fue confirmada. La encontrarás en tus citas próximas.</p>
        <div className="w-full bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-4 mb-6 text-left border border-purple-100">
          <p className="text-xs text-purple-600 font-semibold uppercase tracking-wider mb-1">{doc.specialty}</p>
          <p className="text-sm font-semibold text-gray-800">{doc.title} {doc.name}</p>
          <p className="text-xs text-gray-500 mt-1">{formatSlotDate(slot.date)} · {slot.time}</p>
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

// ── Rating sheet ──────────────────────────────────────────────────────────────

function RatingSheet({
  appointment, onClose, onSubmit,
}: {
  appointment: Appointment;
  onClose: () => void;
  onSubmit: (apptId: string, rating: number, review: string) => Promise<void>;
}) {
  const [rating, setRating] = useState(appointment.patient_rating ?? 0);
  const [review, setReview] = useState(appointment.patient_review ?? "");
  const [hovered, setHovered] = useState(0);
  const [loading, setLoading] = useState(false);

  const LABELS = ["", "Muy mala", "Mala", "Regular", "Buena", "Excelente"];

  async function handleSubmit() {
    if (!rating) return;
    setLoading(true);
    await onSubmit(appointment.id, rating, review);
    setLoading(false);
  }

  const isEdit = !!appointment.patient_rating;

  return (
    <motion.div
      initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 300 }}
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[425px] z-50 bg-white/95 backdrop-blur-xl rounded-t-3xl shadow-2xl border-t border-white/60"
    >
      <div className="p-6">
        {/* Handle */}
        <div className="flex justify-center mb-5">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-[10px] font-semibold text-purple-600 uppercase tracking-widest mb-0.5">
              {appointment.specialty ?? "Consulta médica"}
            </p>
            <h2 className="text-base font-semibold text-gray-800">{appointment.provider_name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{formatDatetime(appointment.appointment_at)}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm font-semibold text-gray-700 mb-4 text-center">
          {isEdit ? "Editar tu calificación" : "¿Cómo fue tu consulta?"}
        </p>

        {/* Star selector */}
        <div className="flex justify-center gap-3 mb-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setRating(n)}
              onMouseEnter={() => setHovered(n)}
              onMouseLeave={() => setHovered(0)}
              className="transition-transform active:scale-90"
            >
              <Star
                className={`w-10 h-10 transition-all ${
                  n <= (hovered || rating)
                    ? "fill-amber-400 stroke-amber-400 scale-110"
                    : "stroke-gray-200 fill-transparent"
                }`}
              />
            </button>
          ))}
        </div>

        <p className="text-center text-xs font-medium text-amber-600 mb-5 h-4">
          {LABELS[hovered || rating]}
        </p>

        {/* Review textarea */}
        <textarea
          value={review}
          onChange={(e) => setReview(e.target.value)}
          placeholder="Comparte tu experiencia (opcional)…"
          rows={3}
          className="w-full text-sm text-gray-700 placeholder-gray-400 border border-gray-200 rounded-2xl px-4 py-3 resize-none outline-none focus:border-purple-300 transition-colors bg-gray-50/60"
        />

        <button
          onClick={handleSubmit}
          disabled={!rating || loading}
          className="w-full mt-4 py-3 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold disabled:opacity-40 active:scale-[0.98] transition-all shadow-lg shadow-purple-100 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? "Enviando…" : isEdit ? "Actualizar calificación" : "Enviar calificación"}
        </button>
      </div>
    </motion.div>
  );
}

// ── Shared micro-components ───────────────────────────────────────────────────

function SkeletonList() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => <div key={i} className="h-28 rounded-2xl bg-white/40 animate-pulse" />)}
    </div>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center py-12 gap-3">
      {icon}
      <p className="text-sm text-gray-400 text-center">{text}</p>
    </div>
  );
}
