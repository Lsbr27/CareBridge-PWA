"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../providers/AuthProvider";

const PURPLE = "#6b21d6";
const BLOB = "#c4a4e8";
const BLOB_SHADOW = "#b898d4";
const DARK = "#3b1060";

// ── Ghost mascot (same as onboarding) ────────────────────────────────────────
function GhostCharacter() {
  return (
    <svg width="160" height="180" viewBox="0 0 145 165" fill="none">
      <path
        d="M16 78 C16 40 40 16 72 16 C104 16 128 40 128 78 L128 138
           C122 132 116 126 109 132 C102 138 95 132 88 138
           C81 144 74 138 67 144 C60 150 53 144 46 138
           C39 132 32 138 25 132 L16 132 Z"
        fill={BLOB}
      />
      <path
        d="M128 108 L128 138 C122 132 116 126 109 132 C102 138 95 132 88 138
           C81 144 74 138 67 144 C60 150 53 144 46 138
           C39 132 32 138 25 132 L16 132 L16 108 Z"
        fill={BLOB_SHADOW} opacity="0.45"
      />
      {/* Left eye */}
      <circle cx="54" cy="74" r="13" fill="white" />
      <circle cx="54" cy="74" r="8" fill={DARK} />
      {/* Right eye */}
      <circle cx="90" cy="74" r="13" fill="white" />
      <circle cx="90" cy="74" r="8" fill={DARK} />
      {/* Nose */}
      <circle cx="72" cy="87" r="3.5" fill={DARK} />
      {/* Smile */}
      <path d="M58 97 Q72 109 86 97" stroke={DARK} strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* Ground shadow */}
      <ellipse cx="72" cy="158" rx="30" ry="7" fill="#a87cc8" opacity="0.3" />
    </svg>
  );
}

// ── 4-point star ─────────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" fill="none">
      <path d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z" fill="#FFC107"/>
      <path d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" fill="#FF3D00"/>
      <path d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8H6.3C9.6 35.7 16.3 44 24 44z" fill="#4CAF50"/>
      <path d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.3 4.1-4.2 5.4l6.2 5.2C40 35.7 44 30.3 44 24c0-1.2-.1-2.4-.4-3.5z" fill="#1976D2"/>
    </svg>
  );
}

function Star({ size = 28, color = "#f59e0b" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill={color}>
      <path d="M20 0 L23 17 L40 20 L23 23 L20 40 L17 23 L0 20 L17 17 Z" />
    </svg>
  );
}

