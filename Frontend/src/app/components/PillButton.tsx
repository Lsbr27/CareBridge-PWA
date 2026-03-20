interface PillButtonProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
  icon?: React.ReactNode;
}

export function PillButton({ label, active = false, onClick, icon }: PillButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm transition-all duration-300 flex items-center gap-2 whitespace-nowrap ${
        active
          ? "bg-gradient-to-r from-purple-400/30 to-pink-400/30 text-purple-900 border border-purple-300/50"
          : "bg-white/50 text-gray-700 border border-white/60 hover:bg-white/70"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
