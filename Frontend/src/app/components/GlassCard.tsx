import { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function GlassCard({ children, className = "", onClick }: GlassCardProps) {
  return (
    <div
      onClick={onClick}
      className={`glass-card rounded-[20px] bg-white/40 backdrop-blur-lg border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.06)] p-4 ${className}`}
    >
      {children}
    </div>
  );
}
