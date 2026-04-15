"use client";

import { useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useMotionValue, useTransform, type PanInfo } from "motion/react";
import { Check, ChevronUp } from "lucide-react";

interface PuzzlePiece {
  id: number;
  color: string;
  colorDark: string;
  colorLight: string;
  initialX: number;
  initialY: number;
  initialRotate: number;
  stagger: number;
}

const puzzlePieces: PuzzlePiece[] = [
  {
    id: 1,
    color: "#5FD6E7",
    colorDark: "#4AB8C7",
    colorLight: "#7FE3F0",
    initialX: -95,
    initialY: -85,
    initialRotate: -5,
    stagger: 0,
  },
  {
    id: 2,
    color: "#FF6BAA",
    colorDark: "#E85590",
    colorLight: "#FF8BC0",
    initialX: 95,
    initialY: -80,
    initialRotate: 5,
    stagger: 0.05,
  },
  {
    id: 3,
    color: "#FFD84D",
    colorDark: "#E8C23D",
    colorLight: "#FFE380",
    initialX: -100,
    initialY: 90,
    initialRotate: -4,
    stagger: 0.08,
  },
  {
    id: 4,
    color: "#4BE3A1",
    colorDark: "#3BC88B",
    colorLight: "#6BEDB4",
    initialX: 100,
    initialY: 95,
    initialRotate: 4,
    stagger: 0.03,
  },
];

const finalPositions = [
  { x: -58, y: -58 }, // Top-left
  { x: 58, y: -58 },  // Top-right
  { x: -58, y: 58 },  // Bottom-left
  { x: 58, y: 58 },   // Bottom-right
];

