"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";

type Phase = "splash" | "reveal" | "welcome";

const BG = "#dab6f7";
const BLOB = "#c4a4e8";
const DARK = "#3b1060";
const BLOB_SHADOW = "#b898d4";

// ── Splash face (floating eyes + nose + smile, no body) ──────────────────────
function SplashFace() {
  return (
    <motion.svg
      width="130" height="90" viewBox="0 0 130 90" fill="none"
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: "backOut" }}
    >
      <circle cx="40" cy="38" r="19" fill="white" />
      <circle cx="40" cy="38" r="12" fill={DARK} />
      <circle cx="90" cy="38" r="19" fill="white" />
      <circle cx="90" cy="38" r="12" fill={DARK} />
      <circle cx="65" cy="54" r="4.5" fill={DARK} />
      <path d="M47 65 Q65 78 83 65" stroke={DARK} strokeWidth="4" strokeLinecap="round" fill="none" />
    </motion.svg>
  );
}

// ── Ghost mascot ─────────────────────────────────────────────────────────────
function GhostCharacter() {
  return (
    <svg width="145" height="165" viewBox="0 0 145 165" fill="none">
      <path
        d="M16 78 C16 40 40 16 72 16 C104 16 128 40 128 78 L128 138
           C122 132 116 126 109 132 C102 138 95 132 88 138
           C81 144 74 138 67 144 C60 150 53 144 46 138
           C39 132 32 138 25 132 L16 132 Z"
        fill={BLOB}
      />
      <path
        d="M128 108 L128 138 C122 132 116 126 109 132 C102 138 95 132 88 138 C81 144 74 138 67 144 C60 150 53 144 46 138 C39 132 32 138 25 132 L16 132 L16 108 Z"
        fill={BLOB_SHADOW} opacity="0.45"
      />
      <circle cx="54" cy="74" r="13" fill="white" />
      <circle cx="54" cy="74" r="8" fill={DARK} />
      <circle cx="90" cy="74" r="13" fill="white" />
      <circle cx="90" cy="74" r="8" fill={DARK} />
      <circle cx="72" cy="87" r="3.5" fill={DARK} />
      <path d="M58 97 Q72 109 86 97" stroke={DARK} strokeWidth="3" strokeLinecap="round" fill="none" />
      <ellipse cx="72" cy="158" rx="30" ry="7" fill="#a87cc8" opacity="0.3" />
    </svg>
  );
}

// ── Small face for blob characters ───────────────────────────────────────────
function BlobFace({ size, wink = false }: { size: number; wink?: boolean }) {
  const e = size * 0.14;
  const p = size * 0.085;
  const lx = size * 0.335, rx = size * 0.665, ey = size * 0.43;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
      <circle cx={lx} cy={ey} r={e} fill="white" />
      <circle cx={lx} cy={ey} r={p} fill={DARK} />
      {wink ? (
        <path d={`M${rx - e} ${ey} Q${rx} ${ey + e * 0.6} ${rx + e} ${ey}`}
          stroke={DARK} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      ) : (
        <>
          <circle cx={rx} cy={ey} r={e} fill="white" />
          <circle cx={rx} cy={ey} r={p} fill={DARK} />
        </>
      )}
      <circle cx={size * 0.5} cy={size * 0.565} r={size * 0.032} fill={DARK} />
      <path
        d={`M${size * 0.37} ${size * 0.655} Q${size * 0.5} ${size * 0.735} ${size * 0.63} ${size * 0.655}`}
        stroke={DARK} strokeWidth={size * 0.028} strokeLinecap="round" fill="none"
      />
    </svg>
  );
}

