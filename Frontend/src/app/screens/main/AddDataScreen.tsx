"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, Activity, Clock, Heart, Pill, Plus, Check, CheckCircle2, Brain, BookOpen } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { GlassCard } from "../../components/GlassCard";
import { PillButton } from "../../components/PillButton";
import { useAuth } from "../../providers/AuthProvider";
import { supabase } from "../../../../lib/supabase";

const categories = [
  { id: "symptoms", label: "Symptoms", icon: <Activity className="w-4 h-4" /> },
  { id: "history", label: "History", icon: <Clock className="w-4 h-4" /> },
  { id: "lifestyle", label: "Lifestyle", icon: <Heart className="w-4 h-4" /> },
  { id: "medications", label: "Medications", icon: <Pill className="w-4 h-4" /> },
];

const suggestions = {
  symptoms: ["Headache", "Fatigue", "Dizziness", "Nausea", "Fever", "Cough"],
  history: ["High blood pressure", "Diabetes", "Asthma", "Allergies", "Surgery"],
  lifestyle: ["Exercise routine", "Sleep pattern", "Diet", "Stress level", "Smoking"],
  medications: ["Aspirin", "Ibuprofen", "Vitamins", "Prescription meds"],
};

const MOOD_LABELS = ["", "Muy mal", "Mal", "Regular", "Bien", "Excelente"];
const ENERGY_LABELS = ["", "Sin energía", "Poca", "Normal", "Buena", "Mucha"];
const WEEKDAY_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTH_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

type SaveState = "idle" | "loading" | "success" | "error";

type DailyLog = {
  id: string;
  profile_id: string;
  logged_at: string;
  symptoms: string[] | null;
  mood: number | null;
  energy: number | null;
  pain: number | null;
  sleep_hours: number | null;
  notes: string | null;
};

function RatingSelector({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number | null;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-2">{label}</p>
      <div className="flex gap-2 flex-wrap">
        {Array.from({ length: max + 1 }, (_, i) => (
          <button
            key={i}
            onClick={() => onChange(i)}
            className={`w-9 h-9 rounded-full text-sm font-semibold transition-all active:scale-95 ${
              value === i
                ? "bg-gradient-to-br from-purple-400 to-pink-400 text-white shadow-md"
                : "bg-white/60 text-gray-600 border border-white/80"
            }`}
          >
            {i}
          </button>
        ))}
      </div>
    </div>
  );
}

const INITIAL_STATE = {
  activeCategory: "symptoms" as keyof typeof suggestions,
  searchQuery: "",
  selectedItems: [] as string[],
  customInput: "",
  mood: null as number | null,
  energy: null as number | null,
  pain: null as number | null,
  sleepHours: "",
  notes: "",
};

function moodDot(mood: number | null): string {
  if (mood == null) return "bg-gray-300";
  if (mood >= 4) return "bg-green-400";
  if (mood === 3) return "bg-yellow-400";
  return "bg-red-400";
}

function formatLogDate(iso: string): string {
  const d = new Date(iso);
  return `${WEEKDAY_ES[d.getDay()]} ${d.getDate()} ${MONTH_ES[d.getMonth()]}`;
}

function formatLogTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

