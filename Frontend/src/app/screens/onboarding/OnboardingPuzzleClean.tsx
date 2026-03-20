import { useState } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence, type PanInfo } from "motion/react";
import { Check, ChevronUp } from "lucide-react";

interface PuzzlePiece {
  id: number;
  color: string;
  colorDark: string;
  colorLight: string;
  separatedX: number;
  separatedY: number;
  separatedRotate: number;
  connectedX: number;
  connectedY: number;
}

const puzzlePieces: PuzzlePiece[] = [
  {
    id: 1,
    color: "#5FD6E7",
    colorDark: "#4AB8C7",
    colorLight: "#7FE3F0",
    separatedX: -110,
    separatedY: -95,
    separatedRotate: -5,
    connectedX: -60,
    connectedY: -60,
  },
  {
    id: 2,
    color: "#FF6BAA",
    colorDark: "#E85590",
    colorLight: "#FF8BC0",
    separatedX: 110,
    separatedY: -90,
    separatedRotate: 5,
    connectedX: 60,
    connectedY: -60,
  },
  {
    id: 3,
    color: "#FFD84D",
    colorDark: "#E8C23D",
    colorLight: "#FFE380",
    separatedX: -115,
    separatedY: 100,
    separatedRotate: -5,
    connectedX: -60,
    connectedY: 60,
  },
  {
    id: 4,
    color: "#4BE3A1",
    colorDark: "#3BC88B",
    colorLight: "#6LEDB4",
    separatedX: 115,
    separatedY: 105,
    separatedRotate: 5,
    connectedX: 60,
    connectedY: 60,
  },
];

