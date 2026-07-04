"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import FallbackHero from "./FallbackHero";

/**
 * CinematicHero — landing sahnasining kirish nuqtasi.
 * three.js sahna faqat klientda, lazy (dynamic ssr:false); reduced-motion
 * yoki WebGL bo'lmasa FallbackHero (CSS kompozitsiya) ko'rsatiladi.
 */
const HeroCanvas = dynamic(() => import("./HeroCanvas"), {
  ssr: false,
  loading: () => <FallbackHero className="h-full w-full" />,
});

function useCanUse3D(): boolean | null {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setOk(false);
      return;
    }
    try {
      const c = document.createElement("canvas");
      setOk(!!(c.getContext("webgl2") || c.getContext("webgl")));
    } catch {
      setOk(false);
    }
  }, []);
  return ok;
}

export function CinematicHero({ className }: { className?: string }) {
  const can3D = useCanUse3D();
  return (
    <div className={className} aria-hidden>
      {can3D ? <HeroCanvas className="!h-full !w-full" /> : <FallbackHero className="h-full w-full" />}
    </div>
  );
}