export function AddDataScreen() {
  const { profile } = useAuth();

  const [activeTab, setActiveTab] = useState<"registrar" | "historial">("registrar");

  const [activeCategory, setActiveCategory] = useState(INITIAL_STATE.activeCategory);
  const [searchQuery, setSearchQuery] = useState(INITIAL_STATE.searchQuery);
  const [selectedItems, setSelectedItems] = useState(INITIAL_STATE.selectedItems);
  const [customInput, setCustomInput] = useState(INITIAL_STATE.customInput);
  const [mood, setMood] = useState<number | null>(INITIAL_STATE.mood);
  const [energy, setEnergy] = useState<number | null>(INITIAL_STATE.energy);
  const [pain, setPain] = useState<number | null>(INITIAL_STATE.pain);
  const [sleepHours, setSleepHours] = useState(INITIAL_STATE.sleepHours);
  const [notes, setNotes] = useState(INITIAL_STATE.notes);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === "historial" && profile?.id) {
      setLogsLoading(true);
      supabase
        .from("daily_logs")
        .select("*")
        .eq("profile_id", profile.id)
        .order("logged_at", { ascending: false })
        .limit(60)
        .then(({ data }) => {
          setLogs(data ?? []);
          setLogsLoading(false);
        });
    }
  }, [activeTab, profile?.id]);

  const toggleItem = (item: string) => {
    setSelectedItems((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  const addCustomItem = () => {
    const trimmed = customInput.trim();
    if (trimmed && !selectedItems.includes(trimmed)) {
      setSelectedItems((prev) => [...prev, trimmed]);
    }
    setCustomInput("");
  };

  const hasData =
    selectedItems.length > 0 ||
    mood !== null ||
    energy !== null ||
    pain !== null ||
    sleepHours !== "" ||
    notes.trim() !== "";

  async function handleSave() {
    if (!profile?.id || !hasData) return;
    setSaveState("loading");

    const { error } = await supabase.from("daily_logs").insert({
      profile_id: profile.id,
      logged_at: new Date().toISOString(),
      symptoms: selectedItems,
      mood: mood ?? undefined,
      energy: energy ?? undefined,
      pain: pain ?? undefined,
      sleep_hours: sleepHours !== "" ? parseFloat(sleepHours) : undefined,
      notes: notes.trim() || undefined,
    });

    if (error) {
      setSaveState("error");
      return;
    }

    setSaveState("success");
    setActiveCategory(INITIAL_STATE.activeCategory);
    setSearchQuery(INITIAL_STATE.searchQuery);
    setSelectedItems(INITIAL_STATE.selectedItems);
    setCustomInput(INITIAL_STATE.customInput);
    setMood(INITIAL_STATE.mood);
    setEnergy(INITIAL_STATE.energy);
    setPain(INITIAL_STATE.pain);
    setSleepHours(INITIAL_STATE.sleepHours);
    setNotes(INITIAL_STATE.notes);
  }

  const filtered = suggestions[activeCategory].filter((s) =>
    s.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const chartLogs = [...logs]
    .sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime())
    .slice(-14);

  const chartData = chartLogs.map((log) => {
    const d = new Date(log.logged_at);
    return {
      label: `${WEEKDAY_ES[d.getDay()]} ${d.getDate()}`,
      mood: log.mood ?? undefined,
      sleep: log.sleep_hours != null ? log.sleep_hours : undefined,
      painInv: log.pain != null ? 10 - log.pain : undefined,
    };
  });

  const correlations: string[] = [];
  if (logs.length >= 5) {
    const sleepLow = logs.filter((l) => l.sleep_hours != null && l.sleep_hours < 6);
    if (sleepLow.length > 0) {
      const moodLowCount = sleepLow.filter((l) => l.mood != null && l.mood <= 2).length;
      if (moodLowCount / sleepLow.length > 0.6) {
        correlations.push("Patrón detectado: cuando duermes poco, tu ánimo baja");
      }
    }
    const painHigh = logs.filter((l) => l.pain != null && l.pain >= 7);
    if (painHigh.length > 0) {
      const energyLowCount = painHigh.filter((l) => l.energy != null && l.energy <= 2).length;
      if (energyLowCount / painHigh.length > 0.6) {
        correlations.push("Cuando el dolor es alto, tu energía se ve afectada");
      }
    }
  }

  const displayLogs = logs.slice(0, 20);

  return (
    <div className="pb-28">
      <div className="p-6 pt-8 pb-0">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-2xl font-light text-gray-800 mb-2">Registrar datos</h1>
          <p className="text-sm text-gray-500">Construye tu mosaico de salud paso a paso</p>
        </motion.div>
      </div>

      <div className="flex gap-1 mx-6 mb-5 p-1 bg-white/50 backdrop-blur-sm rounded-2xl border border-white/60">
        {(["registrar", "historial"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${
              activeTab === tab
                ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-sm"
                : "text-gray-500"
            }`}
          >
            {tab === "registrar" ? "Registrar" : "Historial"}
          </button>
        ))}
      </div>

      {activeTab === "registrar" && (
        <div className="px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="mb-6"
          >
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Describe tus síntomas o condición..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 rounded-[20px] bg-white/50 backdrop-blur-sm border border-white/80 text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-300/50 transition-all"
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-6"
          >
            <p className="text-xs text-gray-500 mb-3 uppercase tracking-wider">Categoría</p>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {categories.map((cat) => (
                <PillButton
                  key={cat.id}
                  label={cat.label}
                  icon={cat.icon}
                  active={activeCategory === cat.id}
                  onClick={() => setActiveCategory(cat.id as keyof typeof suggestions)}
                />
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mb-6"
          >
            <p className="text-xs text-gray-500 mb-3 uppercase tracking-wider">Sugerencias</p>
            <div className="grid grid-cols-2 gap-3">
              {filtered.map((item, index) => {
                const isSelected = selectedItems.includes(item);
                return (
                  <motion.div
                    key={item}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 + index * 0.05 }}
                  >
                    <GlassCard
                      onClick={() => toggleItem(item)}
                      className={`cursor-pointer transition-all duration-300 ${
                        isSelected
                          ? "bg-gradient-to-br from-purple-200/50 to-pink-200/50 border-purple-300/60"
                          : "hover:scale-105"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-800">{item}</p>
                        {isSelected ? (
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        ) : (
                          <Plus className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </GlassCard>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="mb-6"
          >
            <p className="text-xs text-gray-500 mb-3 uppercase tracking-wider">Agregar personalizado</p>
            <GlassCard>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Escribe algo personalizado..."
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCustomItem()}
                  className="flex-1 bg-transparent border-none outline-none text-gray-700 placeholder:text-gray-400"
                />
                <button
                  onClick={addCustomItem}
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center hover:scale-110 transition-transform"
                >
                  <Plus className="w-5 h-5 text-white" />
                </button>
              </div>
            </GlassCard>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="mb-6"
          >
            <p className="text-xs text-gray-500 mb-3 uppercase tracking-wider">Cómo te sientes hoy</p>
            <GlassCard className="space-y-5">
              <RatingSelector label={`Estado de ánimo ${mood !== null ? `· ${MOOD_LABELS[mood]}` : "(1–5)"}`} value={mood} max={5} onChange={setMood} />
              <RatingSelector label={`Energía ${energy !== null ? `· ${ENERGY_LABELS[energy]}` : "(1–5)"}`} value={energy} max={5} onChange={setEnergy} />
              <RatingSelector label={`Dolor ${pain !== null ? `· ${pain}/10` : "(0–10)"}`} value={pain} max={10} onChange={setPain} />
              <div>
                <p className="text-xs text-gray-500 mb-2">Horas de sueño</p>
                <input
                  type="number"
                  min="0"
                  max="24"
                  step="0.5"
                  placeholder="ej. 7.5"
                  value={sleepHours}
                  onChange={(e) => setSleepHours(e.target.value)}
                  className="w-28 px-3 py-2 rounded-xl bg-white/60 border border-white/80 text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-300/50 text-sm"
                />
              </div>
            </GlassCard>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="mb-6"
          >
            <p className="text-xs text-gray-500 mb-3 uppercase tracking-wider">Notas adicionales</p>
            <GlassCard>
              <textarea
                placeholder="¿Algo más que quieras registrar?"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full bg-transparent border-none outline-none text-gray-700 placeholder:text-gray-400 resize-none text-sm leading-relaxed"
              />
            </GlassCard>
          </motion.div>

          {selectedItems.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              <p className="text-xs text-gray-500 mb-3 uppercase tracking-wider">
                Seleccionados ({selectedItems.length})
              </p>
              <GlassCard className="bg-gradient-to-br from-green-100/50 to-emerald-100/50">
                <div className="flex flex-wrap gap-2">
                  {selectedItems.map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-2 bg-white/60 px-3 py-1.5 rounded-full"
                    >
                      <span className="text-sm text-gray-800">{item}</span>
                      <button
                        onClick={() => toggleItem(item)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </motion.div>
          )}

          <AnimatePresence>
            {saveState === "success" && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-4 flex items-center gap-2 rounded-[16px] bg-emerald-50 border border-emerald-200 px-4 py-3"
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                <p className="text-sm text-emerald-700">Tu registro fue guardado en tu mosaico.</p>
              </motion.div>
            )}
            {saveState === "error" && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-4 rounded-[16px] bg-red-50 border border-red-200 px-4 py-3"
              >
                <p className="text-sm text-red-600">Hubo un error al guardar. Intenta de nuevo.</p>
              </motion.div>
            )}
          </AnimatePresence>

          {hasData && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <button
                onClick={handleSave}
                disabled={saveState === "loading"}
                className="w-full py-4 rounded-[20px] bg-gradient-to-r from-purple-400 to-pink-400 text-white font-medium shadow-lg shadow-purple-300/30 hover:shadow-xl hover:shadow-purple-300/40 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                {saveState === "loading" ? "Guardando..." : "Guardar en mi mosaico"}
              </button>
            </motion.div>
          )}
        </div>
      )}

      {activeTab === "historial" && (
        <div className="px-6">
          {logsLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-24 rounded-2xl bg-white/40 animate-pulse" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-16 text-center"
            >
              <BookOpen className="w-12 h-12 text-gray-300 mb-4" />
              <p className="text-gray-500 text-sm leading-relaxed">
                Aún no tienes registros.<br />Empieza registrando cómo te sientes hoy.
              </p>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              {correlations.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <GlassCard className="bg-amber-50/80 border-amber-200/60">
                    <div className="flex items-start gap-3">
                      <Brain className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                      <p className="text-sm text-amber-800">{msg}</p>
                    </div>
                  </GlassCard>
                </motion.div>
              ))}

              {chartData.length >= 3 && (
                <GlassCard>
                  <p className="text-xs text-gray-500 mb-3 uppercase tracking-wider">Tendencia (últimos 14 días)</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: "#9ca3af" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        domain={[0, 10]}
                        tick={{ fontSize: 10, fill: "#9ca3af" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "rgba(255,255,255,0.9)",
                          border: "1px solid rgba(255,255,255,0.8)",
                          borderRadius: 12,
                          fontSize: 12,
                        }}
                        labelStyle={{ color: "#6b7280" }}
                      />
                      <Line type="monotone" dataKey="mood" name="Ánimo" stroke="#a855f7" strokeWidth={2} dot={false} connectNulls />
                      <Line type="monotone" dataKey="sleep" name="Sueño" stroke="#6366f1" strokeWidth={2} dot={false} connectNulls />
                      <Line type="monotone" dataKey="painInv" name="Dolor (inv.)" stroke="#fb7185" strokeWidth={2} dot={false} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="flex gap-4 mt-2 justify-center">
                    {[
                      { color: "bg-purple-500", label: "Ánimo" },
                      { color: "bg-indigo-500", label: "Sueño" },
                      { color: "bg-rose-400", label: "Dolor (inv.)" },
                    ].map(({ color, label }) => (
                      <div key={label} className="flex items-center gap-1.5">
                        <div className={`w-3 h-1.5 rounded-full ${color}`} />
                        <span className="text-xs text-gray-500">{label}</span>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              )}

              <div className="space-y-3">
                {displayLogs.map((log, index) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                  >
                    <GlassCard
                      onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-3 h-3 rounded-full mt-1 shrink-0 ${moodDot(log.mood)}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-medium text-gray-700">{formatLogDate(log.logged_at)}</p>
                            <p className="text-xs text-gray-400">{formatLogTime(log.logged_at)}</p>
                          </div>
                          {log.symptoms && log.symptoms.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-1">
                              {log.symptoms.map((s) => (
                                <span key={s} className="text-xs bg-purple-100/60 text-purple-700 px-2 py-0.5 rounded-full">
                                  {s}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="flex gap-3 text-xs text-gray-500">
                            {log.mood != null && <span>Ánimo {log.mood}/5</span>}
                            {log.energy != null && <span>Energía {log.energy}/5</span>}
                            {log.pain != null && <span>Dolor {log.pain}/10</span>}
                            {log.sleep_hours != null && <span>Sueño {log.sleep_hours}h</span>}
                          </div>
                        </div>
                      </div>

                      <AnimatePresence>
                        {expandedLogId === log.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-3 pt-3 border-t border-white/60 space-y-2">
                              {log.mood != null && (
                                <p className="text-xs text-gray-600">
                                  Estado de ánimo:{" "}
                                  <span className="font-medium">{MOOD_LABELS[log.mood]} ({log.mood}/5)</span>
                                </p>
                              )}
                              {log.energy != null && (
                                <p className="text-xs text-gray-600">
                                  Energía:{" "}
                                  <span className="font-medium">{ENERGY_LABELS[log.energy]} ({log.energy}/5)</span>
                                </p>
                              )}
                              {log.pain != null && (
                                <p className="text-xs text-gray-600">
                                  Dolor: <span className="font-medium">{log.pain}/10</span>
                                </p>
                              )}
                              {log.sleep_hours != null && (
                                <p className="text-xs text-gray-600">
                                  Horas de sueño: <span className="font-medium">{log.sleep_hours}h</span>
                                </p>
                              )}
                              {log.notes && (
                                <p className="text-xs text-gray-600 italic">&ldquo;{log.notes}&rdquo;</p>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </GlassCard>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
