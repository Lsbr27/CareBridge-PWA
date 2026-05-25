"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, Send, SkipForward } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../providers/AuthProvider";
import { supabase } from "../../../../lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

type MessageRole = "user" | "assistant";
type Message = { id: string; role: MessageRole; text: string };

// The agent's opening line — rendered instantly, included in API history
const INITIAL_MESSAGE: Message = {
  id: "onboarding-initial",
  role: "assistant",
  text: "¡Hola! Soy CareGuide, tu asistente de salud personal 👋\n\nAntes de que explores la app, me gustaría conocerte un poco para poder acompañarte mejor. Son solo unas preguntas cortas y puedes saltar lo que no quieras compartir ahora.\n\n¿Cómo estás durmiendo últimamente? ¿Cuántas horas duermes más o menos?",
};

// ─── Markdown renderer (minimal) ──────────────────────────────────────────────

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*(?:[^*]|\*(?!\*))*\*\*)/g);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong>
        ) : p
      )}
    </>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const lines = message.text.split("\n").filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}
    >
      <div
        className={`max-w-[85%] rounded-[20px] px-4 py-3 shadow-sm text-sm leading-relaxed ${
          isUser
            ? "bg-gradient-to-br from-purple-500 to-pink-500 text-white rounded-br-sm"
            : "bg-white/70 backdrop-blur-sm border border-white/60 text-slate-700 rounded-bl-sm"
        }`}
      >
        {lines.map((line, i) => (
          <p key={i} className={i > 0 ? "mt-1.5" : ""}>
            {renderInline(line)}
          </p>
        ))}
      </div>
    </motion.div>
  );
}

function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex justify-start mb-3"
    >
      <div className="bg-white/70 backdrop-blur-sm border border-white/60 rounded-[20px] rounded-bl-sm px-4 py-3 flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────────

export function OnboardingChatScreen() {
  const { user, refreshProfile } = useAuth();
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const persistMessage = useCallback(
    async (msg: Message) => {
      if (!user) return;
      await supabase.from("chat_messages").insert({
        id: msg.id === "onboarding-initial" ? undefined : msg.id,
        profile_id: user.id,
        role: msg.role,
        text_content: msg.text,
        has_image: false,
        tools_used: [],
        is_exam_analysis: false,
      });
    },
    [user]
  );

  const handleSkip = useCallback(async () => {
    if (!user || isSkipping) return;
    setIsSkipping(true);
    await supabase
      .from("profiles")
      .update({ onboarding_chat_completed: true })
      .eq("id", user.id);
    await refreshProfile();
    router.replace("/app");
  }, [user, isSkipping, refreshProfile, router]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading || !user) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    // Persist user message
    persistMessage(userMsg);

    // Build history: all messages except the static initial (it's added separately as system context)
    const history = [
      // Include the initial message as the first assistant turn
      { role: "assistant" as const, content: INITIAL_MESSAGE.text },
      // Include all subsequent messages
      ...messages
        .filter((m) => m.id !== "onboarding-initial")
        .map((m) => ({ role: m.role, content: m.text })),
      // Current user message
      { role: "user" as const, content: text },
    ];

    try {
      const res = await fetch("/api/agent/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, userId: user.id }),
      });

      if (!res.ok || !res.body) throw new Error("No se pudo conectar con el agente.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";
      let onboardingCompleted = false;
      const assistantId = crypto.randomUUID();

      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", text: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const chunk = JSON.parse(line) as { type: string; text?: string; tool?: string };
            if (chunk.type === "text" && chunk.text) {
              assistantText += chunk.text;
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, text: assistantText } : m))
              );
            } else if (chunk.type === "tool_start" && chunk.tool === "complete_onboarding") {
              onboardingCompleted = true;
            }
          } catch {
            // ignore malformed chunk
          }
        }
      }

      // Persist assistant response
      if (assistantText) {
        persistMessage({ id: assistantId, role: "assistant", text: assistantText });
      }

      // Redirect after completion
      if (onboardingCompleted) {
        await refreshProfile();
        router.replace("/app");
      }
    } catch (err) {
      const errText = err instanceof Error ? err.message : "Error al conectar.";
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", text: `Lo siento, ocurrió un error: ${errText}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, user, messages, persistMessage, refreshProfile, router]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-dvh bg-gradient-to-br from-[#f0ecff] via-[#fdf6ff] to-[#fff4ef]">
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-6 pb-3 flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-purple-600">
            CareMosaic
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 leading-tight mt-0.5">
            Cuéntame sobre ti
          </h1>
          <p className="text-xs text-slate-500 mt-1">Paso 2 de 2 · Perfil de salud</p>
        </div>
        <button
          onClick={handleSkip}
          disabled={isSkipping}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors mt-1 disabled:opacity-50"
        >
          {isSkipping ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <SkipForward className="w-3.5 h-3.5" />
          )}
          Saltar por ahora
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        <AnimatePresence>
          {isLoading && <TypingIndicator key="typing" />}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className="flex-shrink-0 px-4"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-end gap-2 bg-white/60 backdrop-blur-xl border border-white/70 rounded-[24px] px-3 py-2 shadow-lg">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu respuesta…"
            rows={1}
            disabled={isLoading}
            className="flex-1 bg-transparent resize-none text-sm text-slate-800 placeholder-slate-400 outline-none py-1.5 max-h-32 overflow-y-auto disabled:opacity-60"
            style={{ lineHeight: "1.4" }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-md disabled:opacity-40 transition-opacity active:scale-95"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
