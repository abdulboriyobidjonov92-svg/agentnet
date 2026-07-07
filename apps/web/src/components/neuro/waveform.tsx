"use client";
// WAVEFORM — ekran pastidagi doim harakatdagi chiziq: AI "tinglayapti".
// Idle'da mayin tebranadi; kursor tezligi va tizim faolligi amplitudani oshiradi.

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export function Waveform({
  activity = 0,
  className,
}: {
  activity?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activityRef = useRef(activity);
  activityRef.current = activity;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let energy = 0;
    let mouseX = window.innerWidth / 2;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const onMove = (e: PointerEvent) => {
      energy = Math.min(1, energy + Math.hypot(e.movementX, e.movementY) * 0.004);
      mouseX = e.clientX;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    let t = 0;
    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      const mid = h * 0.55;
      ctx.clearRect(0, 0, w, h);

      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, "rgba(30,217,255,0.0)");
      grad.addColorStop(0.25, "rgba(30,217,255,0.5)");
      grad.addColorStop(0.75, "rgba(133,82,255,0.5)");
      grad.addColorStop(1, "rgba(133,82,255,0.0)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.2 * dpr;
      ctx.shadowColor = "rgba(30,217,255,0.35)";
      ctx.shadowBlur = 10 * dpr;

      const act = activityRef.current;
      const amp = (1.6 + energy * 16 + act * 10) * dpr;
      const mx = mouseX * dpr;

      ctx.beginPath();
      const step = 3 * dpr;
      for (let x = 0; x <= w; x += step) {
        // Kursor atrofida kuchayadigan konvert
        const env = 1 + Math.exp(-(((x - mx) / (220 * dpr)) ** 2)) * (energy * 3 + act);
        const y =
          mid +
          Math.sin(x * 0.011 + t * 2.1) * amp * 0.45 * env +
          Math.sin(x * 0.023 - t * 3.7) * amp * 0.3 * env +
          Math.sin(x * 0.005 + t * 1.2) * amp * 0.25;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      if (!reduced) {
        t += 0.016;
        energy *= 0.96;
        raf = requestAnimationFrame(draw);
      }
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn("pointer-events-none h-12 w-full opacity-70", className)}
    />
  );
}
