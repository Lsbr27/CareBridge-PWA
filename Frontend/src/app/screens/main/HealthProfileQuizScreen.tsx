"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../providers/AuthProvider";
import { supabase } from "../../../../lib/supabase";

type Answer = string | number | null;

interface Question {
  key: string;
  text: string;
  type: "number" | "options" | "text" | "textarea" | "meal_times_structured";
  options?: string[];
  placeholder?: string;
  optional?: boolean;
}

interface MealTimesState {
  breakfast: string;
  lunch: string;
  dinner: string;
  extra1Label: string;
  extra1Time: string;
  extra2Label: string;
  extra2Time: string;
}

const EMPTY_MEAL_TIMES: MealTimesState = {
  breakfast: "",
  lunch: "",
  dinner: "",
  extra1Label: "",
  extra1Time: "",
  extra2Label: "",
  extra2Time: "",
};

function formatMealTimes(m: MealTimesState): string {
  const parts: string[] = [];
  if (m.breakfast) parts.push(`Desayuno: ${m.breakfast}`);
  if (m.lunch) parts.push(`Almuerzo: ${m.lunch}`);
  if (m.dinner) parts.push(`Comida/Cena: ${m.dinner}`);
  if (m.extra1Label && m.extra1Time) parts.push(`${m.extra1Label}: ${m.extra1Time}`);
  if (m.extra2Label && m.extra2Time) parts.push(`${m.extra2Label}: ${m.extra2Time}`);
  return parts.join(", ");
}

const questions: Question[] = [
  {
    key: "sleep_hours",
    text: "¿Cuántas horas duermes normalmente?",
    type: "number",
    placeholder: "Ej: 7",
  },
  {
    key: "sleep_quality",
    text: "¿Cómo describes la calidad de tu sueño?",
    type: "options",
    options: [
      "Profundo y reparador",
      "Me despierto varias veces",
      "Muy ligero",
      "Depende del día",
    ],
  },
  {
    key: "wake_up_feeling",
    text: "¿Cómo te sientes al despertar?",
    type: "options",
    options: ["Con energía", "Cansada todavía", "Depende del día", "Con ansiedad"],
  },
  {
    key: "physical_activity_frequency",
    text: "¿Con qué frecuencia haces actividad física?",
    type: "options",
    options: [
      "Todos los días",
      "3-4 veces por semana",
      "1-2 veces",
      "Casi nunca",
    ],
  },
  {
    key: "physical_activity_type",
    text: "¿Qué tipo de actividad física haces?",
    type: "text",
    placeholder: "Ej: yoga, caminar, gym...",
  },
  {
    key: "typical_diet",
    text: "¿Cómo describes tu alimentación?",
    type: "options",
    options: [
      "Muy saludable",
      "Bastante equilibrada",
      "Mejorable",
      "Como lo que puedo",
    ],
  },
  {
    key: "meal_times",
    text: "¿A qué horas comes normalmente?",
    type: "meal_times_structured",
  },
  {
    key: "contraceptives",
    text: "¿Usas anticonceptivos?",
    type: "options",
    options: [
      "Sí, hormonales",
      "Sí, no hormonales",
      "No",
      "Prefiero no decir",
    ],
  },
  {
    key: "menstrual_cycle",
    text: "¿Cómo está tu ciclo menstrual?",
    type: "options",
    options: ["Regular", "Irregular", "No tengo", "Prefiero no decir"],
  },
  {
    key: "sexual_activity",
    text: "¿Tienes actividad sexual actualmente?",
    type: "options",
    options: ["Sí", "No", "Prefiero no decir"],
  },
  {
    key: "mood_general",
    text: "¿Cómo describirías tu estado de ánimo general?",
    type: "options",
    options: ["Muy bien", "Bien", "Regular", "Con altibajos", "Mal"],
  },
  {
    key: "profession",
    text: "¿Cuál es tu profesión o qué estudias?",
    type: "text",
    placeholder: "Ej: diseñadora, estudiante de medicina...",
  },
  {
    key: "work_schedule",
    text: "¿Cómo es tu horario de trabajo o estudio?",
    type: "options",
    options: [
      "Flexible",
      "Fijo de oficina",
      "Turnos rotativos",
      "Irregular",
      "Estudio",
    ],
  },
  {
    key: "daily_routine",
    text: "¿Algo más que quieras contarnos sobre tu rutina diaria?",
    type: "textarea",
    placeholder: "Cuéntanos lo que quieras... o salta esta si prefieres.",
    optional: true,
  },
];

