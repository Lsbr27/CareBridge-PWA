"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, Activity, Clock, Heart, Pill, Plus, Check, CheckCircle2 } from "lucide-react";
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

type SaveState = "idle" | "loading" | "success" | "error";

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

export function AddDataScreen() {
  const { profile } = useAuth();

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

  return (
    <div className="p-6 pt-8 pb-28">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-light text-gray-800 mb-2">Registrar datos</h1>
        <p className="text-sm text-gray-500">Construye tu mosaico de salud paso a paso</p>
      </motion.div>

      {/* Search Bar */}
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

      {/* Category Pills */}
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

      {/* Suggestions */}
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

      {/* Custom Input */}
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

      {/* Health metrics */}
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

      {/* Notes */}
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

      {/* Selected Items Summary */}
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

      {/* Feedback messages */}
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

      {/* Save Button */}
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
  );
}
