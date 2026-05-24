type GhostMascotProps = {
  size?: "xs" | "sm" | "md" | "lg";
  mood?: "happy" | "calm" | "celebrate";
  className?: string;
};

const SIZE_MAP = {
  xs: 54,
  sm: 76,
  md: 112,
  lg: 136,
} as const;

const BLOB = "#b99af4";
const BLOB_SHADOW = "#8f6be8";
const WARM_SHADOW = "#ff8a5c";
const DARK = "#3b1060";

export function GhostMascot({
  size = "sm",
  mood = "happy",
  className = "",
}: GhostMascotProps) {
  const pixelSize = SIZE_MAP[size];
  const isCalm = mood === "calm";
  const isCelebrate = mood === "celebrate";

  return (
    <svg
      width={pixelSize}
      height={Math.round(pixelSize * 1.14)}
      viewBox="0 0 145 165"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {isCelebrate && (
        <>
          <path d="M18 24 L21 33 L30 36 L21 39 L18 48 L15 39 L6 36 L15 33 Z" fill="#f59e0b" />
          <path d="M125 18 L128 26 L136 29 L128 32 L125 40 L122 32 L114 29 L122 26 Z" fill="#67e8f9" />
        </>
      )}
      <path
        d="M19 104 C22 128 38 147 64 151 C99 156 124 135 127 101 L127 139
           C121 132 115 126 108 132 C101 138 94 132 87 138
           C80 144 73 138 66 144 C59 150 52 144 45 138
           C38 132 31 138 24 132 L19 132 Z"
        fill={WARM_SHADOW}
        opacity="0.9"
      />
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
        fill={BLOB_SHADOW}
        opacity="0.45"
      />
      <circle cx="54" cy="74" r="13" fill="white" />
      <circle cx="54" cy="74" r="8" fill={DARK} />
      {isCalm ? (
        <path d="M78 74 Q90 82 102 74" stroke={DARK} strokeWidth="4" strokeLinecap="round" />
      ) : (
        <>
          <circle cx="90" cy="74" r="13" fill="white" />
          <circle cx="90" cy="74" r="8" fill={DARK} />
        </>
      )}
      <circle cx="72" cy="87" r="3.5" fill={DARK} />
      <path
        d={isCalm ? "M59 100 Q72 106 85 100" : "M58 96 Q72 111 88 96"}
        stroke={DARK}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <ellipse cx="72" cy="158" rx="30" ry="7" fill="#6b21d6" opacity="0.18" />
    </svg>
  );
}
