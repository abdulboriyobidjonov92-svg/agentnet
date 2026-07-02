"use client";
import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useState } from "react";

/**
 * Umumiy 3D sahna o'rami — barcha sahnalar shu orqali chiziladi.
 * Performans byudjeti: dpr 1–1.5, o'rta qurilmalar uchun kam zarrachalar,
 * prefers-reduced-motion'da statik kadr.
 */

export function useLowPower(): boolean {
  const [low, setLow] = useState(false);
  useEffect(() => {
    const nav = navigator as Navigator & { deviceMemory?: number };
    const cores = nav.hardwareConcurrency ?? 8;
    const mem = nav.deviceMemory ?? 8;
    setLow(cores <= 4 || mem <= 4);
  }, []);
  return low;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  return reduced;
}

export function SceneCanvas({
  children,
  camera,
  className,
}: {
  children: React.ReactNode;
  camera?: { position?: [number, number, number]; fov?: number };
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <Canvas
      className={className}
      dpr={[1, 1.5]}
      frameloop={reduced ? "demand" : "always"}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance", preserveDrawingBuffer: true }}
      camera={{ position: camera?.position ?? [0, 0, 6], fov: camera?.fov ?? 50 }}
      style={{ background: "transparent" }}
    >
      <Suspense fallback={null}>{children}</Suspense>
    </Canvas>
  );
}

/** Imzo palitra — three sahnalarida ishlatiladigan ranglar */
export const NEON = {
  cyan: "#22d3ee",
  emerald: "#34d399",
  violet: "#8b5cf6",
  blue: "#3b82f6",
  gold: "#fbbf24",
} as const;

export const AGENT_COLORS = [NEON.cyan, NEON.emerald, NEON.violet, NEON.gold, NEON.blue, "#f472b6"];
