"use client";
import { useEffect, useRef } from "react";

/**
 * Zarrachali logotip — "AgentNet" so'zi tasodifiy nuqtalardan yig'ilib keladi.
 * Matn offscreen canvas'ga chiziladi, piksellari sample qilinadi va har bir
 * zarracha o'z nishoniga "spring" bilan uchadi. 2D canvas — juda yengil.
 */
export default function ParticleWordmark({
  text = "AgentNet",
  className,
  fontSize = 88,
}: {
  text?: string;
  className?: string;
  fontSize?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const cssW = canvas.clientWidth || 600;
    const cssH = canvas.clientHeight || 140;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    ctx.scale(dpr, dpr);

    // 1) Matnni yashirin canvas'ga chizib, piksel nishonlarini olish
    const off = document.createElement("canvas");
    off.width = cssW;
    off.height = cssH;
    const octx = off.getContext("2d")!;
    octx.font = `800 ${fontSize}px Sora, ui-sans-serif, system-ui`;
    octx.textAlign = "center";
    octx.textBaseline = "middle";
    octx.fillStyle = "#fff";
    octx.fillText(text, cssW / 2, cssH / 2);
    const img = octx.getImageData(0, 0, cssW, cssH).data;

    const gap = 4;
    const targets: { x: number; y: number }[] = [];
    for (let y = 0; y < cssH; y += gap) {
      for (let x = 0; x < cssW; x += gap) {
        if (img[(y * cssW + x) * 4 + 3] > 128) targets.push({ x, y });
      }
    }

    const palette = ["#22d3ee", "#34d399", "#8b5cf6", "#e0faff"];
    const particles = targets.map((tgt, i) => ({
      x: Math.random() * cssW,
      y: Math.random() * cssH,
      vx: 0,
      vy: 0,
      tx: tgt.x,
      ty: tgt.y,
      color: palette[i % palette.length],
      size: Math.random() * 1.4 + 0.8,
    }));

    let raf = 0;
    let frame = 0;
    const maxFrames = 220;

    const draw = () => {
      ctx.clearRect(0, 0, cssW, cssH);
      let settled = true;
      for (const p of particles) {
        if (reduced) {
          p.x = p.tx;
          p.y = p.ty;
        } else {
          const ax = (p.tx - p.x) * 0.045;
          const ay = (p.ty - p.y) * 0.045;
          p.vx = (p.vx + ax) * 0.86;
          p.vy = (p.vy + ay) * 0.86;
          p.x += p.vx;
          p.y += p.vy;
          if (Math.abs(p.tx - p.x) > 0.5 || Math.abs(p.ty - p.y) > 0.5) settled = false;
        }
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.92;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      frame++;
      if (!settled && frame < maxFrames) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [text, fontSize]);

  return <canvas ref={canvasRef} className={className} aria-label={text} role="img" />;
}
