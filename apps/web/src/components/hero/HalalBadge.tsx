"use client";

/** Halal belgisi — reference'dagi olti burchakli neon nishon (emerald).
 *  Sahna chap tomonida, laptop yonida suzadi. */
export function HalalBadge({ className }: { className?: string }) {
  return (
    <div
      className={`relative inline-flex items-center justify-center ${className ?? ""}`}
      title="Halal Filter — har doim yoqiq"
    >
      <svg width="92" height="102" viewBox="0 0 92 102" fill="none" aria-hidden>
        {/* Olti burchak korpus */}
        <path
          d="M46 3 87 26.5v49L46 99 5 75.5v-49L46 3Z"
          fill="hsl(158 72% 52% / 0.07)"
          stroke="hsl(158 72% 52% / 0.75)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* Ichki hairline */}
        <path
          d="M46 11 80 30.5v41L46 91 12 71.5v-41L46 11Z"
          stroke="hsl(158 72% 52% / 0.3)"
          strokeWidth="1"
          strokeLinejoin="round"
        />
        {/* Yarim oy */}
        <path
          d="M50 30a12 12 0 1 0 8 20.5A14 14 0 0 1 50 30Z"
          stroke="hsl(158 72% 52%)"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className="absolute bottom-[18px] text-[11px] font-bold uppercase tracking-[0.18em]"
        style={{ color: "hsl(158 72% 52%)", textShadow: "0 0 12px hsl(158 72% 52% / 0.6)" }}
      >
        Halal
      </span>
    </div>
  );
}
