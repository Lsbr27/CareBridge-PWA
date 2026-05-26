"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  CalendarDays,
  Camera,
  FileText,
  ImageIcon,
  Loader2,
  MessageSquarePlus,
  Send,
  Stethoscope,
  X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { CareGuideCard } from "../../components/brand/CareGuideCard";
import { useAuth } from "../../providers/AuthProvider";
import { supabase } from "../../../../lib/supabase";
import type Anthropic from "@anthropic-ai/sdk";

// ─── Types ────────────────────────────────────────────────────────────────────

type MessageRole = "user" | "assistant";

type TextPart = { type: "text"; text: string };
type ImagePart = {
  type: "image";
  source: { type: "base64"; media_type: string; data: string };
};
type SpecialistCardPart = {
  type: "specialist_card";
  specialty: string;
  reason: string;
  exam_type?: string;
};
type AppointmentCardPart = {
  type: "appointment_card";
  id: string;
  title: string;
  appointment_at: string;
  specialty?: string | null;
  provider_name?: string | null;
};
type UIPart = TextPart | ImagePart | { type: "preview_url"; url: string } | SpecialistCardPart | AppointmentCardPart;

type Message = {
  id: string;
  role: MessageRole;
  parts: UIPart[];
  toolsUsed?: string[];
  isExamAnalysis?: boolean;
  hasImage?: boolean;
  saving?: boolean;
  savedId?: string;
};

type ConversationPreview = {
  conversationId: string;
  preview: string;
  createdAt: string;
  lastAt: string;
};

const TOOL_LABELS: Record<string, string> = {
  get_patient_profile: "leyendo tu perfil",
  get_medications: "revisando medicamentos",
  get_daily_logs: "consultando registros diarios",
  get_exam_history: "revisando historial de exámenes",
  get_patient_risk: "calculando riesgo con IA",
  save_exam_analysis: "guardando examen",
  update_health_profile: "actualizando tu perfil",
  update_profile: "actualizando tu información",
  log_symptom: "registrando síntoma",
  get_available_doctors: "buscando médicos disponibles",
  book_appointment: "agendando cita",
  suggest_specialist: "buscando especialista sugerido",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `${mins} min`;
  if (hours < 24) return `${hours} h`;
  if (days === 1) return "ayer";
  if (days < 7) return `${days} d`;
  return new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

function dayGroup(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 7) return "Esta semana";
  return "Antes";
}

// ─── Image compression ─────────────────────────────────────────────────────────

async function compressImage(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se pudo cargar la imagen.")); };
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX_PX = 1536 * 1536;
      const ratio = Math.min(1, Math.sqrt(MAX_PX / (img.width * img.height)));
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas no disponible.")); return; }
      ctx.drawImage(img, 0, 0, w, h);
      resolve({ base64: canvas.toDataURL("image/jpeg", 0.82).split(",")[1], mimeType: "image/jpeg" });
    };
    img.src = url;
  });
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*(?:[^*]|\*(?!\*))*\*\*)/g);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <strong key={i} className="font-semibold text-slate-800">{p.slice(2, -2)}</strong>
        ) : p
      )}
    </>
  );
}

