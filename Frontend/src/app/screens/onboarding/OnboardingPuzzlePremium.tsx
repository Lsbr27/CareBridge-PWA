import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Check } from "lucide-react";

interface PuzzlePiece {
  id: number;
  color: string;
  initialX: number;
  initialY: number;
  initialRotate: number;
  finalX: number;
  finalY: number;
  finalRotate: number;
  svgPath: string;
}

// Creating 4 unique puzzle pieces with real interlocking connectors
const puzzlePieces: PuzzlePiece[] = [
  {
    id: 1,
    color: "#5FD6E7", // Blue - top left
    initialX: -100,
    initialY: -80,
    initialRotate: -8,
    finalX: -52,
    finalY: -52,
    finalRotate: 2,
    // Top-left piece: tab on right, blank on bottom
    svgPath: `
      M 10,10
      L 80,10
      L 80,40
      Q 95,40 95,55
      Q 95,70 80,70
      L 80,100
      L 40,100
      Q 40,85 25,85
      Q 10,85 10,100
      L 10,10
      Z
    `,
  },
  {
    id: 2,
    color: "#FF6BAA", // Pink - top right
    initialX: 95,
    initialY: -75,
    initialRotate: 12,
    finalX: 52,
    finalY: -52,
    finalRotate: -3,
    // Top-right piece: blank on left, tab on bottom
    svgPath: `
      M 10,10
      L 100,10
      L 100,100
      L 60,100
      Q 60,115 45,115
      Q 30,115 30,100
      L 10,100
      L 10,70
      Q 25,70 25,55
      Q 25,40 10,40
      L 10,10
      Z
    `,
  },
  {
    id: 3,
    color: "#FFD84D", // Yellow - bottom left
    initialX: -105,
    initialY: 85,
    initialRotate: -10,
    finalX: -52,
    finalY: 52,
    finalRotate: 3,
    // Bottom-left piece: blank on top, tab on right
    svgPath: `
      M 10,10
      Q 10,25 25,25
      Q 40,25 40,10
      L 80,10
      L 80,40
      Q 95,40 95,55
      Q 95,70 80,70
      L 80,100
      L 10,100
      L 10,10
      Z
    `,
  },
  {
    id: 4,
    color: "#4BE3A1", // Green - bottom right
    initialX: 100,
    initialY: 90,
    initialRotate: 15,
    finalX: 52,
    finalY: 52,
    finalRotate: -2,
    // Bottom-right piece: tab on top, blank on left
    svgPath: `
      M 10,10
      L 40,10
      Q 40,25 55,25
      Q 70,25 70,10
      L 100,10
      L 100,100
      L 10,100
      L 10,70
      Q 25,70 25,55
      Q 25,40 10,40
      L 10,10
      Z
    `,
  },
];

