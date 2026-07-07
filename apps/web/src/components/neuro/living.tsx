"use client";
// TIRIK HOLATLAR — raqamlar o'rniga biologik signallar.
// GlowOrb:   porlash kuchi = hajm ("28 ta agent" emas — yorqin shar).
// FlowRiver: oqim tezligi = harakat/daromad (baland suv = katta oqim).
// PulseRings: puls chastotasi = signal/suhbatlar zichligi.
// Hammasi intensity: 0..1 qabul qiladi; ma'lumot bo'lmasa xira "uyqu" holati.

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Porlovchi shar — qancha yorqin bo'lsa, shuncha ko'p hayot. */
export function GlowOrb({
  intensity,
  className,
}: {
  intensity: number;
  className?: string;
}) {
  const k = clamp01(intensity);
  return (
    <div className={cn("relative grid place-items-center", className)} aria-hidden>
      {/* Tashqi halo */}
      <div
        className="animate-breathe absolute rounded-full"
        style={{
          width: `${52 + k * 40}%`,
          aspectRatio: "1",
          background: `radial-gradient(closest-side, hsl(var(--vein-cyan) / ${0.10 + k * 0.26}), hsl(var(--vein-violet) / ${0.05 + k * 0.12}) 55%, transparent 74%)`,
          filter: "blur(2px)",
        }}
      />
      {/* Yadro */}
      <div
        className="heartbeat relative rounded-full"
        style={{
          width: `${18 + k * 16}%`,
          aspectRatio: "1",
          background: `radial-gradient(circle at 38% 32%, hsl(var(--vein-cyan) / ${0.5 + k * 0.5}), hsl(var(--vein-violet) / ${0.35 + k * 0.45}) 70%)`,
          boxShadow: `0 0 ${18 + k * 46}px hsl(var(--vein-cyan) / ${0.18 + k * 0.4}), 0 0 ${60 + k * 90}px hsl(var(--vein-violet) / ${0.08 + k * 0.2})`,
        }}
      />
    </div>
  );
}

/** Oqayotgan daryo — zarralar sinus o'zanlar bo'ylab oqadi. */
export function FlowRiver({
  intensity,
  className,
}: {
  intensity: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const kRef = useRef(clamp01(intensity));
  kRef.current = clamp01(intensity);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // O'zanlar: har biri (fase, chastota, balandlik, tezlik koeffitsienti)
    const lanes = [
      { ph: 0.0, fq: 0.012, yc: 0.30, sp: 0.9 },
      { ph: 2.1, fq: 0.016, yc: 0.50, sp: 1.2 },
      { ph: 4.4, fq: 0.010, yc: 0.70, sp: 0.7 },
    ];
    const N = 110;
    const parts = Array.from({ length: N }, (_, i) => ({
      lane: i % lanes.length,
      x: Math.random(),
      seed: Math.random(),
    }));

    let t = 0;
    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      const k = kRef.current;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      const speed = (0.0006 + k * 0.0028);
      const amp = h * (0.06 + k * 0.13);
      const visible = Math.floor(N * (0.35 + k * 0.65));

      for (let i = 0; i < visible; i++) {
        const p = parts[i];
        const L = lanes[p.lane];
        p.x += speed * L.sp * (0.6 + p.seed * 0.8);
        if (p.x > 1.05) p.x = -0.05;
        const px = p.x * w;
        const py = L.yc * h + Math.sin(px * L.fq + t * L.sp + L.ph) * amp;
        const cyan = p.seed;
        const r = (0.8 + p.seed * 1.6) * dpr * (0.7 + k * 0.8);
        ctx.fillStyle = `rgba(${Math.round(30 + (1 - cyan) * 100)},${Math.round(120 + cyan * 97)},255,${0.10 + k * 0.30})`;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!reduced) {
        t += 0.016 * (0.5 + k);
        raf = requestAnimationFrame(draw);
      }
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className={cn("h-full w-full", className)} />;
}

/** Kengayuvchi puls halqalari — signal zichligi. */
export function PulseRings({
  intensity,
  className,
}: {
  intensity: number;
  className?: string;
}) {
  const k = clamp01(intensity);
  // Zichlik oshsa — puls tezlashadi
  const dur = 3.4 - k * 2.1;
  return (
    <div className={cn("relative grid place-items-center", className)} aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="absolute rounded-full border"
          style={{
            width: "26%",
            aspectRatio: "1",
            borderColor: `hsl(var(--vein-cyan) / ${0.25 + k * 0.3})`,
            animation: `pulseRing ${dur}s cubic-bezier(0.2, 0.6, 0.4, 1) ${(-i * dur) / 3}s infinite`,
          }}
        />
      ))}
      <span
        className="heartbeat relative rounded-full"
        style={{
          width: "10%",
          aspectRatio: "1",
          background: `hsl(var(--vein-cyan) / ${0.5 + k * 0.5})`,
          boxShadow: `0 0 ${10 + k * 30}px hsl(var(--vein-cyan) / ${0.3 + k * 0.4})`,
        }}
      />
      <style>{`
        @keyframes pulseRing {
          from { transform: scale(1); opacity: ${0.5 + k * 0.4}; }
          to { transform: scale(${2.6 + k * 1.2}); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
