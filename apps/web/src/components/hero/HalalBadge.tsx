"use client";

/** Halal belgisi — hero yuqori chap burchagida (SVG, emerald urg'u). */
export function HalalBadge({ className }: { className?: string }) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border border-[hsl(var(--accent-emerald)/0.4)] bg-[hsl(var(--accent-emerald)/0.1)] px-3 py-1.5 ${className ?? ""}`}
      title="Halal Filter — har doim yoqiq"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        {/* Yarim oy */}
        <path
          d="M14.5 3.5a9 9 0 1 0 6 15.5A10.5 10.5 0 0 1 14.5 3.5Z"
          stroke="hsl(158 72% 52%)"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        {/* Tasdiq belgisi */}
        <path
          d="m8.5 12.5 2.5 2.5 4.5-5"
          stroke="hsl(158 72% 52%)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--accent-emerald))]">Halal</span>
    </div>
  );
}
