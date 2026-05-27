"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { GlassCard } from "../../components/GlassCard";

type AnalyzeResponse = {
  ok: boolean;
  studyType: "laboratorio" | "imagen";
  overall: {
    label: "Estable" | "Seguimiento leve" | "Revisión sugerida" | "Prioritario";
    tone: "stable" | "mild" | "review" | "priority";
    score: number;
    summary: string;
  };
  quickStats: {
    totalRead: number;
    outOfRange: number;
    inRange: number;
  };
  keyFindings: Array<{
    title: string;
    status: "stable" | "mild" | "review" | "priority";
    note: string;
    action: string;
  }>;
  detailSections: Array<{
    title: string;
    items: Array<{
      name: string;
      value: string;
      status: "low" | "normal" | "high" | "unknown";
      position: number | null;
    }>;
  }>;
  trends: Array<{
    label: string;
    value: string;
    direction: "up" | "down" | "flat";
    note: string;
  }>;
  recommendations: string[];
  followUp: {
    timing: string;
    focus: string[];
  };
  patientSummary: string[];
  findings: string[];
  actionPlan: string[];
  questionsForDoctor: string[];
  extractedTextPreview: string;
  disclaimer: string;
};

const TONE_STYLES = {
  stable: {
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  mild: {
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
  },
  review: {
    badge: "bg-orange-50 text-orange-700 border-orange-200",
    dot: "bg-orange-500",
  },
  priority: {
    badge: "bg-rose-50 text-rose-700 border-rose-200",
    dot: "bg-rose-500",
  },
};

const LAB_STATUS_STYLE = {
  low: "bg-amber-50 text-amber-700 border-amber-200",
  normal: "bg-emerald-50 text-emerald-700 border-emerald-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  unknown: "bg-slate-100 text-slate-600 border-slate-200",
};

export function LabsScreen() {
  const [reportText, setReportText] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);

  function onPickPdf(file: File | null) {
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("Solo se permiten archivos PDF.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setError("El PDF es muy grande. Máximo 12MB.");
      return;
    }
    setError(null);
    setPdfFile(file);
  }

  async function analyze() {
    if (!pdfFile) {
      setError("Primero carga un PDF de laboratorio.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", pdfFile);
      if (reportText.trim()) {
        formData.append("notes", reportText.trim());
      }

      const res = await fetch("/api/labs/analyze", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "No se pudo analizar el laboratorio.");
        return;
      }

      setResult(data as AnalyzeResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado analizando laboratorio.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 pt-8 pb-28 space-y-5">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
        <h1 className="text-2xl font-semibold text-[#3b1060]">CareGuide Laboratorios</h1>
        <p className="text-sm text-gray-500">Resumen clínico claro, priorizado y fácil de escanear.</p>
      </motion.div>

      <GlassCard className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">1) Cargar PDF del laboratorio</label>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => onPickPdf(e.target.files?.[0] ?? null)}
            className="w-full rounded-xl border border-gray-200 bg-white/80 px-3 py-2 text-sm"
          />
          {pdfFile && <p className="text-xs text-gray-500">Archivo: {pdfFile.name}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">2) Observaciones opcionales</label>
          <textarea
            value={reportText}
            onChange={(e) => setReportText(e.target.value)}
            placeholder="Ej: síntomas, indicación de tu dermatóloga o dudas puntuales"
            className="w-full min-h-24 rounded-xl border border-gray-200 bg-white/80 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-300"
          />
        </div>

        <button
          onClick={analyze}
          disabled={loading || !pdfFile}
          className="w-full rounded-xl bg-[#0f766e] px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Leyendo tu PDF..." : "Explícame mis resultados"}
        </button>
      </GlassCard>

      {error && <GlassCard className="border border-rose-200 bg-rose-50/70 text-sm text-rose-700">{error}</GlassCard>}

      {result && (
        <GlassCard className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white/90 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Estado General</p>
                <h2 className="text-xl font-semibold text-[#2f1b4a]">{result.overall.label}</h2>
                <div className="mt-1">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                    Tipo de estudio: {result.studyType === "imagen" ? "Imagen diagnóstica" : "Laboratorio"}
                  </span>
                </div>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-medium ${TONE_STYLES[result.overall.tone].badge}`}>
                {result.overall.score}/100
              </span>
            </div>
            <p className="text-sm text-gray-700">{result.overall.summary}</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-2">
                <p className="text-[10px] text-gray-500">Leídos</p>
                <p className="text-sm font-semibold text-gray-800">{result.quickStats.totalRead}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-2">
                <p className="text-[10px] text-gray-500">Fuera de rango</p>
                <p className="text-sm font-semibold text-gray-800">{result.quickStats.outOfRange}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-2">
                <p className="text-[10px] text-gray-500">En rango</p>
                <p className="text-sm font-semibold text-gray-800">{result.quickStats.inRange}</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-gray-500">Hallazgos importantes</p>
            <div className="space-y-2">
              {result.keyFindings.map((finding, index) => (
                <div key={`kf-${index}`} className="rounded-xl border border-gray-200 bg-white/85 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">{finding.title}</p>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${TONE_STYLES[finding.status].badge}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${TONE_STYLES[finding.status].dot}`} />
                      {finding.status === "stable" ? "Estable" : finding.status === "mild" ? "Leve" : finding.status === "review" ? "Revisar" : "Prioritario"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-700">{finding.note}</p>
                  <p className="mt-2 text-xs text-gray-500">{finding.action}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-gray-500">Detalle expandible</p>
            {result.detailSections.map((section, index) => (
              <details key={`section-${index}`} className="rounded-xl border border-gray-200 bg-white/85 p-3">
                <summary className="cursor-pointer text-sm font-medium text-gray-800">{section.title}</summary>
                <div className="mt-3 space-y-2">
                  {section.items.map((item, itemIndex) => (
                    <div key={`item-${itemIndex}`} className="rounded-lg border border-gray-100 bg-gray-50/70 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-gray-800">{item.name}</p>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] ${LAB_STATUS_STYLE[item.status]}`}>
                          {item.status === "normal" ? "Rango" : item.status === "high" ? "Alto" : item.status === "low" ? "Bajo" : "Confirmar"}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{item.value}</p>
                      {item.position !== null && (
                        <div className="mt-2">
                          <div className="h-1.5 w-full rounded-full bg-slate-200">
                            <div className="h-1.5 rounded-full bg-[#6b46c1]" style={{ width: `${item.position}%` }} />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white/85 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Tendencias</p>
            <div className="grid grid-cols-1 gap-2">
              {result.trends.map((trend, index) => (
                <div key={`trend-${index}`} className="rounded-lg border border-gray-100 bg-gray-50/70 p-2 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-800">{trend.label}</p>
                    <p className="text-[11px] text-gray-500">{trend.note}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-800">{trend.value}</p>
                    <p className="text-[11px] text-gray-500">{trend.direction === "flat" ? "→" : trend.direction === "up" ? "↑" : "↓"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white/85 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Recomendaciones</p>
            <ul className="space-y-2 text-sm text-gray-800">
              {result.recommendations.map((item, index) => (
                <li key={`rec-${index}`} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#6b46c1]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3">
            <p className="text-xs uppercase tracking-wide text-violet-700 mb-2">Seguimiento</p>
            <p className="text-sm text-violet-900">{result.followUp.timing}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {result.followUp.focus.map((f, idx) => (
                <span key={`focus-${idx}`} className="rounded-full border border-violet-200 bg-white/80 px-2 py-1 text-[11px] text-violet-700">{f}</span>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-3">
            <p className="text-xs text-purple-700 mb-2 font-medium">Preguntas para mi doctora</p>
            <ul className="space-y-2 text-sm text-purple-900 list-disc pl-4">
              {result.questionsForDoctor.map((question, index) => (
                <li key={`question-${index}`}>{question}</li>
              ))}
            </ul>
          </div>

          <details className="rounded-xl border border-gray-200 bg-white/80 p-3">
            <summary className="cursor-pointer text-sm font-medium text-gray-700">Notas clínicas rápidas</summary>
            <ul className="mt-2 space-y-2 text-sm text-gray-700 list-disc pl-4">
              {result.findings.map((item, index) => (
                <li key={`finding-${index}`}>{item}</li>
              ))}
            </ul>
          </details>

          <p className="text-xs text-gray-500">{result.disclaimer}</p>
        </GlassCard>
      )}
    </div>
  );
}
