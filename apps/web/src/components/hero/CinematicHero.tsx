"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import FallbackHero from "./FallbackHero";

/**
 * CinematicHero — landing sahnasining kirish nuqtasi. Ikki qatlam:
 *   1. DOM qatlam (FallbackHero) — MacBook/iPhone/iPad ekranlari HAR DOIM
 *      DOM sifatida chiziladi: matn keskin, i18n ishonchli, a11y o'qiydi.
 *   2. 3D atmosfera (HeroCanvas) — hologram aktyorlar + zarrachalar + pol,
 *      DOM orqasida. Lazy (ssr:false); reduced-motion yoki WebGL bo'lmasa
 *      umuman yuklanmaydi — DOM qatlam yolg'iz ham to'liq kompozitsiya.
 */
const HeroCanvas = dynamic(() => import("./HeroCanvas"), {
  ssr: false,
  loading: () => null,
});

function useCanUse3D(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    try {
      const c = document.createElement("canvas");
      setOk(!!(c.getContext("webgl2") || c.getContext("webgl")));
    } catch {
      /* WebGL yo'q — DOM qatlam yetarli */
    }
  }, []);
  return ok;
}

export function CinematicHero({ className }: { className?: string }) {
  const can3D = useCanUse3D();
  return (
    <div className={`relative ${className ?? ""}`}>
      {/* 3D atmosfera — orqa qatlam */}
      {can3D && (
        <div className="absolute inset-0" aria-hidden>
          <HeroCanvas className="!h-full !w-full" />
        </div>
      )}
      {/* Qurilma ekranlari — old qatlam (har doim DOM) */}
      <div className="relative flex h-full items-end">
        <FallbackHero className="w-full" />
      </div>
    </div>
  );
}