function AssistantText({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0, key = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) { elements.push(<div key={key++} className="h-1.5" />); i++; continue; }
    if (trimmed === "---") { elements.push(<hr key={key++} className="border-slate-200 my-2" />); i++; continue; }

    const hMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (hMatch) {
      const level = hMatch[1].length;
      const cls = level === 1 ? "text-base font-bold text-slate-900 mt-3 mb-1"
        : level === 2 ? "text-sm font-semibold text-slate-800 mt-3 mb-1"
        : "text-sm font-medium text-slate-700 mt-2 mb-0.5";
      elements.push(<p key={key++} className={cls}>{renderInline(hMatch[2])}</p>);
      i++; continue;
    }

    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) { tableLines.push(lines[i].trim()); i++; }
      const parseCells = (row: string) => row.split("|").slice(1, -1).map((c) => c.trim());
      const dataRows = tableLines.filter((l) => !/^\|[\s\-:|]+\|$/.test(l));
      if (dataRows.length > 0) {
        const [headerRow, ...bodyRows] = dataRows;
        elements.push(
          <div key={key++} className="overflow-x-auto my-2 -mx-1">
            <table className="w-full text-xs border-collapse">
              <thead><tr>{parseCells(headerRow).map((h, idx) => (
                <th key={idx} className="text-left font-semibold text-slate-700 pb-1.5 pr-3 border-b border-slate-200 whitespace-nowrap">{renderInline(h)}</th>
              ))}</tr></thead>
              <tbody>{bodyRows.map((row, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? "" : "bg-slate-50/60"}>{parseCells(row).map((cell, ci) => (
                  <td key={ci} className="py-1 pr-3 text-slate-600 border-b border-slate-100">{renderInline(cell)}</td>
                ))}</tr>
              ))}</tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    if (/^[-*]\s/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, "")); i++;
      }
      elements.push(
        <ul key={key++} className="space-y-0.5 my-1">
          {items.map((item, idx) => (
            <li key={idx} className="flex gap-1.5 text-sm text-slate-700">
              <span className="text-purple-400 mt-0.5 flex-shrink-0">•</span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    elements.push(<p key={key++} className="text-sm text-slate-700 leading-relaxed">{renderInline(trimmed)}</p>);
    i++;
  }

  return <div className="space-y-0.5">{elements}</div>;
}

// ─── Specialist card ──────────────────────────────────────────────────────────

function SpecialistCard({ specialty, reason }: { specialty: string; reason: string }) {
  const router = useRouter();
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100/80 rounded-[20px] p-4 max-w-[85%] shadow-sm"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 shadow-sm">
          <Stethoscope className="w-4.5 h-4.5 text-white" style={{ width: "1.1rem", height: "1.1rem" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-purple-500 uppercase tracking-widest mb-0.5">Especialista sugerido</p>
          <p className="text-sm font-semibold text-slate-800 leading-snug">{specialty}</p>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{reason}</p>
        </div>
      </div>
      <button
        onClick={() =>
          router.push(`/app/appointments?specialty=${encodeURIComponent(specialty)}&tab=agendar`)
        }
        className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold py-2.5 rounded-[14px] shadow-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
      >
        <CalendarDays className="w-4 h-4" />
        Agendar cita ahora
      </button>
    </motion.div>
  );
}

// ─── Appointment booked card ──────────────────────────────────────────────────

function AppointmentBookedCard({ title, appointment_at, specialty, provider_name }: AppointmentCardPart) {
  const router = useRouter();

  const formatted = (() => {
    try {
      const d = new Date(appointment_at);
      const WEEKDAY = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
      const MONTH = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
      return `${WEEKDAY[d.getDay()]} ${d.getDate()} ${MONTH[d.getMonth()]} · ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    } catch {
      return appointment_at;
    }
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100/80 rounded-[20px] p-4 max-w-[85%] shadow-sm"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center flex-shrink-0 shadow-sm">
          <CalendarDays className="text-white" style={{ width: "1.1rem", height: "1.1rem" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-widest mb-0.5">Cita agendada</p>
          <p className="text-sm font-semibold text-slate-800 leading-snug">{provider_name ?? title}</p>
          {specialty && <p className="text-xs text-slate-500 mt-0.5">{specialty}</p>}
          <p className="text-xs text-emerald-700 font-medium mt-1">{formatted}</p>
        </div>
      </div>
      <button
        onClick={() => router.push("/app/appointments?tab=proximas")}
        className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold py-2.5 rounded-[14px] shadow-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
      >
        <CalendarDays className="w-4 h-4" />
        Ver mis citas
      </button>
    </motion.div>
  );
}

// ─── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ message, onSave }: { message: Message; onSave?: (msg: Message) => void }) {
  const isUser = message.role === "user";
  const imagePreview = message.parts.find((p): p is { type: "preview_url"; url: string } => p.type === "preview_url");
  const textParts = message.parts.filter((p): p is TextPart => p.type === "text");
  const specialistCard = message.parts.find((p): p is SpecialistCardPart => p.type === "specialist_card");
  const appointmentCard = message.parts.find((p): p is AppointmentCardPart => p.type === "appointment_card");
  const fullText = textParts.map((p) => p.text).join("");
  const canSave = !isUser && message.isExamAnalysis && !message.savedId && onSave;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}
    >
      <div className={`max-w-[85%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        {message.toolsUsed && message.toolsUsed.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1">
            {message.toolsUsed.map((t) => (
              <span key={t} className="text-[10px] bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">
                {TOOL_LABELS[t] ?? t}
              </span>
            ))}
          </div>
        )}
        {imagePreview && (
          <img src={imagePreview.url} alt="Examen adjunto" className="w-40 h-40 object-cover rounded-2xl border border-white/60 shadow-sm mb-1" />
        )}
        {!imagePreview && message.hasImage && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1 bg-white/50 rounded-xl px-3 py-1.5 border border-white/60">
            <ImageIcon className="w-3.5 h-3.5" /> imagen adjunta
          </div>
        )}
        {fullText && (
          <div className={`rounded-[20px] px-4 py-3 shadow-sm ${
            isUser
              ? "bg-gradient-to-br from-purple-500 to-pink-500 text-white rounded-br-sm"
              : "bg-white/70 backdrop-blur-sm border border-white/60 rounded-bl-sm"
          }`}>
            {isUser ? <p className="text-sm text-white leading-relaxed">{fullText}</p> : <AssistantText text={fullText} />}
          </div>
        )}
        {specialistCard && (
          <SpecialistCard specialty={specialistCard.specialty} reason={specialistCard.reason} />
        )}
        {appointmentCard && (
          <AppointmentBookedCard {...appointmentCard} />
        )}
        {canSave && (
          <button
            onClick={() => onSave(message)}
            disabled={message.saving}
            className="self-start flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-sm mt-0.5 disabled:opacity-60"
          >
            {message.saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
            {message.saving ? "Guardando…" : "Guardar en mis exámenes"}
          </button>
        )}
        {message.savedId && <p className="self-start text-xs text-green-600 mt-0.5 pl-1">✓ Guardado en tu historial</p>}
      </div>
    </motion.div>
  );
}

// ─── Typing indicator ──────────────────────────────────────────────────────────

function TypingIndicator({ label }: { label?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex justify-start mb-3">
      <div className="bg-white/70 backdrop-blur-sm border border-white/60 rounded-[20px] rounded-bl-sm px-4 py-3 flex items-center gap-2">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
        {label && <span className="text-xs text-slate-500">{label}</span>}
      </div>
    </motion.div>
  );
}

function HistorySkeleton() {
  return (
    <div className="space-y-3 py-2">
      {[70, 55, 80].map((w, i) => (
        <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
          <div className="h-9 rounded-[20px] animate-pulse bg-white/40" style={{ width: `${w}%` }} />
        </div>
      ))}
    </div>
  );
}

// ─── Conversation list view ────────────────────────────────────────────────────

function ConversationList({
  conversations,
  loading,
  onOpen,
  onNew,
}: {
  conversations: ConversationPreview[];
  loading: boolean;
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  const groups = ["Hoy", "Ayer", "Esta semana", "Antes"];
  const grouped = conversations.reduce<Record<string, ConversationPreview[]>>((acc, c) => {
    const g = dayGroup(c.lastAt);
    if (!acc[g]) acc[g] = [];
    acc[g].push(c);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-dvh bg-gradient-to-br from-[#f0ecff] via-[#fdf6ff] to-[#fff4ef]">
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-6 pb-3 flex items-end justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-purple-600">CareMosaic</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 leading-tight mt-0.5">CareGuide</h1>
        </div>
        <button
          onClick={onNew}
          className="flex items-center gap-1.5 bg-gradient-to-br from-purple-500 to-pink-500 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-md active:scale-95 transition-transform mb-1"
        >
          <MessageSquarePlus className="w-3.5 h-3.5" />
          Nueva
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 pb-28">
        {loading ? (
          <div className="space-y-3 pt-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-[16px] animate-pulse bg-white/40" />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center pt-20 gap-4 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center">
              <MessageSquarePlus className="w-8 h-8 text-purple-400" />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-700">Sin conversaciones aún</p>
              <p className="text-sm text-slate-400 mt-1">Toca &ldquo;Nueva&rdquo; para hablar con CareGuide</p>
            </div>
            <button
              onClick={onNew}
              className="mt-2 bg-gradient-to-br from-purple-500 to-pink-500 text-white text-sm font-semibold px-6 py-2.5 rounded-full shadow-md active:scale-95 transition-transform"
            >
              Empezar conversación
            </button>
          </motion.div>
        ) : (
          <div className="space-y-5 pt-2">
            {groups.filter((g) => grouped[g]?.length).map((group) => (
              <div key={group}>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">{group}</p>
                <div className="space-y-2">
                  {grouped[group].map((conv) => (
                    <motion.button
                      key={conv.conversationId}
                      onClick={() => onOpen(conv.conversationId)}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="w-full text-left bg-white/60 backdrop-blur-sm border border-white/70 rounded-[16px] px-4 py-3.5 shadow-sm active:scale-[0.98] transition-transform"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm text-slate-700 leading-snug line-clamp-2 flex-1">
                          {conv.preview || "Conversación"}
                        </p>
                        <span className="text-[11px] text-slate-400 flex-shrink-0 mt-0.5">
                          {relativeTime(conv.lastAt)}
                        </span>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────────

export function ChatScreen() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Conversation management
  const [view, setView] = useState<"list" | "chat">("list");
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [convLoading, setConvLoading] = useState(true);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pendingImage, setPendingImage] = useState<{
    file: File; previewUrl: string; base64: string; mimeType: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [activeToolLabel, setActiveToolLabel] = useState<string | null>(null);

  const firstName = profile?.full_name?.split(" ")[0];

  // ── Load conversation list ────────────────────────────────────────────────────

  const loadConversationList = useCallback(async () => {
    if (!user) return;
    setConvLoading(true);
    const { data } = await supabase
      .from("chat_messages")
      .select("conversation_id, text_content, created_at")
      .eq("profile_id", user.id)
      .not("conversation_id", "is", null)
      .order("created_at", { ascending: true });

    if (data) {
      const grouped = new Map<string, ConversationPreview>();
      for (const msg of data) {
        const cid = msg.conversation_id as string;
        if (!grouped.has(cid)) {
          grouped.set(cid, {
            conversationId: cid,
            preview: (msg.text_content ?? "").slice(0, 120),
            createdAt: msg.created_at,
            lastAt: msg.created_at,
          });
        } else {
          grouped.get(cid)!.lastAt = msg.created_at;
        }
      }
      setConversations(
        Array.from(grouped.values()).sort(
          (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
        )
      );
    }
    setConvLoading(false);
  }, [user]);

  useEffect(() => {
    loadConversationList();
  }, [loadConversationList]);

  // ── Handle URL params (from home widget) ─────────────────────────────────────

  useEffect(() => {
    const isNew = searchParams.get("new") === "1";
    const q = searchParams.get("q");
    if (isNew || q) {
      const newId = crypto.randomUUID();
      setActiveConvId(newId);
      setMessages([]);
      setView("chat");
      if (q) setInput(decodeURIComponent(q));
      router.replace("/app/chat");
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-scroll ──────────────────────────────────────────────────────────────

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // ── Start new conversation ────────────────────────────────────────────────────

  const startNewConversation = useCallback(() => {
    setActiveConvId(crypto.randomUUID());
    setMessages([]);
    setInput("");
    setPendingImage(null);
    setView("chat");
    setTimeout(() => inputRef.current?.focus(), 150);
  }, []);

  // ── Open existing conversation ────────────────────────────────────────────────

  const openConversation = useCallback(async (convId: string) => {
    setActiveConvId(convId);
    setMessages([]);
    setIsLoadingHistory(true);
    setView("chat");

    const { data } = await supabase
      .from("chat_messages")
      .select("id, role, text_content, has_image, tools_used, is_exam_analysis")
      .eq("profile_id", user!.id)
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });

    if (data) {
      setMessages(
        data.map((row) => ({
          id: row.id,
          role: row.role as MessageRole,
          parts: row.text_content ? [{ type: "text" as const, text: row.text_content }] : [],
          toolsUsed: row.tools_used ?? [],
          isExamAnalysis: row.is_exam_analysis,
          hasImage: row.has_image,
        }))
      );
    }
    setIsLoadingHistory(false);
  }, [user]);

  // ── Go back to list ──────────────────────────────────────────────────────────

  const goToList = useCallback(() => {
    setView("list");
    setActiveConvId(null);
    setMessages([]);
    setInput("");
    if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl);
    setPendingImage(null);
    loadConversationList();
  }, [pendingImage, loadConversationList]);

  // ── Persist message ──────────────────────────────────────────────────────────

  const persistMessage = useCallback(
    async (msg: Message, hadImage: boolean) => {
      if (!user || !activeConvId) return;
      const textPart = msg.parts.find((p): p is TextPart => p.type === "text");
      await supabase.from("chat_messages").insert({
        id: msg.id,
        profile_id: user.id,
        role: msg.role,
        text_content: textPart?.text ?? null,
        has_image: hadImage,
        tools_used: msg.toolsUsed ?? [],
        is_exam_analysis: msg.isExamAnalysis ?? false,
        conversation_id: activeConvId,
      });
    },
    [user, activeConvId]
  );

  // ── Image selection ──────────────────────────────────────────────────────────

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const previewUrl = URL.createObjectURL(file);
    try {
      const { base64, mimeType } = await compressImage(file);
      setPendingImage({ file, previewUrl, base64, mimeType });
    } catch {
      URL.revokeObjectURL(previewUrl);
    }
  }, []);

  const clearPendingImage = useCallback(() => {
    if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl);
    setPendingImage(null);
  }, [pendingImage]);

  // ── Save exam ────────────────────────────────────────────────────────────────

  const handleSaveExam = useCallback(async (targetMsg: Message) => {
    if (!user) return;
    const text = targetMsg.parts.filter((p): p is TextPart => p.type === "text").map((p) => p.text).join("");
    setMessages((prev) => prev.map((m) => (m.id === targetMsg.id ? { ...m, saving: true } : m)));
    try {
      const { data, error } = await supabase
        .from("exam_documents")
        .insert({ profile_id: user.id, image_path: null, analysis_text: text })
        .select("id").single();
      if (error) throw error;
      setMessages((prev) => prev.map((m) => m.id === targetMsg.id ? { ...m, saving: false, savedId: data.id } : m));
    } catch {
      setMessages((prev) => prev.map((m) => m.id === targetMsg.id ? { ...m, saving: false } : m));
    }
  }, [user]);

  // ── Send message ─────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if ((!text && !pendingImage) || isLoading || !user || !activeConvId) return;

    const apiParts: Anthropic.ContentBlockParam[] = [];
    if (pendingImage) {
      apiParts.push({
        type: "image",
        source: { type: "base64", media_type: pendingImage.mimeType as "image/jpeg", data: pendingImage.base64 },
      });
    }
    if (text) apiParts.push({ type: "text", text });
    if (!text && pendingImage) apiParts.push({ type: "text", text: "Por favor analiza este examen." });

    const uiParts: UIPart[] = [];
    if (pendingImage) uiParts.push({ type: "preview_url", url: pendingImage.previewUrl });
    if (text) uiParts.push({ type: "text", text });
    if (!text && pendingImage) uiParts.push({ type: "text", text: "Por favor analiza este examen." });

    const hadImage = pendingImage !== null;
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", parts: uiParts };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setPendingImage(null);
    setIsLoading(true);
    setActiveToolLabel(null);

    persistMessage(userMsg, hadImage);

    const VALID_MIME = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
    const history: Anthropic.MessageParam[] = messages
      .slice(-40)
      .filter((m) => m.parts.some((p) => p.type === "text" || p.type === "image"))
      .map((m) => ({
        role: m.role,
        content: m.parts
          .filter((p): p is TextPart | ImagePart => p.type === "text" || p.type === "image")
          .map((p): Anthropic.ContentBlockParam => {
            if (p.type === "image") {
              const mime = VALID_MIME.has(p.source.media_type) ? (p.source.media_type as "image/jpeg") : "image/jpeg";
              return { type: "image", source: { type: "base64", media_type: mime, data: p.source.data } };
            }
            return { type: "text", text: p.text };
          }),
      }));
    history.push({ role: "user", content: apiParts });

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, userId: user.id }),
      });

      if (!res.ok || !res.body) throw new Error("No se pudo conectar con el agente.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "", assistantText = "";
      const toolsUsed: string[] = [];
      const assistantId = crypto.randomUUID();

      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", parts: [], toolsUsed: [], isExamAnalysis: hadImage }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const chunk = JSON.parse(line) as {
              type: string; text?: string; tool?: string; message?: string;
              specialty?: string; reason?: string; exam_type?: string;
              id?: string; title?: string; appointment_at?: string;
              provider_name?: string;
            };
            if (chunk.type === "text" && chunk.text) {
              assistantText += chunk.text;
              setMessages((prev) => prev.map((m) => m.id === assistantId
                ? { ...m, parts: [{ type: "text", text: assistantText }, ...m.parts.filter(p => p.type === "specialist_card" || p.type === "appointment_card")], toolsUsed } : m));
              setActiveToolLabel(null);
            } else if (chunk.type === "specialist_card" && chunk.specialty) {
              const cardPart: SpecialistCardPart = {
                type: "specialist_card",
                specialty: chunk.specialty,
                reason: chunk.reason ?? "",
                exam_type: chunk.exam_type,
              };
              setMessages((prev) => prev.map((m) => m.id === assistantId
                ? { ...m, parts: [...m.parts.filter(p => p.type !== "specialist_card"), cardPart] } : m));
            } else if (chunk.type === "appointment_booked" && chunk.appointment_at) {
              const apptPart: AppointmentCardPart = {
                type: "appointment_card",
                id: chunk.id ?? "",
                title: chunk.title ?? "",
                appointment_at: chunk.appointment_at,
                specialty: chunk.specialty ?? null,
                provider_name: chunk.provider_name ?? null,
              };
              setMessages((prev) => prev.map((m) => m.id === assistantId
                ? { ...m, parts: [...m.parts.filter(p => p.type !== "appointment_card"), apptPart] } : m));
            } else if (chunk.type === "tool_start" && chunk.tool) {
              if (!toolsUsed.includes(chunk.tool)) toolsUsed.push(chunk.tool);
              setActiveToolLabel(TOOL_LABELS[chunk.tool] ?? chunk.tool);
            } else if (chunk.type === "done") {
              setActiveToolLabel(null);
            } else if (chunk.type === "error") {
              assistantText += `\n\nLo siento, ocurrió un error: ${chunk.message}`;
              setMessages((prev) => prev.map((m) => m.id === assistantId
                ? { ...m, parts: [{ type: "text", text: assistantText }] } : m));
            }
          } catch { /* ignore malformed chunk */ }
        }
      }

      persistMessage(
        { id: assistantId, role: "assistant", parts: assistantText ? [{ type: "text", text: assistantText }] : [], toolsUsed, isExamAnalysis: hadImage },
        false
      );
    } catch (err) {
      const errText = err instanceof Error ? err.message : "Error al conectar con el agente.";
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", parts: [{ type: "text", text: `Lo siento, ocurrió un error: ${errText}` }] }]);
    } finally {
      setIsLoading(false);
      setActiveToolLabel(null);
    }
  }, [input, pendingImage, isLoading, user, activeConvId, messages, persistMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const canSend = (input.trim().length > 0 || pendingImage !== null) && !isLoading && !isLoadingHistory;

  // ── List view ─────────────────────────────────────────────────────────────────

  if (view === "list") {
    return (
      <ConversationList
        conversations={conversations}
        loading={convLoading}
        onOpen={openConversation}
        onNew={startNewConversation}
      />
    );
  }

  // ── Chat view ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-dvh bg-gradient-to-br from-[#f0ecff] via-[#fdf6ff] to-[#fff4ef]">
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-6 pb-3 flex items-center gap-3">
        <button
          onClick={goToList}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/60 backdrop-blur-sm border border-white/70 text-slate-500 active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-purple-600">CareMosaic</p>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900 leading-tight">CareGuide</h1>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {isLoadingHistory ? (
          <HistorySkeleton />
        ) : messages.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
            <CareGuideCard
              tone="insights"
              mood="happy"
              title="Tu asistente de salud"
              message={
                firstName
                  ? `¡Hola, ${firstName}! Puedo ayudarte a entender tus exámenes, revisar tus medicamentos o responder preguntas sobre tu salud. ¿En qué te ayudo hoy?`
                  : "Puedo ayudarte a entender tus exámenes, revisar tus medicamentos o responder preguntas sobre tu salud. ¿En qué te ayudo hoy?"
              }
            />
            <div className="flex flex-wrap gap-2 mt-3">
              {["¿Cómo están mis niveles de riesgo?", "Analiza un examen", "¿Tomé todos mis medicamentos?", "Resumen de mi salud"].map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="text-xs bg-white/60 backdrop-blur-sm border border-white/60 text-slate-600 px-3 py-1.5 rounded-full shadow-sm active:scale-95 transition-transform"
                >
                  {s}
                </button>
              ))}
            </div>
          </motion.div>
        ) : null}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} onSave={msg.role === "assistant" ? handleSaveExam : undefined} />
        ))}

        <AnimatePresence>
          {isLoading && <TypingIndicator key="typing" label={activeToolLabel ?? undefined} />}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div
        className="flex-shrink-0 px-4 pb-safe"
        style={{ paddingBottom: "calc(6.5rem + env(safe-area-inset-bottom))" }}
      >
        {pendingImage && (
          <div className="relative inline-block mb-2">
            <img src={pendingImage.previewUrl} alt="Imagen adjunta" className="w-16 h-16 object-cover rounded-xl border border-white/60 shadow-sm" />
            <button onClick={clearPendingImage} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-700 text-white flex items-center justify-center">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2 bg-white/60 backdrop-blur-xl border border-white/70 rounded-[24px] px-3 py-2 shadow-lg">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ""; }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || isLoadingHistory}
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-slate-400 hover:text-purple-500 hover:bg-purple-50 transition-colors disabled:opacity-40"
          >
            <Camera className="w-5 h-5" />
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu mensaje…"
            rows={1}
            disabled={isLoading || isLoadingHistory}
            className="flex-1 bg-transparent resize-none text-sm text-slate-800 placeholder-slate-400 outline-none py-1.5 max-h-32 overflow-y-auto disabled:opacity-60"
            style={{ lineHeight: "1.4" }}
          />
          <button
            onClick={sendMessage}
            disabled={!canSend}
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-md disabled:opacity-40 transition-opacity active:scale-95"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