export function OnboardingCTA() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signInWithGoogle } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const next = searchParams.get("next");

  async function handleGoogleSignIn() {
    try {
      setIsSubmitting(true);
      await signInWithGoogle(next);
    } catch (error) {
      console.error("Google sign-in failed", error);
      setIsSubmitting(false);
      window.alert(
        "No pudimos iniciar sesión con Google. Revisa la configuración de Supabase."
      );
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-between bg-white px-6 py-12">
      <div className="w-full max-w-[390px] flex flex-col items-center flex-1">

        {/* ── Illustration area ── */}
        <div className="relative flex items-center justify-center mt-8 mb-2" style={{ width: 300, height: 280 }}>

          {/* Gold star top-left */}
          <motion.div
            className="absolute"
            style={{ top: "4%", left: "6%" }}
            animate={{ rotate: [0, 15, -10, 0], scale: [1, 1.15, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <Star size={26} color="#f59e0b" />
          </motion.div>

          {/* Gold star right */}
          <motion.div
            className="absolute"
            style={{ top: "30%", right: "2%" }}
            animate={{ rotate: [0, -12, 10, 0], scale: [1, 1.2, 1] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
          >
            <Star size={22} color="#f59e0b" />
          </motion.div>

          {/* Gold star bottom */}
          <motion.div
            className="absolute"
            style={{ bottom: "4%", left: "22%" }}
            animate={{ rotate: [0, 10, -8, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
          >
            <Star size={20} color="#f59e0b" />
          </motion.div>

          {/* Yellow dot (sun-like) top-center */}
          <motion.div
            className="absolute rounded-full"
            style={{ width: 22, height: 22, backgroundColor: "#fbbf24", top: "2%", left: "45%" }}
            animate={{ y: [0, -6, 0], scale: [1, 1.08, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
          />

          {/* Red/coral dot left */}
          <motion.div
            className="absolute rounded-full"
            style={{ width: 16, height: 16, backgroundColor: "#f87171", top: "52%", left: "3%" }}
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
          />

          {/* Mini planet (teal) right-bottom */}
          <motion.div
            className="absolute flex items-center justify-center"
            style={{ bottom: "18%", right: "8%" }}
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
          >
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="10" fill="#6ee7b7" />
              <ellipse cx="16" cy="16" rx="15" ry="5" stroke="#34d399" strokeWidth="2" fill="none" />
            </svg>
          </motion.div>

          {/* Cloud left */}
          <motion.div
            className="absolute"
            style={{ top: "38%", left: "0%" }}
            animate={{ x: [0, 5, 0], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          >
            <svg width="44" height="24" viewBox="0 0 44 24" fill="#dde6ff">
              <ellipse cx="22" cy="16" rx="20" ry="8" />
              <ellipse cx="15" cy="12" rx="10" ry="8" />
              <ellipse cx="28" cy="13" rx="9" ry="7" />
            </svg>
          </motion.div>

          {/* Cloud bottom-right */}
          <motion.div
            className="absolute"
            style={{ bottom: "10%", right: "14%" }}
            animate={{ x: [0, -4, 0], opacity: [0.5, 0.75, 0.5] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          >
            <svg width="36" height="18" viewBox="0 0 36 18" fill="#dde6ff">
              <ellipse cx="18" cy="12" rx="16" ry="6" />
              <ellipse cx="12" cy="9" rx="8" ry="6" />
              <ellipse cx="24" cy="10" rx="7" ry="5" />
            </svg>
          </motion.div>

          {/* Ghost — floats gently */}
          <motion.div
            animate={{ y: [0, -12, 0], rotate: [-1.5, 1.5, -1.5] }}
            transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
          >
            <GhostCharacter />
          </motion.div>
        </div>

        {/* ── Brand name ── */}
        <motion.p
          className="text-[22px] font-bold tracking-tight mb-4"
          style={{ color: PURPLE }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          CareMosaic
        </motion.p>

        {/* ── Copy ── */}
        <motion.div
          className="text-center px-2 mb-10"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <h1 className="text-[24px] font-bold text-gray-900 leading-snug mb-3">
            Llega preparado a tu próxima consulta
          </h1>
          <p className="text-[15px] text-gray-500 leading-relaxed">
            Tu salud no debería sentirse confusa.
            <br />
            CareMosaic organiza todo para ti.
          </p>
          {next && (
            <p className="mt-3 text-xs uppercase tracking-widest" style={{ color: PURPLE }}>
              Te llevamos de vuelta después del login
            </p>
          )}
        </motion.div>

        {/* ── Buttons ── */}
        <motion.div
          className="w-full space-y-3"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <button
            onClick={handleGoogleSignIn}
            disabled={isSubmitting}
            className="w-full py-[18px] rounded-2xl text-white text-[16px] font-semibold flex items-center justify-center gap-3 disabled:opacity-75 disabled:cursor-wait transition-opacity"
            style={{ backgroundColor: PURPLE }}
          >
            {isSubmitting ? (
              <LoaderCircle className="w-5 h-5 animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            Continuar con Google
          </button>

          <button
            onClick={() => router.push("/")}
            className="w-full py-[18px] rounded-2xl text-[16px] font-medium text-gray-500 transition-colors hover:text-gray-700"
            style={{ backgroundColor: "#f3effd" }}
          >
            Volver al inicio
          </button>
        </motion.div>

        {/* ── Terms ── */}
        <motion.p
          className="mt-8 text-center text-xs text-gray-400 leading-relaxed"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          Al continuar aceptas nuestros{" "}
          <span className="underline cursor-pointer">Términos de servicio</span>
          {" "}y{" "}
          <span className="underline cursor-pointer">Política de privacidad</span>
        </motion.p>
      </div>
    </div>
  );
}