export function OnboardingPuzzleSwipe() {
  const router = useRouter();
  const [isCompleted, setIsCompleted] = useState(false);
  const [hasSnapped, setHasSnapped] = useState(false);
  const swipeProgress = useMotionValue(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Transform progress for snap effect
  const snapProgress = useTransform(swipeProgress, (value) => {
    if (value >= 0.95 && !hasSnapped) {
      return 1;
    }
    return value;
  });

  // Create all transforms outside of map - MUST be called unconditionally
  const glowOpacity = useTransform(snapProgress, [0, 0.95, 1], [0, 0, 0.8]);
  const glowScale = useTransform(snapProgress, [0.95, 1], [0.9, 1.1]);
  const instructionOpacity = useTransform(snapProgress, [0, 0.3], [1, 0]);
  const instructionY = useTransform(snapProgress, [0, 0.3], [0, -10]);

  // Create transforms for all 4 pieces - MUST be called unconditionally
  const piece1X = useTransform(snapProgress, [0, 1], [puzzlePieces[0].initialX, finalPositions[0].x]);
  const piece1Y = useTransform(snapProgress, [0, 1], [puzzlePieces[0].initialY, finalPositions[0].y]);
  const piece1Rotate = useTransform(snapProgress, [0, 1], [puzzlePieces[0].initialRotate, 0]);

  const piece2X = useTransform(snapProgress, [0, 1], [puzzlePieces[1].initialX, finalPositions[1].x]);
  const piece2Y = useTransform(snapProgress, [0, 1], [puzzlePieces[1].initialY, finalPositions[1].y]);
  const piece2Rotate = useTransform(snapProgress, [0, 1], [puzzlePieces[1].initialRotate, 0]);

  const piece3X = useTransform(snapProgress, [0, 1], [puzzlePieces[2].initialX, finalPositions[2].x]);
  const piece3Y = useTransform(snapProgress, [0, 1], [puzzlePieces[2].initialY, finalPositions[2].y]);
  const piece3Rotate = useTransform(snapProgress, [0, 1], [puzzlePieces[2].initialRotate, 0]);

  const piece4X = useTransform(snapProgress, [0, 1], [puzzlePieces[3].initialX, finalPositions[3].x]);
  const piece4Y = useTransform(snapProgress, [0, 1], [puzzlePieces[3].initialY, finalPositions[3].y]);
  const piece4Rotate = useTransform(snapProgress, [0, 1], [puzzlePieces[3].initialRotate, 0]);

  const pieceScale = useTransform(snapProgress, [0, 1], [0.96, 1]);
  const pieceBlur = useTransform(snapProgress, [0, 0.6, 1], [2, 0.5, 0]);
  const blurFilter = useTransform(pieceBlur, (b) => `blur(${b}px)`);

  // Store transforms in array for easy access
  const pieceTransforms = useMemo(() => [
    { x: piece1X, y: piece1Y, rotate: piece1Rotate },
    { x: piece2X, y: piece2Y, rotate: piece2Rotate },
    { x: piece3X, y: piece3Y, rotate: piece3Rotate },
    { x: piece4X, y: piece4Y, rotate: piece4Rotate },
  ], [piece1X, piece1Y, piece1Rotate, piece2X, piece2Y, piece2Rotate, piece3X, piece3Y, piece3Rotate, piece4X, piece4Y, piece4Rotate]);

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const swipeDistance = -info.offset.y;
    const threshold = 120;

    if (swipeDistance > threshold && !isCompleted) {
      setHasSnapped(true);
      swipeProgress.set(1);
      setTimeout(() => {
        setIsCompleted(true);
      }, 600);
    } else {
      swipeProgress.set(0);
      setHasSnapped(false);
    }
  };

  const handleDrag = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (!isCompleted) {
      const swipeDistance = -info.offset.y;
      const maxDistance = 200;
      const progress = Math.min(Math.max(swipeDistance / maxDistance, 0), 1);
      
      if (progress < 0.95) {
        setHasSnapped(false);
        swipeProgress.set(progress);
      } else if (!hasSnapped) {
        setHasSnapped(true);
        swipeProgress.set(1);
        setTimeout(() => {
          setIsCompleted(true);
        }, 600);
      }
    }
  };

  return (
    <div className="min-h-screen bg-transparent flex flex-col items-center justify-between p-6 overflow-hidden select-none">
      <div className="w-full max-w-[425px] min-h-screen flex flex-col">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="pt-16 pb-8"
        >
          <h1 className="text-2xl font-light text-gray-800 text-center tracking-tight">CareMosaic</h1>
        </motion.div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          {/* Text content - top */}
          <motion.div
            className="text-center mb-20"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <AnimatePresence mode="wait">
              {!isCompleted ? (
                <motion.h2
                  key="initial-text"
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.5 }}
                  className="text-[26px] font-light text-gray-800 leading-relaxed tracking-tight"
                >
                  Every piece of patient data
                </motion.h2>
              ) : (
                <motion.h2
                  key="final-text"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="text-[26px] font-light text-gray-800 leading-relaxed tracking-tight"
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
            dragElastic={0.15}
            onDrag={handleDrag}
            onDragEnd={handleDragEnd}
            className="relative w-full h-[400px] flex items-center justify-center mb-12"
            style={{ 
              touchAction: "none",
              cursor: !isCompleted ? "grab" : "default",
            }}
            whileTap={{ cursor: !isCompleted ? "grabbing" : "default" }}
          >
            <div className="relative w-[340px] h-[340px]">
              {/* Subtle background glow - appears progressively */}
              <motion.div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] rounded-full bg-gradient-to-br from-emerald-100/40 via-cyan-100/30 to-pink-100/30 blur-3xl -z-10"
                style={{
                  opacity: glowOpacity,
                  scale: glowScale,
                }}
              />

              {/* Puzzle Pieces */}
              {puzzlePieces.map((piece, index) => {
                const transforms = pieceTransforms[index];

                return (
                  <motion.div
                    key={piece.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ 
                      opacity: 1, 
                      scale: 1,
                    }}
                    transition={{
                      opacity: { duration: 0.5, delay: index * 0.08 },
                      scale: { 
                        duration: 0.5, 
                        delay: index * 0.08,
                        type: "spring",
                        stiffness: 200,
                      },
                    }}
                    style={{
                      x: transforms.x,
                      y: transforms.y,
                      rotate: transforms.rotate,
                      scale: pieceScale,
                      filter: blurFilter,
                    }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                  >
                    <motion.div
                      animate={
                        hasSnapped
                          ? {
                              scale: [1, 1.05, 1],
                            }
                          : {}
                      }
                      transition={{
                        duration: 0.4,
                        delay: index * 0.03,
                        type: "spring",
                        stiffness: 300,
                      }}
                    >
                      <Puzzle3DPiece
                        id={piece.id}
                        color={piece.color}
                        colorDark={piece.colorDark}
                        colorLight={piece.colorLight}
                      />
                    </motion.div>
                  </motion.div>
                );
              })}

              {/* Center checkmark badge - appears when snapped */}
              <AnimatePresence>
                {hasSnapped && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                      duration: 0.5,
                      delay: 0.3,
                      type: "spring",
                      stiffness: 200,
                      damping: 15,
                    }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30"
                  >
                    <motion.div
                      animate={{
                        scale: [1, 1.08, 1],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      className="w-32 h-32 rounded-full flex items-center justify-center relative"
                      style={{
                        background: "linear-gradient(145deg, #4BE3A1 0%, #3BC88B 100%)",
                        boxShadow:
                          "0 16px 48px rgba(75, 227, 161, 0.35), inset 0 4px 16px rgba(255, 255, 255, 0.4), inset 0 -4px 16px rgba(0, 0, 0, 0.12)",
                      }}
                    >
                      {/* Top shine */}
                      <div
                        className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-1/3 rounded-full"
                        style={{
                          background:
                            "linear-gradient(180deg, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0) 100%)",
                          filter: "blur(10px)",
                        }}
                      />
                      <motion.div
                        initial={{ scale: 0, rotate: -90 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{
                          duration: 0.5,
                          delay: 0.5,
                          type: "spring",
                          stiffness: 200,
                        }}
                      >
                        <Check className="w-16 h-16 text-white relative z-10" strokeWidth={2.5} />
                      </motion.div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Swipe instruction - fades out as user swipes */}
          <motion.div
            className="flex flex-col items-center gap-3"
            style={{
              opacity: instructionOpacity,
              y: instructionY,
            }}
          >
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ 
                duration: 1.8, 
                repeat: Infinity, 
                ease: "easeInOut",
                repeatDelay: 0.2,
              }}
            >
              <ChevronUp className="w-7 h-7 text-gray-400" strokeWidth={2} />
            </motion.div>
            <p className="text-sm font-light text-gray-400 tracking-tight">Swipe up to connect</p>
          </motion.div>
        </div>

        {/* Button - appears when completed */}
        <AnimatePresence>
          {isCompleted && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ 
                duration: 0.7, 
                delay: 0.5,
                type: "spring",
                stiffness: 100,
                damping: 15,
              }}
              className="pb-16"
            >
              <motion.button
                onClick={() => router.push("/app")}
                className="w-full py-5 rounded-full text-white text-[17px] font-medium relative overflow-hidden active:scale-[0.98] transition-transform"
                style={{
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  boxShadow: "0 8px 24px rgba(102, 126, 234, 0.25), 0 2px 8px rgba(0, 0, 0, 0.1)",
                }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="relative z-10 tracking-tight">Get started</span>
                {/* Subtle shimmer effect */}
                <motion.div
                  className="absolute inset-0"
                  animate={{
                    x: ["-100%", "100%"],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    repeatDelay: 1,
                    ease: "easeInOut",
                  }}
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)",
                  }}
                />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 pb-8">
          <motion.div 
            className="w-2 h-2 rounded-full bg-purple-400"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <div className="w-2 h-2 rounded-full bg-gray-300"></div>
          <div className="w-2 h-2 rounded-full bg-gray-300"></div>
          <div className="w-2 h-2 rounded-full bg-gray-300"></div>
          <div className="w-2 h-2 rounded-full bg-gray-300"></div>
        </div>
      </div>
    </div>
  );
}