export function OnboardingPuzzleClean() {
  const navigate = useNavigate();
  const [isConnected, setIsConnected] = useState(false);
  const [showButton, setShowButton] = useState(false);

  const handleSwipeUp = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const swipeDistance = -info.offset.y;
    
    // Trigger connection if user swipes up at least 80px
    if (swipeDistance > 80 && !isConnected) {
      setIsConnected(true);
      // Show button after pieces connect
      setTimeout(() => {
        setShowButton(true);
      }, 800);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center p-6 overflow-hidden">
      <div className="w-full max-w-[425px] min-h-screen flex flex-col">
        {/* Logo/Brand */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
          className="pt-20 pb-12"
        >
          <h1 className="text-3xl font-light text-gray-900 text-center tracking-tight">
            CareMosaic
          </h1>
        </motion.div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col items-center justify-center">
          {/* Title Text */}
          <motion.div
            className="text-center mb-24 px-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <AnimatePresence mode="wait">
              {!isConnected ? (
                <motion.h2
                  key="separated"
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4 }}
                  className="text-[28px] font-light text-gray-800 leading-tight tracking-tight"
                >
                  Every piece of patient data
                </motion.h2>
              ) : (
                <motion.h2
                  key="connected"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  className="text-[28px] font-light text-gray-800 leading-tight tracking-tight"
                >
                  ...comes together.
                </motion.h2>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Puzzle Container - Draggable */}
          <motion.div
            drag={!isConnected ? "y" : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={handleSwipeUp}
            className="relative w-full h-[420px] flex items-center justify-center"
            style={{
              touchAction: "none",
              cursor: !isConnected ? "grab" : "default",
            }}
            whileTap={{ cursor: !isConnected ? "grabbing" : "default" }}
          >
            <div className="relative w-[360px] h-[360px]">
              {/* Background Glow - appears when connected */}
              <AnimatePresence>
                {isConnected && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 0.5, scale: 1.2 }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] rounded-full bg-gradient-to-br from-emerald-200/40 via-cyan-200/30 to-pink-200/30 blur-3xl -z-10"
                  />
                )}
              </AnimatePresence>

              {/* Puzzle Pieces */}
              {puzzlePieces.map((piece, index) => {
                // Different timing for each piece to create unique paths
                const timingVariations = [
                  { delay: 0.05, stiffness: 130, damping: 20, duration: 0.65 }, // Piece 1: fast & bouncy
                  { delay: 0.15, stiffness: 110, damping: 16, duration: 0.75 }, // Piece 2: slower, softer
                  { delay: 0.10, stiffness: 125, damping: 19, duration: 0.70 }, // Piece 3: medium
                  { delay: 0.08, stiffness: 115, damping: 17, duration: 0.72 }, // Piece 4: slightly different
                ];
                const timing = timingVariations[index];

                return (
                  <motion.div
                    key={piece.id}
                    initial={{ 
                      opacity: 0, 
                      scale: 0.7,
                    }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                      x: isConnected ? piece.connectedX : piece.separatedX,
                      y: isConnected ? piece.connectedY : piece.separatedY,
                      rotate: isConnected ? 0 : piece.separatedRotate,
                    }}
                    transition={{
                      opacity: { duration: 0.5, delay: index * 0.1 },
                      scale: { duration: 0.5, delay: index * 0.1, type: "spring", stiffness: 150 },
                      x: { duration: timing.duration, delay: timing.delay, type: "spring", stiffness: timing.stiffness, damping: timing.damping },
                      y: { duration: timing.duration, delay: timing.delay, type: "spring", stiffness: timing.stiffness, damping: timing.damping },
                      rotate: { duration: timing.duration, delay: timing.delay, ease: [0.25, 0.1, 0.25, 1] },
                    }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                  >
                    <GlossyPuzzlePiece
                      id={piece.id}
                      color={piece.color}
                      colorDark={piece.colorDark}
                      colorLight={piece.colorLight}
                    />
                  </motion.div>
                );
              })}

              {/* Checkmark Badge - appears when connected */}
              <AnimatePresence>
                {isConnected && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0, rotate: -180 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    transition={{
                      duration: 0.6,
                      delay: 0.5,
                      type: "spring",
                      stiffness: 180,
                      damping: 12,
                    }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
                  >
                    <div
                      className="w-28 h-28 rounded-full flex items-center justify-center relative"
                      style={{
                        background: "linear-gradient(145deg, #4BE3A1 0%, #3BC88B 100%)",
                        boxShadow:
                          "0 20px 50px rgba(75, 227, 161, 0.4), inset 0 4px 12px rgba(255, 255, 255, 0.5), inset 0 -4px 12px rgba(0, 0, 0, 0.15)",
                      }}
                    >
                      {/* Top shine for glossy effect */}
                      <div
                        className="absolute top-2 left-1/2 -translate-x-1/2 w-3/4 h-1/3 rounded-full"
                        style={{
                          background:
                            "linear-gradient(180deg, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0) 100%)",
                          filter: "blur(8px)",
                        }}
                      />
                      <Check className="w-14 h-14 text-white relative z-10" strokeWidth={3} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Swipe Instruction - only show when separated */}
          <AnimatePresence>
            {!isConnected && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col items-center gap-3 mt-8"
              >
                <motion.div
                  animate={{ y: [0, -12, 0] }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <ChevronUp className="w-8 h-8 text-gray-400" strokeWidth={2} />
                </motion.div>
                <p className="text-sm font-light text-gray-500 tracking-tight">
                  Swipe up to connect
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Button - appears after connection */}
        <div className="pb-20">
          <AnimatePresence>
            {showButton && (
              <motion.button
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.6,
                  type: "spring",
                  stiffness: 120,
                  damping: 15,
                }}
                onClick={() => navigate("/app")}
                className="w-full py-5 rounded-full text-white text-[17px] font-medium relative overflow-hidden"
                style={{
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  boxShadow:
                    "0 12px 32px rgba(102, 126, 234, 0.3), 0 4px 12px rgba(0, 0, 0, 0.08)",
                }}
              >
                <span className="relative z-10">Get started</span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Progress Dots */}
        <div className="flex justify-center gap-2 pb-8">
          <div className="w-2 h-2 rounded-full bg-purple-500"></div>
          <div className="w-2 h-2 rounded-full bg-gray-300"></div>
          <div className="w-2 h-2 rounded-full bg-gray-300"></div>
          <div className="w-2 h-2 rounded-full bg-gray-300"></div>
          <div className="w-2 h-2 rounded-full bg-gray-300"></div>
        </div>
      </div>
    </div>
  );
}