// ── Accessories ───────────────────────────────────────────────────────────────
function StarAcc() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="#f59e0b">
      <path d="M11 1l2.5 7h7.5l-6 4.5 2.3 7-6.3-4.5L4.7 19.5 7 12.5 1 8h7.5z" />
    </svg>
  );
}
function GlassesAcc() {
  return (
    <svg width="38" height="18" viewBox="0 0 38 18" fill="none">
      <circle cx="10" cy="9" r="8" stroke="#888" strokeWidth="2.2" />
      <circle cx="28" cy="9" r="8" stroke="#888" strokeWidth="2.2" />
      <path d="M18 9 L20 9" stroke="#888" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M2 7 C1 5 0 4 0 4" stroke="#888" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function HeartAcc() {
  return (
    <svg width="20" height="18" viewBox="0 0 20 18" fill="#f87171">
      <path d="M10 16 C10 16 1 10 1 5 C1 2.5 3 1 5.5 1 C7 1 8.5 2 10 3.5 C11.5 2 13 1 14.5 1 C17 1 19 2.5 19 5 C19 10 10 16 10 16Z" />
    </svg>
  );
}
function SunglassesAcc() {
  return (
    <svg width="42" height="16" viewBox="0 0 42 16" fill="none">
      <rect x="1" y="4" width="16" height="10" rx="5" fill={DARK} opacity="0.85" />
      <rect x="25" y="4" width="16" height="10" rx="5" fill={DARK} opacity="0.85" />
      <path d="M17 9 L25 9" stroke={DARK} strokeWidth="2" opacity="0.85" />
      <path d="M1 8 C0 6 0 3 0 3" stroke={DARK} strokeWidth="1.5" opacity="0.6" />
    </svg>
  );
}
function MagnifierAcc() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <circle cx="12" cy="12" r="9" stroke="#4f46e5" strokeWidth="3" fill="white" />
      <circle cx="12" cy="12" r="5" fill="#4f46e5" opacity="0.25" />
      <path d="M19 19 L26 26" stroke="#3b1060" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ── Blob character (circle + face + accessory) ────────────────────────────────
function BlobChar({
  size = 80, wink = false, acc, delay = 0, style,
}: {
  size?: number; wink?: boolean; acc?: React.ReactNode; delay?: number;
  style?: React.CSSProperties;
}) {
  return (
    <motion.div
      className="absolute"
      style={{ width: size, height: size, ...style }}
      initial={{ opacity: 0, scale: 0, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: delay + 0.1, duration: 0.5, ease: "backOut" }}
    >
      <motion.div
        className="relative w-full h-full"
        animate={{ y: [0, -9, 0] }}
        transition={{ duration: 2.8 + delay * 0.4, repeat: Infinity, ease: "easeInOut", delay }}
      >
        <div
          className="absolute inset-0 rounded-full shadow-md"
          style={{ backgroundColor: BLOB }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <BlobFace size={size * 0.78} wink={wink} />
        </div>
        {acc && (
          <div className="absolute -top-2 -right-1 pointer-events-none">{acc}</div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ── Reveal phase: purple bg + white oval + ghost + loading bar ────────────────
function RevealScene({ progress }: { progress: number }) {
  return (
    <div className="relative w-full h-full flex items-center justify-center" style={{ backgroundColor: BG }}>
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.75, ease: [0.34, 1.56, 0.64, 1] }}
        style={{
          position: "absolute",
          width: 520, height: 470,
          borderRadius: "50%",
          backgroundColor: "white",
          left: "50%", top: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />
      <div className="relative z-10 flex flex-col items-center gap-5">
        <GhostCharacter />
        <div className="w-32 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#e5e7eb" }}>
          <motion.div
            className="h-full rounded-full"
            style={{ width: `${progress}%`, backgroundColor: "#d1d5db" }}
            transition={{ duration: 0.05 }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Welcome screen ────────────────────────────────────────────────────────────
function WelcomeScreen({ onCTA }: { onCTA: () => void }) {
  return (
    <div className="relative w-full h-full flex flex-col" style={{ backgroundColor: "white" }}>
      {/* Title */}
      <motion.div
        className="px-8 pt-14 pb-4 text-center"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
      >
        <h1 className="text-[28px] font-bold leading-snug text-gray-900">
          ¡Bienvenido/a! ¿Listo para cuidar tu salud?
        </h1>
      </motion.div>

      {/* Floating blobs area */}
      <div className="relative flex-1">
        {/* Blob with stethoscope */}
        <BlobChar size={82} acc={<StarAcc />} delay={0.05} style={{ top: "8%", left: "10%" }} />
        {/* Small floating dot */}
        <motion.div
          className="absolute rounded-full"
          style={{ width: 46, height: 46, backgroundColor: "#fb923c", top: "5%", left: "52%" }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1, y: [0, -8, 0] }}
          transition={{ delay: 0.1, duration: 0.4, y: { duration: 3, repeat: Infinity } }}
        />
        {/* Glasses blob */}
        <BlobChar size={88} acc={<GlassesAcc />} delay={0.1} style={{ top: "6%", right: "6%" }} />
        {/* Squiggle */}
        <motion.svg
          width="28" height="22" viewBox="0 0 28 22" fill="none"
          className="absolute"
          style={{ top: "38%", left: "7%" }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <path d="M2 11 C4 5 8 5 10 11 C12 17 16 17 18 11 C20 5 24 5 26 11"
            stroke={BLOB} strokeWidth="3.5" strokeLinecap="round" fill="none" />
        </motion.svg>
        {/* Wink blob (center) */}
        <BlobChar size={92} wink delay={0.15} style={{ top: "34%", left: "26%" }} />
        {/* Heart blob */}
        <BlobChar size={80} acc={<HeartAcc />} delay={0.2} style={{ top: "38%", right: "7%" }} />
        {/* Sunglasses blob */}
        <BlobChar size={78} acc={<SunglassesAcc />} delay={0.22} style={{ top: "62%", left: "5%" }} />
        {/* Magnifier blob */}
        <BlobChar size={92} acc={<MagnifierAcc />} delay={0.25} style={{ top: "60%", left: "30%" }} />
        {/* Small triangle */}
        <motion.svg
          width="38" height="38" viewBox="0 0 38 38" fill="none"
          className="absolute"
          style={{ top: "64%", right: "7%" }}
          initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, ease: "backOut" }}
        >
          <path d="M8 4 L34 19 L8 34 Z" fill="#67e8f9" />
        </motion.svg>
      </div>

      {/* CTA */}
      <motion.div
        className="px-6 pb-10"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.5, type: "spring", stiffness: 120, damping: 14 }}
      >
        <button
          onClick={onCTA}
          className="w-full py-5 rounded-2xl text-white text-[17px] font-semibold shadow-lg"
          style={{ backgroundColor: "#6b21d6" }}
        >
          ¡Sí, vamos!
        </button>
      </motion.div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function OnboardingPuzzleClean() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("splash");
  const [progress, setProgress] = useState(0);

  // splash → reveal after 1.8s
  useEffect(() => {
    const t = setTimeout(() => setPhase("reveal"), 1800);
    return () => clearTimeout(t);
  }, []);

  // fill loading bar during reveal
  useEffect(() => {
    if (phase !== "reveal") return;
    const iv = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(iv); return 100; }
        return p + 2;
      });
    }, 42);
    return () => clearInterval(iv);
  }, [phase]);

  // reveal → welcome when bar is full
  useEffect(() => {
    if (progress < 100) return;
    const t = setTimeout(() => setPhase("welcome"), 300);
    return () => clearTimeout(t);
  }, [progress]);

  return (
    <div
      className="relative mx-auto overflow-hidden"
      style={{ width: "100%", maxWidth: 425, height: "100dvh" }}
    >
      <AnimatePresence mode="wait">
        {phase === "splash" && (
          <motion.div
            key="splash"
            className="absolute inset-0 flex items-center justify-center"
            style={{ backgroundColor: BG }}
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            <SplashFace />
          </motion.div>
        )}

        {phase === "reveal" && (
          <motion.div
            key="reveal"
            className="absolute inset-0"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <RevealScene progress={progress} />
          </motion.div>
        )}

        {phase === "welcome" && (
          <motion.div
            key="welcome"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45 }}
          >
            <WelcomeScreen onCTA={() => router.push("/auth")} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
