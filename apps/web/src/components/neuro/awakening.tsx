"use client";
// UYG'ONISH (The Awakening) — kirish sekvensiyasi.
// 1) Zim-ziyo ekranda matn harflab "jonlanadi" (blur -> fokus).
// 2) Biometrik skan chizig'i matn ustidan o'tadi, filament chiziladi.
// 3) Qorong'ulik zarralarga bo'linib bug'lanadi — dashboard ochiladi.
// Sessiyada bir marta ko'rsatiladi (sessionStorage).

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

const SESSION_KEY = "neuro_awakened";

export function Awakening({
  label = "Uyg'onish",
  onDone,
}: {
  label?: string;
  onDone?: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [done, setDone] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const scanRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  // SSR gidratsiyasidan keyin bir marta qaror qabul qilamiz
  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) {
      setDone(true);
      doneRef.current?.();
    } else {
      setMounted(true);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const overlay = overlayRef.current;
    const text = textRef.current;
    const scan = scanRef.current;
    const line = lineRef.current;
    const canvas = canvasRef.current;
    if (!overlay || !text || !scan || !line || !canvas) return;

    const finish = () => {
      sessionStorage.setItem(SESSION_KEY, "1");
      setDone(true);
      doneRef.current?.();
    };

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      const t = setTimeout(finish, 400);
      return () => clearTimeout(t);
    }

    const letters = Array.from(text.querySelectorAll<HTMLSpanElement>("[data-letter]"));

    // --- Zarra bug'lanishi (3-bosqich) uchun kanvas ---
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    const ctx = canvas.getContext("2d");
    let raf = 0;
    const particles = Array.from({ length: 640 }, () => {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const ang = Math.atan2(y - cy, x - cx) + (Math.random() - 0.5) * 0.9;
      const spd = (1.5 + Math.random() * 5) * dpr;
      return {
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        r: (0.5 + Math.random() * 1.4) * dpr,
        cyan: Math.random(),
        life: 0.6 + Math.random() * 0.4,
      };
    });
    const burnParticles = () => {
      if (!ctx) return;
      let alive = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "lighter";
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 1.03;
        p.vy *= 1.03;
        p.life -= 0.016;
        if (p.life <= 0) continue;
        alive = true;
        ctx.fillStyle = p.cyan > 0.5
          ? `rgba(30,217,255,${p.life * 0.55})`
          : `rgba(133,82,255,${p.life * 0.5})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (alive) raf = requestAnimationFrame(burnParticles);
    };

    const tl = gsap.timeline({ onComplete: finish });

    // 1) Harflar zulmatdan fokusga keladi
    tl.set(overlay, { opacity: 1 })
      .fromTo(
        letters,
        { opacity: 0, filter: "blur(14px)", y: 10 },
        {
          opacity: 1,
          filter: "blur(0px)",
          y: 0,
          duration: 1.0,
          stagger: 0.055,
          ease: "power2.out",
        },
        0.35,
      )
      .fromTo(
        text,
        { letterSpacing: "0.65em" },
        { letterSpacing: "0.3em", duration: 1.6, ease: "power3.out" },
        0.35,
      )
      // 2) Biometrik skan — yorug' chiziq matn ustidan o'tadi
      .fromTo(
        scan,
        { yPercent: -160, opacity: 0 },
        { yPercent: 160, opacity: 1, duration: 0.85, ease: "power1.inOut" },
        1.15,
      )
      .to(scan, { opacity: 0, duration: 0.2 }, 1.95)
      // Filament — imzo chiziq chiziladi
      .fromTo(
        line,
        { scaleX: 0 },
        { scaleX: 1, duration: 0.7, ease: "power3.inOut" },
        1.25,
      )
      // Matn oxirgi zarbda porlaydi
      .to(
        text,
        { textShadow: "0 0 26px hsl(188 100% 62% / 0.75)", duration: 0.3, ease: "power2.in" },
        2.0,
      )
      // 3) Qorong'ulik bug'lanadi
      .add(() => {
        raf = requestAnimationFrame(burnParticles);
      }, 2.35)
      .to(text, { opacity: 0, filter: "blur(10px)", scale: 1.06, duration: 0.5 }, 2.35)
      .to(line, { opacity: 0, duration: 0.3 }, 2.35)
      .to(overlay, { opacity: 0, duration: 1.05, ease: "power2.inOut" }, 2.55);

    return () => {
      tl.kill();
      cancelAnimationFrame(raf);
    };
  }, [mounted]);

  if (done || !mounted) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
      style={{ opacity: 1 }}
      aria-hidden
    >
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      <div className="relative flex flex-col items-center gap-5 overflow-hidden px-8 py-6">
        <div
          ref={textRef}
          className="relative select-none font-mono text-sm uppercase text-foreground/90 sm:text-base"
          style={{ letterSpacing: "0.65em" }}
        >
          {label.split("").map((ch, i) => (
            <span key={i} data-letter className="inline-block" style={{ opacity: 0 }}>
              {ch === " " ? " " : ch}
            </span>
          ))}
          <span data-letter className="inline-block" style={{ opacity: 0 }}>…</span>
          {/* Skan chizig'i */}
          <div
            ref={scanRef}
            className="pointer-events-none absolute inset-x-[-30%] top-1/2 h-8 -translate-y-1/2"
            style={{
              opacity: 0,
              background:
                "linear-gradient(to bottom, transparent, hsl(188 100% 62% / 0.22) 45%, hsl(188 100% 62% / 0.55) 50%, hsl(188 100% 62% / 0.22) 55%, transparent)",
            }}
          />
        </div>
        <div
          ref={lineRef}
          className="h-px w-48 origin-left sm:w-64"
          style={{
            transform: "scaleX(0)",
            background: "linear-gradient(90deg, hsl(188 100% 62%), hsl(260 100% 70%))",
          }}
        />
      </div>
    </div>
  );
}
