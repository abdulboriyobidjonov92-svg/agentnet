"use client";
import { useEffect, useRef } from "react";

/**
 * Zarrachali "fireworks" — agent yaratilganda / vazifa tugaganda yumshoq
 * muvaffaqiyat animatsiyasi. `trigger` qiymati o'zgarganda otiladi.
 * 2D canvas overlay — juda yengil, WebGL kontekst talab qilmaydi.
 */
export function Fireworks({ trigger }: { trigger: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!trigger) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const ctx = canvas.getContext("2d")!;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const W = (canvas.width = canvas.clientWidth * dpr);
    const H = (canvas.height = canvas.clientHeight * dpr);
    const colors = ["#22d3ee", "#34d399", "#8b5cf6", "#fbbf24", "#e0faff"];

    type P = { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number };
    const parts: P[] = [];
    const bursts = 3;
    for (let b = 0; b < bursts; b++) {
      const cx = W * (0.3 + Math.random() * 0.4);
      const cy = H * (0.25 + Math.random() * 0.35);
      const n = 46;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const sp = (1.5 + Math.random() * 3) * dpr;
        parts.push({
          x: cx, y: cy,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 1, color: colors[(b + i) % colors.length],
          size: (1.5 + Math.random() * 2) * dpr,
        });
      }
    }

    let alive = true;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      let any = false;
      for (const p of parts) {
        if (p.life <= 0) continue;
        any = true;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.04 * dpr;
        p.vx *= 0.98;
        p.vy *= 0.98;
        p.life -= 0.016;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      if (any && alive) rafRef.current = requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, W, H);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      alive = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [trigger]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[60] h-full w-full"
      aria-hidden
    />
  );
}
