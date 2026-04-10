import { useState, useRef } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence, useMotionValue, useTransform, type PanInfo } from "motion/react";
import { Check, ChevronUp } from "lucide-react";

interface PuzzlePiece {
  id: number;
  color: string;
  colorDark: string;
  initialX: number;
  initialY: number;
  initialRotate: number;
  finalX: number;
  finalY: number;
  finalRotate: number;
}

const puzzlePieces: PuzzlePiece[] = [
  {
    id: 1,
    color: "#5FD6E7",
    colorDark: "#4AB8C7",
    initialX: -110,
    initialY: -90,
    initialRotate: -12,
    finalX: -55,
    finalY: -55,
    finalRotate: 0,
  },
  {
    id: 2,
    color: "#FF6BAA",
    colorDark: "#E85590",
    initialX: 110,
    initialY: -85,
    initialRotate: 15,
    finalX: 55,
    finalY: -55,
    finalRotate: 0,
  },
  {
    id: 3,
    color: "#FFD84D",
    colorDark: "#E8C23D",
    initialX: -115,
    initialY: 95,
    initialRotate: -15,
    finalX: -55,
    finalY: 55,
    finalRotate: 0,
  },
  {
    id: 4,
    color: "#4BE3A1",
    colorDark: "#3BC88B",
    initialX: 115,
    initialY: 100,
    initialRotate: 18,
    finalX: 55,
    finalY: 55,
    finalRotate: 0,
  },
];

