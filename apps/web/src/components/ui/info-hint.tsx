"use client";
// INFO-HINT — mavhum nom yoki murakkab element yonidagi kichik "?" belgisi.
// Hover / fokus / bosishda qisqa "bu nima, nega kerak" izohini ko'rsatadi.
// Klaviatura bilan ochiladi (a11y) va aria-describedby orqali bog'lanadi.

import { useId, useState } from "react";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function InfoHint({
  text,
  label = "?",
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span className={cn("relative inline-flex align-middle", className)}>
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        className="text-muted-foreground/60 transition hover:text-foreground focus-visible:text-foreground"
      >
        <HelpCircle className="h-4 w-4" />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="liquid-glass absolute left-1/2 top-full z-50 mt-2 w-64 max-w-[80vw] -translate-x-1/2 rounded-xl border border-white/[0.08] p-3 text-xs font-normal leading-relaxed text-muted-foreground shadow-lift"
        >
          {text}
        </span>
      )}
    </span>
  );
}