export function OnboardingPuzzlePremium() {
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
    }, 3800);

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
          {/* Text content - top */}
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <h2 className="text-2xl font-light text-gray-700 leading-relaxed">
              Every piece of patient data
            </h2>
          </motion.div>

          {/* Puzzle pieces container */}
          <div className="relative w-full h-[340px] flex items-center justify-center mb-12">
            <div className="relative w-[280px] h-[280px]">
              {/* Subtle background glow when completed */}
              <AnimatePresence>
                {animationStage === "completed" && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 0.5, scale: 1 }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] rounded-full bg-gradient-to-br from-emerald-200/60 via-cyan-200/40 to-pink-200/40 blur-3xl -z-10"
                  />
                )}
              </AnimatePresence>

              {/* Puzzle Pieces */}
              {puzzlePieces.map((piece, index) => (
                <motion.div
                  key={piece.id}
                  initial={{
                    x: piece.initialX,
                    y: piece.initialY,
                    rotate: piece.initialRotate,
                    opacity: 0,
                    scale: 0.7,
                  }}
                  animate={{
                    x: animationStage === "initial" ? piece.initialX : piece.finalX,
                    y: animationStage === "initial" ? piece.initialY : piece.finalY,
                    rotate: animationStage === "initial" ? piece.initialRotate : piece.finalRotate,
                    opacity: 1,
                    scale: 1,
                  }}
                  transition={{
                    opacity: { duration: 0.5, delay: index * 0.08 },
                    scale: { duration: 0.5, delay: index * 0.08 },
                    x: { 
                      duration: 1.4, 
                      delay: animationStage === "connecting" ? index * 0.05 : 0, 
                      ease: [0.34, 1.56, 0.64, 1] // Gentle bounce
                    },
                    y: { 
                      duration: 1.4, 
                      delay: animationStage === "connecting" ? index * 0.05 : 0, 
                      ease: [0.34, 1.56, 0.64, 1]
                    },
                    rotate: { 
                      duration: 1.4, 
                      delay: animationStage === "connecting" ? index * 0.05 : 0, 
                      ease: "easeInOut" 
                    },
                  }}
                  className="absolute top-1/2 left-1/2"
                  style={{
                    filter: animationStage === "completed" 
                      ? "drop-shadow(0 20px 40px rgba(0, 0, 0, 0.08))" 
                      : "drop-shadow(0 12px 24px rgba(0, 0, 0, 0.12))",
                  }}
                >
                  <svg
                    width="110"
                    height="110"
                    viewBox="0 0 110 110"
                    className="w-[110px] h-[110px] -translate-x-1/2 -translate-y-1/2"
                  >
                    <defs>
                      {/* Gradient for top light effect */}
                      <linearGradient id={`gradient-${piece.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="white" stopOpacity="0.4" />
                        <stop offset="50%" stopColor={piece.color} stopOpacity="0.95" />
                        <stop offset="100%" stopColor={piece.color} stopOpacity="1" />
                      </linearGradient>
                      
                      {/* Inner shadow filter */}
                      <filter id={`inner-shadow-${piece.id}`}>
                        <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
                        <feOffset dx="0" dy="2" result="offsetblur" />
                        <feComponentTransfer>
                          <feFuncA type="linear" slope="0.3" />
                        </feComponentTransfer>
                        <feMerge>
                          <feMergeNode />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>
                    
                    {/* Main puzzle piece shape */}
                    <path
                      d={piece.svgPath}
                      fill={`url(#gradient-${piece.id})`}
                      filter={`url(#inner-shadow-${piece.id})`}
                      style={{
                        filter: "drop-shadow(0 2px 8px rgba(0, 0, 0, 0.06))",
                      }}
                    />
                    
                    {/* Subtle highlight on top edge */}
                    <path
                      d={piece.svgPath}
                      fill="white"
                      opacity="0.3"
                      style={{
                        mixBlendMode: "overlay",
                      }}
                    />
                  </svg>
                </motion.div>
              ))}

              {/* Center checkmark badge - appears when completed */}
              <AnimatePresence>
                {animationStage === "completed" && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0, rotate: -180 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    transition={{ 
                      duration: 0.6, 
                      delay: 0.2,
                      ease: [0.34, 1.56, 0.64, 1] // Bouncy
                    }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
                  >
                    <div 
                      className="w-24 h-24 rounded-full flex items-center justify-center relative"
                      style={{
                        background: "linear-gradient(135deg, #4BE3A1 0%, #3DD68C 100%)",
                        boxShadow: "0 8px 32px rgba(75, 227, 161, 0.35), inset 0 2px 8px rgba(255, 255, 255, 0.4), inset 0 -2px 8px rgba(0, 0, 0, 0.1)",
                      }}
                    >
                      {/* Glassy overlay */}
                      <div 
                        className="absolute inset-0 rounded-full"
                        style={{
                          background: "linear-gradient(135deg, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0) 60%)",
                        }}
                      />
                      <Check className="w-12 h-12 text-white relative z-10" strokeWidth={3} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Text content - bottom */}
          <motion.div
            className="text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
          >
            <AnimatePresence mode="wait">
              {animationStage === "completed" && (
                <motion.h2
                  key="final-text"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                  className="text-2xl font-light text-gray-700 leading-relaxed"
                >
                  ...comes together.
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
              transition={{ duration: 0.6, delay: 0.6 }}
              className="pb-16"
            >
              <button
                onClick={() => navigate("/app")}
                className="w-full py-5 rounded-full text-white text-lg font-medium relative overflow-hidden group"
                style={{
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  boxShadow: "0 8px 24px rgba(102, 126, 234, 0.25)",
                }}
              >
                <span className="relative z-10">Get started</span>
                {/* Hover glow effect */}
                <div 
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{
                    background: "linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0) 100%)",
                  }}
                />
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
          <div className="w-2 h-2 rounded-full bg-gray-300"></div>
        </div>
      </div>
    </div>
  );
}
