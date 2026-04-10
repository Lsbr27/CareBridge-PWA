"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, type PanInfo } from "motion/react";
import { Check, ChevronUp, ArrowRight } from "lucide-react";
import CubeLoader from "@/components/ui/cube-loader";

export function OnboardingPuzzleClean() {
  const router = useRouter();
  const [isConnected, setIsConnected] = useState(false);
  const [showButton, setShowButton] = useState(false);

  const handleSwipeUp = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    const swipeDistance = -info.offset.y;

    if (swipeDistance > 80 && !isConnected) {
      setIsConnected(true);
      window.setTimeout(() => {
        setShowButton(true);
      }, 500);
    }
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(103,232,249,0.16),_transparent_32%),radial-gradient(circle_at_bottom,_rgba(34,197,94,0.12),_transparent_30%),#ffffff] px-6">
      <div className="mx-auto flex min-h-screen w-full max-w-[425px] flex-col">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
          className="pb-10 pt-20"
        >
          <h1 className="text-center text-3xl font-light tracking-tight text-slate-900">
            CareMosaic
          </h1>
        </motion.div>

        <div className="flex flex-1 flex-col items-center justify-center">
          <motion.div
            className="mb-10 px-6 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
          >
            <AnimatePresence mode="wait">
              {!isConnected ? (
                <motion.div
                  key="before"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.35 }}
                >
                  <p className="mb-4 text-[30px] font-light leading-[1.15] tracking-tight text-slate-900">
                    Your care story starts
                    <br />
                    in one clear place.
                  </p>
                  <p className="mx-auto max-w-[320px] text-[15px] leading-7 text-slate-500">
                    Medications, daily symptoms, and appointments come together
                    in a calmer, simpler flow from day one.
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="after"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.35 }}
                >
                  <p className="mb-4 text-[30px] font-light leading-[1.15] tracking-tight text-slate-900">
                    Ready to organize
                    <br />
                    your next step.
                  </p>
                  <p className="mx-auto max-w-[320px] text-[15px] leading-7 text-slate-500">
                    Sign in to keep your timeline, reminders, and health notes
                    connected from the first appointment onward.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          <motion.div
            drag={!isConnected ? "y" : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.18}
            onDragEnd={handleSwipeUp}
            className="relative flex h-[420px] w-full items-center justify-center"
            style={{
              touchAction: "none",
              cursor: !isConnected ? "grab" : "default",
            }}
            whileTap={{ cursor: !isConnected ? "grabbing" : "default" }}
          >
            <AnimatePresence>
              <motion.div
                key={isConnected ? "connected-loader" : "idle-loader"}
                initial={{ opacity: 0, scale: 0.96, y: 16 }}
                animate={{
                  opacity: 1,
                  scale: isConnected ? 0.94 : 1,
                  y: isConnected ? -18 : 0,
                }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ duration: 0.55 }}
                className="relative z-10"
              >
                <CubeLoader
                  className="min-h-0 gap-8 rounded-[40px] border border-white/70 bg-white/55 px-10 py-12 shadow-[0_30px_80px_rgba(15,23,42,0.10)] backdrop-blur-2xl"
                  title={isConnected ? "Care flow aligned" : "Care pieces in motion"}
                  description={
                    isConnected
                      ? "Your medications, check-ins, and appointments are ready to move together."
                      : "CareMosaic brings your health routine into one calm, connected starting point."
                  }
                />
              </motion.div>
            </AnimatePresence>

            <AnimatePresence>
              {isConnected && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.6, y: 32 }}
                  animate={{ opacity: 1, scale: 1, y: 122 }}
                  transition={{
                    duration: 0.55,
                    delay: 0.15,
                    type: "spring",
                    stiffness: 180,
                    damping: 16,
                  }}
                  className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2"
                >
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[linear-gradient(145deg,#22c55e_0%,#14b8a6_100%)] shadow-[0_18px_40px_rgba(20,184,166,0.28)]">
                    <Check className="h-9 w-9 text-white" strokeWidth={3} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          <AnimatePresence>
            {!isConnected && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-4 flex flex-col items-center gap-3"
              >
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <ChevronUp className="h-8 w-8 text-slate-400" strokeWidth={1.75} />
                </motion.div>
                <p className="text-sm font-light tracking-tight text-slate-500">
                  Swipe up to continue
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="pb-20">
          <AnimatePresence>
            {showButton && (
              <motion.button
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.55,
                  type: "spring",
                  stiffness: 120,
                  damping: 15,
                }}
                onClick={() => router.push("/auth")}
                className="flex w-full items-center justify-center gap-3 overflow-hidden rounded-full bg-[linear-gradient(135deg,#06b6d4_0%,#22c55e_100%)] py-5 text-[17px] font-medium text-white shadow-[0_16px_40px_rgba(6,182,212,0.26)]"
              >
                <span>Start with Google</span>
                <ArrowRight className="h-5 w-5" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