// Glossy 3D Puzzle Piece Component
function GlossyPuzzlePiece({
  id,
  color,
  colorDark,
  colorLight,
}: {
  id: number;
  color: string;
  colorDark: string;
  colorLight: string;
}) {
  // PRECISE interlocking puzzle pieces - mathematically calculated for perfect fit
  // All pieces are 120x120 base with 25-unit radius connectors
  const getPuzzleShape = (pieceId: number) => {
    const baseSize = 120;
    const tabSize = 25; // Radius of the circular connector
    const tabCenter = baseSize / 2; // Center point for tabs/blanks
    
    switch (pieceId) {
      case 1: // Top-left: TAB on RIGHT, BLANK on BOTTOM
        return {
          main: `
            M 0,0
            L ${baseSize},0
            L ${baseSize},${tabCenter - tabSize}
            A ${tabSize},${tabSize} 0 0 1 ${baseSize + tabSize},${tabCenter}
            A ${tabSize},${tabSize} 0 0 1 ${baseSize},${tabCenter + tabSize}
            L ${baseSize},${baseSize}
            L ${tabCenter + tabSize},${baseSize}
            A ${tabSize},${tabSize} 0 0 0 ${tabCenter},${baseSize + tabSize}
            A ${tabSize},${tabSize} 0 0 0 ${tabCenter - tabSize},${baseSize}
            L 0,${baseSize}
            Z
          `,
          side: `
            M ${baseSize},0
            L ${baseSize + 5},3
            L ${baseSize + 5},${tabCenter - tabSize}
            A ${tabSize},${tabSize} 0 0 1 ${baseSize + tabSize + 5},${tabCenter}
            A ${tabSize},${tabSize} 0 0 1 ${baseSize + 5},${tabCenter + tabSize}
            L ${baseSize + 5},${baseSize + 3}
            L ${baseSize},${baseSize}
            L ${baseSize},${tabCenter + tabSize}
            A ${tabSize},${tabSize} 0 0 0 ${baseSize + tabSize},${tabCenter}
            A ${tabSize},${tabSize} 0 0 0 ${baseSize},${tabCenter - tabSize}
            Z
          `,
        };
      
      case 2: // Top-right: BLANK on LEFT, TAB on BOTTOM
        return {
          main: `
            M 0,0
            L ${baseSize},0
            L ${baseSize},${baseSize}
            L ${tabCenter + tabSize},${baseSize}
            A ${tabSize},${tabSize} 0 0 1 ${tabCenter},${baseSize + tabSize}
            A ${tabSize},${tabSize} 0 0 1 ${tabCenter - tabSize},${baseSize}
            L 0,${baseSize}
            L 0,${tabCenter + tabSize}
            A ${tabSize},${tabSize} 0 0 0 -${tabSize},${tabCenter}
            A ${tabSize},${tabSize} 0 0 0 0,${tabCenter - tabSize}
            Z
          `,
          side: `
            M ${baseSize},0
            L ${baseSize + 5},3
            L ${baseSize + 5},${baseSize + 3}
            L ${baseSize},${baseSize}
            Z
          `,
        };
      
      case 3: // Bottom-left: BLANK on TOP, TAB on RIGHT
        return {
          main: `
            M 0,0
            L ${tabCenter - tabSize},0
            A ${tabSize},${tabSize} 0 0 0 ${tabCenter},-${tabSize}
            A ${tabSize},${tabSize} 0 0 0 ${tabCenter + tabSize},0
            L ${baseSize},0
            L ${baseSize},${tabCenter - tabSize}
            A ${tabSize},${tabSize} 0 0 1 ${baseSize + tabSize},${tabCenter}
            A ${tabSize},${tabSize} 0 0 1 ${baseSize},${tabCenter + tabSize}
            L ${baseSize},${baseSize}
            L 0,${baseSize}
            Z
          `,
          side: `
            M ${baseSize},0
            L ${baseSize + 5},3
            L ${baseSize + 5},${tabCenter - tabSize}
            A ${tabSize},${tabSize} 0 0 1 ${baseSize + tabSize + 5},${tabCenter}
            A ${tabSize},${tabSize} 0 0 1 ${baseSize + 5},${tabCenter + tabSize}
            L ${baseSize + 5},${baseSize + 3}
            L ${baseSize},${baseSize}
            L ${baseSize},${tabCenter + tabSize}
            A ${tabSize},${tabSize} 0 0 0 ${baseSize + tabSize},${tabCenter}
            A ${tabSize},${tabSize} 0 0 0 ${baseSize},${tabCenter - tabSize}
            Z
          `,
        };
      
      case 4: // Bottom-right: BLANK on TOP, BLANK on LEFT
        return {
          main: `
            M 0,0
            L ${tabCenter - tabSize},0
            A ${tabSize},${tabSize} 0 0 1 ${tabCenter},-${tabSize}
            A ${tabSize},${tabSize} 0 0 1 ${tabCenter + tabSize},0
            L ${baseSize},0
            L ${baseSize},${baseSize}
            L 0,${baseSize}
            L 0,${tabCenter + tabSize}
            A ${tabSize},${tabSize} 0 0 0 -${tabSize},${tabCenter}
            A ${tabSize},${tabSize} 0 0 0 0,${tabCenter - tabSize}
            Z
          `,
          side: `
            M ${baseSize},0
            L ${baseSize + 5},3
            L ${baseSize + 5},${baseSize + 3}
            L ${baseSize},${baseSize}
            Z
          `,
        };
      
      default:
        return {
          main: `M 0,0 L ${baseSize},0 L ${baseSize},${baseSize} L 0,${baseSize} Z`,
          side: `M ${baseSize},0 L ${baseSize + 5},3 L ${baseSize + 5},${baseSize + 3} L ${baseSize},${baseSize} Z`,
        };
    }
  };

  const shapes = getPuzzleShape(id);

  return (
    <div
      className="relative w-[145px] h-[145px]"
      style={{
        filter: "drop-shadow(0 12px 32px rgba(0, 0, 0, 0.18))",
      }}
    >
      <svg width="145" height="145" viewBox="-25 -25 170 170" className="w-full h-full">
        <defs>
          {/* Enhanced gradient - stronger 3D effect with top-to-bottom shading */}
          <linearGradient id={`main-grad-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={colorLight} stopOpacity="1" />
            <stop offset="15%" stopColor="white" stopOpacity="0.5" />
            <stop offset="50%" stopColor={color} stopOpacity="1" />
            <stop offset="100%" stopColor={colorDark} stopOpacity="1" />
          </linearGradient>

          {/* Side/depth gradient - darker for thickness */}
          <linearGradient id={`side-grad-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={colorDark} stopOpacity="1" />
            <stop offset="100%" stopColor={colorDark} stopOpacity="0.85" />
          </linearGradient>

          {/* Top glossy highlight - softer and more diffused */}
          <radialGradient id={`gloss-${id}`} cx="50%" cy="20%">
            <stop offset="0%" stopColor="white" stopOpacity="0.8" />
            <stop offset="50%" stopColor="white" stopOpacity="0.2" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>

          {/* Inner shadow for depth */}
          <filter id={`inner-shadow-${id}`}>
            <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
            <feOffset dx="0" dy="3" result="offsetblur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.3" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Side/thickness layer - creates 3D depth */}
        <path 
          d={shapes.side} 
          fill={`url(#side-grad-${id})`} 
          opacity="1" 
        />

        {/* Main face with gradient and inner shadow */}
        <path 
          d={shapes.main} 
          fill={`url(#main-grad-${id})`} 
          filter={`url(#inner-shadow-${id})`}
        />

        {/* Glossy top highlight overlay */}
        <path
          d={shapes.main}
          fill={`url(#gloss-${id})`}
          opacity="0.7"
          style={{ mixBlendMode: "overlay" }}
        />

        {/* Edge highlight for smoothness */}
        <path
          d={shapes.main}
          fill="none"
          stroke="white"
          strokeWidth="1.5"
          opacity="0.4"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}