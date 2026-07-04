"use client";
import { useEffect, useRef } from "react";
import Lottie, { type LottieRefCurrentProps } from "lottie-react";
import { cn } from "@/lib/utils";
import meterAnimation from "./token-meter.lottie.json";

/**
 * TokenMeter — Lottie asosidagi token/balans o'lchagichi.
 * `frozen` rejimda animatsiya o'rta kadrda muzlatiladi (hero snapshot uchun);
 * prefers-reduced-motion bo'lsa ham avtomatik muzlaydi.
 */
export function TokenMeter({
  value,
  label,
  frozen = false,
  size = 120,
  className,
}: {
  /** Markazda ko'rsatiladigan qiymat (masalan "12 450") */
  value?: string;
  label?: string;
  /** true — o'rta kadrda to'xtatilgan snapshot (hero render) */
  frozen?: boolean;
  size?: number;
  className?: string;
}) {
  const lottieRef = useRef<LottieRefCurrentProps>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (frozen || reduced) {
      // O'rta kadr (45/90) — meterning eng "to'la" holati
      lottieRef.current?.goToAndStop(45, true);
    }
  }, [frozen]);

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ? `${label}: ${value ?? ""}` : value}
    >
      <Lottie
        lottieRef={lottieRef}
        animationData={meterAnimation}
        loop
        autoplay={!frozen}
        style={{ width: size, height: size }}
      />
      {(value || label) && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {value && (
            <span className="nums font-semibold leading-none" style={{ fontSize: size * 0.17 }}>
              {value}
            </span>
          )}
          {label && (
            <span
              className="mt-1 uppercase tracking-[0.12em] text-muted-foreground"
              style={{ fontSize: Math.max(8, size * 0.075) }}
            >
              {label}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default TokenMeter;