export function HealthProfileQuizScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [textInput, setTextInput] = useState("");
  const [mealTimes, setMealTimes] = useState<MealTimesState>(EMPTY_MEAL_TIMES);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const current = questions[step];
  const progress = (step / questions.length) * 100;

  function handleOption(value: string) {
    setAnswers((prev) => ({ ...prev, [current.key]: value }));
    goNext(value);
  }

  function goNext(value?: string) {
    const val =
      current.type === "meal_times_structured"
        ? formatMealTimes(mealTimes) || null
        : (value ?? textInput) || null;
    setAnswers((prev) => ({ ...prev, [current.key]: val }));
    if (step < questions.length - 1) {
      setDirection(1);
      setStep((s) => s + 1);
      setTextInput("");
    } else {
      handleFinish({ ...answers, [current.key]: val });
    }
  }

  function goBack() {
    if (step === 0) return;
    setDirection(-1);
    setStep((s) => s - 1);
    const prevKey = questions[step - 1].key;
    setTextInput((answers[prevKey] as string) ?? "");
  }

  async function handleFinish(finalAnswers: Record<string, Answer>) {
    if (!profile?.id) return;
    setSaving(true);
    await supabase.from("health_profile").upsert(
      {
        profile_id: profile.id,
        sleep_hours: finalAnswers.sleep_hours
          ? Number(finalAnswers.sleep_hours)
          : null,
        sleep_quality: finalAnswers.sleep_quality ?? null,
        wake_up_feeling: finalAnswers.wake_up_feeling ?? null,
        physical_activity_frequency:
          finalAnswers.physical_activity_frequency ?? null,
        physical_activity_type: finalAnswers.physical_activity_type ?? null,
        typical_diet: finalAnswers.typical_diet ?? null,
        meal_times: finalAnswers.meal_times ?? null,
        contraceptives: finalAnswers.contraceptives ?? null,
        menstrual_cycle: finalAnswers.menstrual_cycle ?? null,
        sexual_activity: finalAnswers.sexual_activity ?? null,
        mood_general: finalAnswers.mood_general ?? null,
        profession: finalAnswers.profession ?? null,
        work_schedule: finalAnswers.work_schedule ?? null,
        daily_routine: finalAnswers.daily_routine ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "profile_id" }
    );
    setSaving(false);
    setDone(true);
  }

  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
        >
          <div className="text-6xl mb-6">🌿</div>
          <h1 className="text-2xl font-light text-gray-800 mb-3">
            Tu mosaico de salud está tomando forma
          </h1>
          <p className="text-gray-500 text-sm mb-8 leading-relaxed">
            Gracias por compartir esto con nosotras. Usaremos esta información
            para darte insights más personalizados.
          </p>
          <button
            onClick={() => router.push("/app/insights")}
            className="w-full py-4 rounded-[20px] bg-gradient-to-r from-purple-400 to-pink-400 text-white font-medium shadow-lg shadow-purple-300/30"
          >
            Ver mis insights
          </button>
        </motion.div>
      </div>
    );
  }

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -60 : 60, opacity: 0 }),
  };

  return (
    <div className="min-h-screen flex flex-col p-6 pt-10">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={goBack}
            disabled={step === 0}
            className="text-sm text-gray-400 disabled:opacity-0 transition-opacity"
          >
            ← Atrás
          </button>
          <span className="text-xs text-gray-400">
            {step + 1} / {questions.length}
          </span>
        </div>
        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-purple-400 to-pink-400 rounded-full"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 flex flex-col">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="flex flex-col flex-1"
          >
            <h2 className="text-xl font-light text-gray-800 mb-8 leading-snug">
              {current.text}
            </h2>

            {current.type === "options" && (
              <div className="space-y-3">
                {current.options!.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => handleOption(opt)}
                    className={`w-full text-left px-5 py-4 rounded-[16px] border transition-all duration-200 text-sm ${
                      answers[current.key] === opt
                        ? "bg-gradient-to-r from-purple-100 to-pink-100 border-purple-300 text-purple-800 font-medium"
                        : "bg-white/50 border-white/60 text-gray-700 hover:bg-white/70"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {current.type === "number" && (
              <div className="space-y-6">
                <input
                  type="number"
                  min={0}
                  max={24}
                  step={0.5}
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={current.placeholder}
                  className="w-full px-5 py-4 rounded-[16px] bg-white/50 border border-white/60 text-gray-800 text-lg outline-none focus:border-purple-300 transition-colors"
                />
                <button
                  onClick={() => goNext()}
                  disabled={!textInput}
                  className="w-full py-4 rounded-[20px] bg-gradient-to-r from-purple-400 to-pink-400 text-white font-medium disabled:opacity-40 transition-opacity"
                >
                  Continuar →
                </button>
              </div>
            )}

            {current.type === "text" && (
              <div className="space-y-6">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={current.placeholder}
                  className="w-full px-5 py-4 rounded-[16px] bg-white/50 border border-white/60 text-gray-800 outline-none focus:border-purple-300 transition-colors"
                />
                <button
                  onClick={() => goNext()}
                  disabled={!textInput}
                  className="w-full py-4 rounded-[20px] bg-gradient-to-r from-purple-400 to-pink-400 text-white font-medium disabled:opacity-40 transition-opacity"
                >
                  Continuar →
                </button>
              </div>
            )}

            {current.type === "textarea" && (
              <div className="space-y-6">
                <textarea
                  rows={4}
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={current.placeholder}
                  className="w-full px-5 py-4 rounded-[16px] bg-white/50 border border-white/60 text-gray-800 outline-none focus:border-purple-300 transition-colors resize-none"
                />
                <button
                  onClick={() => goNext()}
                  className="w-full py-4 rounded-[20px] bg-gradient-to-r from-purple-400 to-pink-400 text-white font-medium"
                >
                  {textInput ? "Continuar →" : "Saltar"}
                </button>
              </div>
            )}

            {current.type === "meal_times_structured" && (
              <div className="space-y-6">
                <div className="space-y-3">
                  {(
                    [
                      { label: "Desayuno", field: "breakfast" },
                      { label: "Almuerzo", field: "lunch" },
                      { label: "Comida / Cena", field: "dinner" },
                    ] as const
                  ).map(({ label, field }) => (
                    <div
                      key={field}
                      className="flex items-center gap-3 bg-white/50 border border-white/60 rounded-[16px] px-4 py-3"
                    >
                      <span className="text-sm text-gray-600 w-28 flex-shrink-0">
                        {label}
                      </span>
                      <input
                        type="time"
                        value={mealTimes[field]}
                        onChange={(e) =>
                          setMealTimes((prev) => ({
                            ...prev,
                            [field]: e.target.value,
                          }))
                        }
                        className="flex-1 text-sm text-gray-800 bg-transparent outline-none"
                      />
                    </div>
                  ))}

                  {/* Otro 1 */}
                  <div className="flex items-center gap-2 bg-white/50 border border-white/60 rounded-[16px] px-4 py-3">
                    <input
                      type="text"
                      value={mealTimes.extra1Label}
                      onChange={(e) =>
                        setMealTimes((prev) => ({
                          ...prev,
                          extra1Label: e.target.value,
                        }))
                      }
                      placeholder="Otro (ej: merienda)"
                      className="flex-1 text-sm text-gray-600 bg-transparent outline-none placeholder:text-gray-400"
                    />
                    <input
                      type="time"
                      value={mealTimes.extra1Time}
                      onChange={(e) =>
                        setMealTimes((prev) => ({
                          ...prev,
                          extra1Time: e.target.value,
                        }))
                      }
                      className="text-sm text-gray-800 bg-transparent outline-none"
                    />
                  </div>

                  {/* Otro 2 */}
                  <div className="flex items-center gap-2 bg-white/50 border border-white/60 rounded-[16px] px-4 py-3">
                    <input
                      type="text"
                      value={mealTimes.extra2Label}
                      onChange={(e) =>
                        setMealTimes((prev) => ({
                          ...prev,
                          extra2Label: e.target.value,
                        }))
                      }
                      placeholder="Otro (ej: snack)"
                      className="flex-1 text-sm text-gray-600 bg-transparent outline-none placeholder:text-gray-400"
                    />
                    <input
                      type="time"
                      value={mealTimes.extra2Time}
                      onChange={(e) =>
                        setMealTimes((prev) => ({
                          ...prev,
                          extra2Time: e.target.value,
                        }))
                      }
                      className="text-sm text-gray-800 bg-transparent outline-none"
                    />
                  </div>
                </div>

                <button
                  onClick={() => goNext()}
                  disabled={
                    !mealTimes.breakfast && !mealTimes.lunch && !mealTimes.dinner
                  }
                  className="w-full py-4 rounded-[20px] bg-gradient-to-r from-purple-400 to-pink-400 text-white font-medium disabled:opacity-40 transition-opacity"
                >
                  Continuar →
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {saving && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center">
          <p className="text-gray-600 text-sm">Guardando tu perfil...</p>
        </div>
      )}
    </div>
  );
}