// Premium 3D Puzzle Piece Component with realistic interlocking shapes
function Puzzle3DPiece({
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
  // Authentic puzzle piece shapes with tabs and blanks
  const getPuzzleShape = (pieceId: number) => {
    const tabRadius = 15;
    const blankRadius = 15;
    
    switch (pieceId) {
      case 1: // Top-left: tab on right, blank on bottom
        return {
          main: `
            M 15,15 
            L 95,15 
            L 95,48 
            Q ${95 + tabRadius},${48 + tabRadius} ${95 + tabRadius},${48 + tabRadius * 2}
            Q ${95 + tabRadius},${48 + tabRadius * 3} 95,${48 + tabRadius * 4}
            L 95,110 
            L ${48 + blankRadius * 4},110
            Q ${48 + blankRadius * 3},${110 + blankRadius} ${48 + blankRadius * 2},${110 + blankRadius}
            Q ${48 + blankRadius},${110 + blankRadius} ${48},110
            L 15,110 
            L 15,15 
            Z
          `,
          thickness: `
            M 95,15 L 100,18 
            L 100,51 
            Q ${100 + tabRadius},${51 + tabRadius} ${100 + tabRadius},${51 + tabRadius * 2}
            Q ${100 + tabRadius},${51 + tabRadius * 3} 100,${51 + tabRadius * 4}
            L 100,113 L 95,110 
            L 95,${48 + tabRadius * 4}
            Q ${95 + tabRadius},${48 + tabRadius * 3} ${95 + tabRadius},${48 + tabRadius * 2}
            Q ${95 + tabRadius},${48 + tabRadius} 95,48
            L 95,15 Z
          `,
        };
      case 2: // Top-right: blank on left, tab on bottom
        return {
          main: `
            M 15,15 
            L 110,15 
            L 110,110 
            L ${63 + blankRadius * 4},110
            Q ${63 + blankRadius * 3},${110 + blankRadius} ${63 + blankRadius * 2},${110 + blankRadius}
            Q ${63 + blankRadius},${110 + blankRadius} 63,110
            L 15,110 
            L 15,${48 + tabRadius * 4}
            Q ${15 - tabRadius},${48 + tabRadius * 3} ${15 - tabRadius},${48 + tabRadius * 2}
            Q ${15 - tabRadius},${48 + tabRadius} 15,48
            L 15,15 
            Z
          `,
          thickness: `
            M 110,15 L 115,18 L 115,113 L 110,110 L 110,15 Z
          `,
        };
      case 3: // Bottom-left: blank on top, tab on right
        return {
          main: `
            M 15,15
            Q ${15},${15 - blankRadius} ${15 + blankRadius},${15 - blankRadius}
            Q ${15 + blankRadius * 2},${15 - blankRadius} ${15 + blankRadius * 2},15
            L ${48 + blankRadius * 2},15
            Q ${48 + blankRadius * 3},${15 - blankRadius} ${48 + blankRadius * 4},${15 - blankRadius}
            Q ${48 + blankRadius * 5},${15 - blankRadius} ${48 + blankRadius * 5},15
            L 95,15 
            L 95,48 
            Q ${95 + tabRadius},${48 + tabRadius} ${95 + tabRadius},${48 + tabRadius * 2}
            Q ${95 + tabRadius},${48 + tabRadius * 3} 95,${48 + tabRadius * 4}
            L 95,110 
            L 15,110 
            L 15,15 
            Z
          `,
          thickness: `
            M 95,15 L 100,18 
            L 100,51 
            Q ${100 + tabRadius},${51 + tabRadius} ${100 + tabRadius},${51 + tabRadius * 2}
            Q ${100 + tabRadius},${51 + tabRadius * 3} 100,${51 + tabRadius * 4}
            L 100,113 L 95,110 
            L 95,${48 + tabRadius * 4}
            Q ${95 + tabRadius},${48 + tabRadius * 3} ${95 + tabRadius},${48 + tabRadius * 2}
            Q ${95 + tabRadius},${48 + tabRadius} 95,48
            L 95,15 Z
          `,
        };
      case 4: // Bottom-right: tab on top, blank on left
        return {
          main: `
            M 15,15
            L ${48},15
            Q ${48 + blankRadius},${15 - blankRadius} ${48 + blankRadius * 2},${15 - blankRadius}
            Q ${48 + blankRadius * 3},${15 - blankRadius} ${48 + blankRadius * 4},15
            L 110,15 
            L 110,110 
            L 15,110 
            L 15,${48 + tabRadius * 4}
            Q ${15 - tabRadius},${48 + tabRadius * 3} ${15 - tabRadius},${48 + tabRadius * 2}
            Q ${15 - tabRadius},${48 + tabRadius} 15,48
            L 15,15 
            Z
          `,
          thickness: `
            M 110,15 L 115,18 L 115,113 L 110,110 L 110,15 Z
          `,
        };
      default:
        return {
          main: "M 15,15 L 110,15 L 110,110 L 15,110 Z",
          thickness: "M 110,15 L 115,18 L 115,113 L 110,110 Z",
        };
    }
  };

  const shapes = getPuzzleShape(id);

  return (
    <div
      className="relative w-[125px] h-[140px]"
      style={{
        filter: "drop-shadow(0 12px 32px rgba(0, 0, 0, 0.12))",
      }}
    >
      <svg width="125" height="140" viewBox="0 0 125 140" className="w-full h-full">
        <defs>
          {/* Main face gradient - realistic top light */}
          <linearGradient id={`grad-main-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={colorLight} stopOpacity="1" />
            <stop offset="25%" stopColor="white" stopOpacity="0.3" />
            <stop offset="50%" stopColor={color} stopOpacity="1" />
            <stop offset="100%" stopColor={color} stopOpacity="1" />
          </linearGradient>

          {/* Thickness/side gradient */}
          <linearGradient id={`grad-side-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={colorDark} stopOpacity="1" />
            <stop offset="100%" stopColor={colorDark} stopOpacity="0.85" />
          </linearGradient>

          {/* Top highlight gradient */}
          <radialGradient id={`grad-highlight-${id}`} cx="50%" cy="20%">
            <stop offset="0%" stopColor="white" stopOpacity="0.5" />
            <stop offset="70%" stopColor="white" stopOpacity="0" />
          </radialGradient>

          {/* Soft inner shadow */}
          <filter id={`inner-shadow-${id}`}>
            <feGaussianBlur in="SourceAlpha" stdDeviation="2.5" />
            <feOffset dx="0" dy="3" result="offsetblur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.2" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Thickness/depth layer - creates 3D effect */}
        <path
          d={shapes.thickness}
          fill={`url(#grad-side-${id})`}
          opacity="0.95"
        />

        {/* Main face with inner shadow */}
        <path
          d={shapes.main}
          fill={`url(#grad-main-${id})`}
          filter={`url(#inner-shadow-${id})`}
        />

        {/* Top highlight for realism */}
        <path
          d={shapes.main}
          fill={`url(#grad-highlight-${id})`}
          opacity="0.5"
          style={{ mixBlendMode: "overlay" }}
        />

        {/* Subtle edge highlight */}
        <path
          d={shapes.main}
          fill="none"
          stroke="white"
          strokeWidth="1.5"
          opacity="0.3"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
