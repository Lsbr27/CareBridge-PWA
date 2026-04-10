'use client'

import { cn } from "@/lib/utils";
import React from 'react'

type CubeLoaderProps = {
  className?: string;
  title?: string;
  description?: string;
};

export default function CubeLoader({
  className,
  title = "Care Sync",
  description = "Gathering medications, symptoms, and appointments into one view.",
}: CubeLoaderProps) {
  return (
    <div
      className={cn(
        "flex min-h-[400px] flex-col items-center justify-center gap-10 bg-slate-950/0 p-8 perspective-container",
        className,
      )}
    >
      <div className='relative flex h-24 w-24 items-center justify-center preserve-3d'>
        <div className='relative h-full w-full preserve-3d animate-cube-spin'>
          <div className='absolute inset-0 m-auto h-8 w-8 animate-pulse-fast rounded-full bg-white blur-md shadow-[0_0_40px_rgba(255,255,255,0.8)]' />

          <div className='side-wrapper front'>
            <div className='face border-2 border-cyan-400 bg-cyan-500/10 shadow-[0_0_15px_rgba(34,211,238,0.4)]' />
          </div>

          <div className='side-wrapper back'>
            <div className='face border-2 border-cyan-400 bg-cyan-500/10 shadow-[0_0_15px_rgba(34,211,238,0.4)]' />
          </div>

          <div className='side-wrapper right'>
            <div className='face border-2 border-purple-400 bg-purple-500/10 shadow-[0_0_15px_rgba(168,85,247,0.4)]' />
          </div>

          <div className='side-wrapper left'>
            <div className='face border-2 border-purple-400 bg-purple-500/10 shadow-[0_0_15px_rgba(168,85,247,0.4)]' />
          </div>

          <div className='side-wrapper top'>
            <div className='face border-2 border-indigo-400 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.4)]' />
          </div>

          <div className='side-wrapper bottom'>
            <div className='face border-2 border-indigo-400 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.4)]' />
          </div>
        </div>

        <div className='absolute -bottom-20 h-8 w-24 animate-shadow-breathe rounded-[100%] bg-black/20 blur-xl' />
      </div>

      <div className='mt-2 flex max-w-[260px] flex-col items-center gap-1 text-center'>
        <h3 className='text-sm font-semibold uppercase tracking-[0.3em] text-cyan-500'>
          {title}
        </h3>
        <p className='text-xs leading-5 text-slate-500'>
          {description}
        </p>
      </div>

      <style>{`
        .perspective-container {
          perspective: 1200px;
        }

        .preserve-3d {
          transform-style: preserve-3d;
        }

        @keyframes cubeSpin {
          0% { transform: rotateX(0deg) rotateY(0deg); }
          100% { transform: rotateX(360deg) rotateY(360deg); }
        }

        @keyframes breathe {
          0%, 100% { transform: translateZ(48px); opacity: 0.8; }
          50% { transform: translateZ(80px); opacity: 0.4; border-color: rgba(255,255,255,0.8); }
        }

        @keyframes pulse-fast {
          0%, 100% { transform: scale(0.8); opacity: 0.5; }
          50% { transform: scale(1.2); opacity: 1; }
        }

        @keyframes shadow-breathe {
          0%, 100% { transform: scale(1); opacity: 0.35; }
          50% { transform: scale(1.5); opacity: 0.18; }
        }

        .animate-cube-spin {
          animation: cubeSpin 8s linear infinite;
        }

        .animate-pulse-fast {
          animation: pulse-fast 2s ease-in-out infinite;
        }

        .animate-shadow-breathe {
          animation: shadow-breathe 3s ease-in-out infinite;
        }

        .side-wrapper {
          position: absolute;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          transform-style: preserve-3d;
        }

        .face {
          width: 100%;
          height: 100%;
          position: absolute;
          animation: breathe 3s ease-in-out infinite;
          backdrop-filter: blur(2px);
        }

        .front  { transform: rotateY(0deg); }
        .back   { transform: rotateY(180deg); }
        .right  { transform: rotateY(90deg); }
        .left   { transform: rotateY(-90deg); }
        .top    { transform: rotateX(90deg); }
        .bottom { transform: rotateX(-90deg); }
      `}</style>
    </div>
  )
}