export function OnboardingPuzzleInteractive() {
  const navigate = useNavigate();
  const [isCompleted, setIsCompleted] = useState(false);
  const [hasStartedSwipe, setHasStartedSwipe] = useState(false);
  const swipeProgress = useMotionValue(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const swipeDistance = -info.offset.y;
    const threshold = 100;

    if (swipeDistance > threshold && !isCompleted) {
      // Complete the animation
      swipeProgress.set(1);
      setTimeout(() => {
        setIsCompleted(true);
      }, 800);
    } else {
      // Reset if didn't meet threshold
      swipeProgress.set(0);
      setHasStartedSwipe(false);
    }
  };

  const handleDrag = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (!isCompleted) {
      setHasStartedSwipe(true);
      const swipeDistance = -info.offset.y;
      const maxDistance = 150;
      const progress = Math.min(Math.max(swipeDistance / maxDistance, 0), 1);
      swipeProgress.set(progress);
    }
  };

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
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <AnimatePresence mode="wait">
              {!isCompleted ? (
                <motion.h2
                  key="initial-text"
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.4 }}
                  className="text-2xl font-light text-gray-700 leading-relaxed"
                >
                  Every piece of patient data
                </motion.h2>
              ) : (
                <motion.h2
                  key="final-text"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  className="text-2xl font-light text-gray-700 leading-relaxed"
                >
                  ...comes together.
                </motion.h2>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Puzzle pieces container - draggable */}
          <motion.div
            ref={containerRef}
            drag={!isCompleted ? "y" : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDrag={handleDrag}
            onDragEnd={handleDragEnd}
            className="relative w-full h-[380px] flex items-center justify-center mb-8 cursor-grab active:cursor-grabbing"
            style={{ touchAction: "none" }}
          >
            <div className="relative w-[320px] h-[320px]">
              {/* Subtle background glow when completed */}
              <AnimatePresence>
                {isCompleted && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 0.6, scale: 1.1 }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-gradient-to-br from-emerald-200/50 via-cyan-200/30 to-pink-200/40 blur-3xl -z-10"
                  />
                )}
              </AnimatePresence>

              {/* Puzzle Pieces */}
              {puzzlePieces.map((piece, index) => {
                const xPos = useTransform(
                  swipeProgress,
                  [0, 1],
                  [piece.initialX, piece.finalX]
                );
                const yPos = useTransform(
                  swipeProgress,
                  [0, 1],
                  [piece.initialY, piece.finalY]
                );
                const rotation = useTransform(
                  swipeProgress,
                  [0, 1],
                  [piece.initialRotate, piece.finalRotate]
                );

                return (
                  <motion.div
                    key={piece.id}
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ 
                      opacity: 1, 
                      scale: isCompleted ? 1 : [0.7, 1],
                    }}
                    transition={{
                      opacity: { duration: 0.6, delay: index * 0.1 },
                      scale: { 
                        duration: isCompleted ? 0.5 : 0.6, 
                        delay: index * 0.1,
                        type: isCompleted ? "spring" : "tween",
                        bounce: 0.4,
                      },
                    }}
                    style={{
                      x: xPos,
                      y: yPos,
                      rotate: rotation,
                    }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                  >
                    <Puzzle3DPiece
                      id={piece.id}
                      color={piece.color}
                      colorDark={piece.colorDark}
                      isCompleted={isCompleted}
                    />
                  </motion.div>
                );
              })}

              {/* Center checkmark badge - appears when completed */}
              <AnimatePresence>
                {isCompleted && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0, rotate: -90 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    transition={{
                      duration: 0.7,
                      delay: 0.4,
                      type: "spring",
                      bounce: 0.5,
                    }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30"
                  >
                    <div
                      className="w-28 h-28 rounded-full flex items-center justify-center relative"
                      style={{
                        background: "linear-gradient(145deg, #5BE3A8 0%, #3BC88B 100%)",
                        boxShadow:
                          "0 12px 40px rgba(75, 227, 161, 0.4), inset 0 3px 12px rgba(255, 255, 255, 0.5), inset 0 -3px 12px rgba(0, 0, 0, 0.15)",
                      }}
                    >
                      {/* Top highlight for 3D effect */}
                      <div
                        className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-1/3 rounded-full"
                        style={{
                          background:
                            "linear-gradient(180deg, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 255, 0) 100%)",
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

          {/* Swipe instruction - only show if not started and not completed */}
          <AnimatePresence>
            {!hasStartedSwipe && !isCompleted && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col items-center gap-2"
              >
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  <ChevronUp className="w-8 h-8 text-gray-400" strokeWidth={2} />
                </motion.div>
                <p className="text-sm font-light text-gray-400">Swipe up to connect</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Button - appears when completed */}
        <AnimatePresence>
          {isCompleted && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.8, type: "spring", bounce: 0.3 }}
              className="pb-16"
            >
              <button
                onClick={() => navigate("/app")}
                className="w-full py-5 rounded-full text-white text-lg font-medium relative overflow-hidden group"
                style={{
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  boxShadow: "0 12px 32px rgba(102, 126, 234, 0.3)",
                }}
              >
                <span className="relative z-10">Get started</span>
                {/* Hover shine effect */}
                <motion.div
                  className="absolute inset-0"
                  initial={{ x: "-100%" }}
                  whileHover={{ x: "100%" }}
                  transition={{ duration: 0.6 }}
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent)",
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

// 3D Puzzle Piece Component with realistic depth and lighting
function Puzzle3DPiece({
  id,
  color,
  colorDark,
  isCompleted,
}: {
  id: number;
  color: string;
  colorDark: string;
  isCompleted: boolean;
}) {
  // Different puzzle shapes for each piece with tabs and blanks
  const getPuzzleShape = (pieceId: number) => {
    switch (pieceId) {
      case 1: // Top-left: tab right, blank bottom
        return {
          main: "M 15,15 L 90,15 L 90,45 Q 105,45 105,60 Q 105,75 90,75 L 90,105 L 45,105 Q 45,90 30,90 Q 15,90 15,105 L 15,15 Z",
          side: "M 90,15 L 95,18 L 95,48 Q 110,48 110,63 Q 110,78 95,78 L 95,108 L 90,105 L 90,75 Q 105,75 105,60 Q 105,45 90,45 L 90,15 Z",
        };
      case 2: // Top-right: blank left, tab bottom
        return {
          main: "M 15,15 L 105,15 L 105,105 L 60,105 Q 60,120 45,120 Q 30,120 30,105 L 15,105 L 15,75 Q 30,75 30,60 Q 30,45 15,45 L 15,15 Z",
          side: "M 105,15 L 110,18 L 110,108 L 105,105 L 105,15 Z",
        };
      case 3: // Bottom-left: blank top, tab right
        return {
          main: "M 15,15 Q 15,30 30,30 Q 45,30 45,15 L 90,15 L 90,45 Q 105,45 105,60 Q 105,75 90,75 L 90,105 L 15,105 L 15,15 Z",
          side: "M 90,15 L 95,18 L 95,48 Q 110,48 110,63 Q 110,78 95,78 L 95,108 L 90,105 L 90,75 Q 105,75 105,60 Q 105,45 90,45 L 90,15 Z",
        };
      case 4: // Bottom-right: tab top, blank left
        return {
          main: "M 15,15 L 45,15 Q 45,30 60,30 Q 75,30 75,15 L 105,15 L 105,105 L 15,105 L 15,75 Q 30,75 30,60 Q 30,45 15,45 L 15,15 Z",
          side: "M 105,15 L 110,18 L 110,108 L 105,105 L 105,15 Z",
        };
      default:
        return {
          main: "M 15,15 L 105,15 L 105,105 L 15,105 Z",
          side: "M 105,15 L 110,18 L 110,108 L 105,105 Z",
        };
    }
  };

  const shapes = getPuzzleShape(id);

  return (
    <div
      className="relative w-[120px] h-[135px]"
      style={{
        filter: isCompleted
          ? "drop-shadow(0 20px 40px rgba(0, 0, 0, 0.08))"
          : "drop-shadow(0 16px 32px rgba(0, 0, 0, 0.15))",
      }}
    >
      <svg width="120" height="135" viewBox="0 0 120 135" className="w-full h-full">
        <defs>
          {/* Main face gradient - top light */}
          <linearGradient id={`grad-main-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="white" stopOpacity="0.6" />
            <stop offset="40%" stopColor={color} stopOpacity="1" />
            <stop offset="100%" stopColor={color} stopOpacity="1" />
          </linearGradient>

          {/* Side/thickness gradient - darker */}
          <linearGradient id={`grad-side-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={colorDark} stopOpacity="1" />
            <stop offset="100%" stopColor={colorDark} stopOpacity="0.8" />
          </linearGradient>

          {/* Soft shadow filter */}
          <filter id={`shadow-${id}`}>
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
            <feOffset dx="0" dy="4" result="offsetblur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.2" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Inner shadow for depth */}
          <filter id={`inner-${id}`}>
            <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
            <feOffset dx="0" dy="3" result="offsetblur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.25" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Bottom layer - side/thickness (for 3D effect) */}
        <path
          d={shapes.side}
          fill={`url(#grad-side-${id})`}
          opacity="0.9"
        />

        {/* Main face */}
        <path
          d={shapes.main}
          fill={`url(#grad-main-${id})`}
          filter={`url(#inner-${id})`}
        />

        {/* Top highlight for realism */}
        <path
          d={shapes.main}
          fill="url(#top-highlight)"
          opacity="0.4"
          style={{ mixBlendMode: "overlay" }}
        />

        {/* Gradient for top highlight */}
        <defs>
          <linearGradient id="top-highlight" x1="0%" y1="0%" x2="0%" y2="60%">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
