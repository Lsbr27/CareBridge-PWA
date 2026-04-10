import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Check } from "lucide-react";

interface PuzzlePiece {
  id: number;
  color: string;
  initialX: number;
  initialY: number;
  finalX: number;
  finalY: number;
  rotation: number;
  path: string;
}

const puzzlePieces: PuzzlePiece[] = [
  {
    id: 1,
    color: "from-cyan-300 to-cyan-400",
    initialX: -80,
    initialY: -60,
    finalX: -45,
    finalY: -45,
    rotation: -15,
    path: "M50,0 C77.6,0 100,22.4 100,50 L100,80 C100,93.8 88.8,105 75,105 L20,105 C6.2,105 -5,93.8 -5,80 L-5,50 C-5,22.4 17.4,0 45,0 L50,0 Z",
  },
  {
    id: 2,
    color: "from-pink-300 to-pink-400",
    initialX: 80,
    initialY: -50,
    finalX: 45,
    finalY: -45,
    rotation: 12,
    path: "M0,0 L55,0 C82.6,0 105,22.4 105,50 L105,80 C105,93.8 93.8,105 80,105 L25,105 C11.2,105 0,93.8 0,80 L0,50 C0,22.4 0,0 0,0 Z",
  },
  {
    id: 3,
    color: "from-amber-300 to-yellow-400",
    initialX: -75,
    initialY: 70,
    finalX: -45,
    finalY: 45,
    rotation: -10,
    path: "M-5,0 L50,0 C63.8,0 75,11.2 75,25 L75,75 C75,102.6 52.6,125 25,125 C-2.6,125 -25,102.6 -25,75 L-25,25 C-25,11.2 -13.8,0 0,0 L-5,0 Z",
  },
  {
    id: 4,
    color: "from-green-300 to-emerald-400",
    initialX: 85,
    initialY: 65,
    finalX: 45,
    finalY: 45,
    rotation: 18,
    path: "M0,0 L55,0 C68.8,0 80,11.2 80,25 L80,75 C80,102.6 57.6,125 30,125 C2.4,125 -20,102.6 -20,75 L-20,25 C-20,11.2 -8.8,0 5,0 L0,0 Z",
  },
];

export function OnboardingPuzzle() {
  const navigate = useNavigate();
  const [animationStage, setAnimationStage] = useState<"initial" | "connecting" | "completed">("initial");

  useEffect(() => {
    // Start connecting animation after 1.5 seconds
    const connectTimer = setTimeout(() => {
      setAnimationStage("connecting");
    }, 1500);

    // Complete animation after 3.5 seconds
    const completeTimer = setTimeout(() => {
      setAnimationStage("completed");
    }, 3500);

    return () => {
      clearTimeout(connectTimer);
      clearTimeout(completeTimer);
    };
  }, []);

  return (
    <div className="min-h-screen bg-transparent flex flex-col items-center justify-between p-6 overflow-hidden">
      <div className="w-full max-w-[425px] min-h-screen flex flex-col">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="pt-16 pb-8"
        >
          <h1 className="text-2xl font-light text-gray-800 text-center">CareMosaic</h1>
        </motion.div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          {/* Puzzle pieces container */}
          <div className="relative w-full h-[400px] flex items-center justify-center mb-16">
            <div className="relative w-[280px] h-[280px]">
              {/* Puzzle Pieces */}
              {puzzlePieces.map((piece) => (
                <motion.div
                  key={piece.id}
                  initial={{
                    x: piece.initialX,
                    y: piece.initialY,
                    rotate: piece.rotation,
                    opacity: 0,
                    scale: 0.8,
                  }}
                  animate={{
                    x: animationStage === "initial" ? piece.initialX : piece.finalX,
                    y: animationStage === "initial" ? piece.initialY : piece.finalY,
                    rotate: animationStage === "initial" ? piece.rotation : 0,
                    opacity: 1,
                    scale: 1,
                  }}
                  transition={{
                    opacity: { duration: 0.6, delay: piece.id * 0.1 },
                    scale: { duration: 0.6, delay: piece.id * 0.1 },
                    x: { duration: 1.2, delay: animationStage === "connecting" ? 0 : 0, ease: "easeInOut" },
                    y: { duration: 1.2, delay: animationStage === "connecting" ? 0 : 0, ease: "easeInOut" },
                    rotate: { duration: 1.2, delay: animationStage === "connecting" ? 0 : 0, ease: "easeInOut" },
                  }}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                  style={{
                    filter: animationStage === "completed" 
                      ? "drop-shadow(0 20px 40px rgba(139, 92, 246, 0.3))" 
                      : "drop-shadow(0 10px 20px rgba(0, 0, 0, 0.15))",
                  }}
                >
                  <div 
                    className={`w-[120px] h-[120px] rounded-[32px] bg-gradient-to-br ${piece.color}`}
                    style={{
                      boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1), inset 0 2px 8px rgba(255, 255, 255, 0.5)",
                    }}
                  />
                </motion.div>
              ))}

              {/* Checkmark - appears when completed */}
              <AnimatePresence>
                {animationStage === "completed" && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5, ease: "backOut" }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
                  >
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-300 to-emerald-400 flex items-center justify-center shadow-2xl shadow-green-400/40">
                      <Check className="w-10 h-10 text-white" strokeWidth={3} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Subtle glow effect when completed */}
              {animationStage === "completed" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-gradient-to-br from-purple-200/40 to-pink-200/40 blur-3xl -z-10"
                />
              )}
            </div>
          </div>

          {/* Text content */}
          <motion.div
            className="text-center space-y-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <AnimatePresence mode="wait">
              {animationStage !== "completed" ? (
                <motion.h2
                  key="initial-text"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.5 }}
                  className="text-2xl font-light text-gray-800 leading-relaxed"
                >
                  Every piece of patient data...
                </motion.h2>
              ) : (
                <motion.h2
                  key="final-text"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="text-3xl font-light text-gray-800 leading-relaxed"
                >
                  ...connected.
                </motion.h2>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Button - appears when completed */}
        <AnimatePresence>
          {animationStage === "completed" && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="pb-16"
            >
              <button
                onClick={() => navigate("/app")}
                className="w-full py-5 rounded-[20px] bg-gradient-to-r from-purple-400 to-pink-400 text-white text-lg font-medium shadow-xl shadow-purple-300/30 hover:shadow-2xl hover:shadow-purple-300/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
              >
                Get started
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 pb-8">
          <div className="w-2 h-2 rounded-full bg-purple-400"></div>
          <div className="w-2 h-2 rounded-full bg-gray-300"></div>
          <div className="w-2 h-2 rounded-full bg-gray-300"></div>
          <div className="w-2 h-2 rounded-full bg-gray-300"></div>
        </div>
      </div>
    </div>
  );
}
