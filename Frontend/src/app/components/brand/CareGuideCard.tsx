import type { ReactNode } from "react";
import { GhostMascot } from "./GhostMascot";

type CareGuideTone = "default" | "meds" | "daily" | "appointments" | "insights";

type CareGuideCardProps = {
  title: string;
  message: string;
  tone?: CareGuideTone;
  mood?: "happy" | "calm" | "celebrate";
  action?: ReactNode;
  className?: string;
};

const TONE_STYLES: Record<
  CareGuideTone,
  { panel: string; eyebrow: string; accent: string; mark: string }
> = {
  default: {
    panel: "from-[#efe8ff] via-[#f7f2ff] to-[#fff1f7]",
    eyebrow: "text-[#6b21d6]",
    accent: "bg-[#6b21d6]",
    mark: "bg-[#ff8a5c]",
  },
  meds: {
    panel: "from-[#ece6ff] via-[#f7f4ff] to-[#e8fbff]",
    eyebrow: "text-cyan-700",
    accent: "bg-cyan-500",
    mark: "bg-[#6b21d6]",
  },
  daily: {
    panel: "from-[#f0e8ff] via-[#fff7fb] to-[#ffe8ea]",
    eyebrow: "text-rose-700",
    accent: "bg-rose-400",
    mark: "bg-[#6b21d6]",
  },
  appointments: {
    panel: "from-[#ede7ff] via-[#f7f4ff] to-[#eaf2ff]",
    eyebrow: "text-blue-700",
    accent: "bg-blue-500",
    mark: "bg-[#ff8a5c]",
  },
  insights: {
    panel: "from-[#eee7ff] via-[#fff9ef] to-[#fff2c6]",
    eyebrow: "text-amber-700",
    accent: "bg-amber-400",
    mark: "bg-[#6b21d6]",
  },
};

export function CareGuideCard({
  title,
  message,
  tone = "default",
  mood = "happy",
  action,
  className = "",
}: CareGuideCardProps) {
  const styles = TONE_STYLES[tone];

  return (
    <section
      className={`relative overflow-hidden rounded-[32px] border border-white/80 bg-gradient-to-br ${styles.panel} p-5 shadow-[0_22px_50px_rgba(102,72,166,0.14)] ${className}`}
    >
      <svg
        className="pointer-events-none absolute right-3 top-4 opacity-70"
        width="92"
        height="42"
        viewBox="0 0 92 42"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M8 26 C16 12 30 12 38 25 C45 5 70 8 76 26 C84 27 89 31 89 36 L5 36 C5 32 6 29 8 26Z"
          fill="white"
          opacity="0.74"
        />
      </svg>
      <div className={`pointer-events-none absolute left-6 top-5 h-3 w-3 rotate-45 ${styles.mark}`} />
      <div className={`pointer-events-none absolute bottom-7 right-7 h-4 w-4 rounded-full ${styles.accent}`} />
      <div className="pointer-events-none absolute bottom-4 left-28 h-2 w-16 rounded-full bg-white/70" />

      <div className="relative z-10 grid grid-cols-[92px_1fr] gap-4">
        <div className="relative flex min-h-28 items-center justify-center">
          <div className="absolute bottom-3 h-5 w-20 rounded-full bg-white/65" />
          <GhostMascot size="md" mood={mood} className="relative z-10 drop-shadow-[0_16px_18px_rgba(77,44,138,0.16)]" />
        </div>
        <div className="min-w-0 self-center pr-1">
          <p className={`text-[11px] font-semibold uppercase tracking-[0.28em] ${styles.eyebrow}`}>
            Tu guia CareMosaic
          </p>
          <h2 className="mt-2 max-w-[16ch] text-[1.55rem] font-semibold leading-[1.04] tracking-[-0.03em] text-slate-950">
            {title}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
          {action && <div className="mt-3">{action}</div>}
        </div>
      </div>
    </section>
  );
}
