"use client";

import { useEffect, useRef } from "react";

/**
 * TIRIK SAYYORA — orbitaning markazidagi Yer.
 *
 * NEGA CANVAS: sayyora ~900 nuqtadan iborat va ularning har biri kadr
 * boshiga aylanadi, chuqurlikka qarab so'nadi va o'lchamini o'zgartiradi.
 * Buni DOM elementlari bilan qilish 900 ta `transform` degani — brauzer
 * buni ko'tarmaydi. Canvas'da bu bitta chizish sikli.
 *
 * NIMA HARAKATLANADI (uchta qatlam, uchtasi ham boshqa tezlikda —
 * shu tufayli tirik ko'rinadi):
 *   1. Sayyora o'z o'qi atrofida aylanadi; qit'a nuqtalari old tomonda
 *      yorug', chekkaga borgan sari so'nadi, orqa yarim shar chizilmaydi.
 *   2. Tarmoq tugunlari (14 ta) sayyora bilan birga aylanadi va o'zaro
 *      chiziqlar bilan bog'lanadi — faqat ikkalasi ham ko'rinib turgan
 *      bo'lsa.
 *   3. Har chiziq bo'ylab SIGNAL yuguradi (yorqin nuqta) — bu "tirik"
 *      hissini beradigan asosiy detal.
 * Tashqarida esa orbita halqalari bo'ylab kichik signallar aylanadi.
 *
 * QIT'ALAR: aniq geografik ma'lumot emas — ekvatorial koordinatalarda
 * o'nta ellips bilan berilgan taxminiy siluet (Amerika, Afrika, Yevropa,
 * Osiyo, Avstraliya, Grenlandiya, Antarktida). 200px o'lchamda u Yer
 * sifatida o'qiladi; xarita sifatida ishlatib bo'lmaydi va shunday
 * bo'lishi ham shart emas.
 *
 * `prefers-reduced-motion`: hamma harakat to'xtaydi, sayyora bir marta
 * chiziladi va shundayligicha qoladi.
 */

interface Blob {
  lon: number;
  lat: number;
  rx: number;
  ry: number;
}

/** Qit'alar siluetining taxminiy shakli (ellipslar, gradusda). */
const LAND: Blob[] = [
  { lon: -100, lat: 45, rx: 26, ry: 17 }, // Shimoliy Amerika
  { lon: -85, lat: 14, rx: 9, ry: 7 }, // Markaziy Amerika
  { lon: -60, lat: -20, rx: 12, ry: 23 }, // Janubiy Amerika
  { lon: -42, lat: 72, rx: 11, ry: 7 }, // Grenlandiya
  { lon: 18, lat: 2, rx: 17, ry: 28 }, // Afrika
  { lon: 16, lat: 50, rx: 17, ry: 11 }, // Yevropa
  { lon: 92, lat: 46, rx: 44, ry: 22 }, // Osiyo
  { lon: 78, lat: 19, rx: 10, ry: 13 }, // Hindiston
  { lon: 112, lat: 2, rx: 13, ry: 9 }, // Janubi-sharqiy Osiyo
  { lon: 134, lat: -25, rx: 15, ry: 9 }, // Avstraliya
];

function isLand(lat: number, lon: number): boolean {
  if (lat < -72) return true; // Antarktida
  for (const b of LAND) {
    let dLon = lon - b.lon;
    if (dLon > 180) dLon -= 360;
    if (dLon < -180) dLon += 360;
    const dLat = lat - b.lat;
    if ((dLon * dLon) / (b.rx * b.rx) + (dLat * dLat) / (b.ry * b.ry) <= 1) return true;
  }
  return false;
}

/** Tarmoq tugunlari — quruqlikdagi yirik nuqtalar. */
const HUBS: [number, number][] = [
  [41, 69], // Toshkent
  [51, 0],
  [40, -74],
  [35, 139],
  [-23, -46],
  [1, 103],
  [-33, 151],
  [25, 55],
  [55, 37],
  [37, -122],
  [28, 77],
  [-1, 36],
  [52, 13],
  [31, 121],
];

interface Pt3 {
  x: number;
  y: number;
  z: number;
}

function project(lat: number, lon: number, rot: number): Pt3 {
  const phi = (lat * Math.PI) / 180;
  const lambda = (lon * Math.PI) / 180 + rot;
  const cp = Math.cos(phi);
  return { x: cp * Math.sin(lambda), y: Math.sin(phi), z: cp * Math.cos(lambda) };
}

const VIOLET = "124, 77, 255";
const BRIGHT = "167, 139, 255";
const CYAN = "34, 211, 238";

export function GlobeCanvas({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Quruqlik nuqtalari BIR MARTA hisoblanadi (kadr ichida emas).
    const dots: [number, number][] = [];
    for (let lat = -88; lat <= 88; lat += 2.3) {
      const circ = Math.cos((lat * Math.PI) / 180);
      const step = 2.3 / Math.max(circ, 0.2);
      for (let lon = -180; lon < 180; lon += step) {
        if (isLand(lat, lon)) dots.push([lat, lon]);
      }
    }

    // Yaqin tugunlar juftligi — tarmoq qirralari.
    const edges: [number, number][] = [];
    for (let i = 0; i < HUBS.length; i++) {
      for (let j = i + 1; j < HUBS.length; j++) {
        const a = HUBS[i];
        const b = HUBS[j];
        const d = Math.hypot(a[0] - b[0], Math.min(Math.abs(a[1] - b[1]), 360 - Math.abs(a[1] - b[1])));
        if (d < 62) edges.push([i, j]);
      }
    }

    let raf = 0;
    let w = 0;
    let h = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = (time: number) => {
      const cx = w / 2;
      const cy = h / 2;
      const R = Math.min(w, h) * 0.34;
      const rot = reduced ? 0.6 : time * 0.000045;

      ctx.clearRect(0, 0, w, h);

      // --- Atmosfera: sayyora chetidagi nur ---
      const halo = ctx.createRadialGradient(cx, cy, R * 0.82, cx, cy, R * 1.62);
      halo.addColorStop(0, `rgba(${VIOLET}, 0.62)`);
      halo.addColorStop(0.5, `rgba(${VIOLET}, 0.24)`);
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.62, 0, Math.PI * 2);
      ctx.fill();

      // --- Sayyora tanasi (chuqurlik uchun quyuq shar) ---
      const body = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R);
      body.addColorStop(0, "rgba(126, 96, 255, 0.92)");
      body.addColorStop(0.55, "rgba(66, 40, 205, 0.94)");
      body.addColorStop(0.85, "rgba(24, 16, 92, 0.95)");
      body.addColorStop(1, "rgba(12, 10, 48, 0.96)");
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();

      // --- Qit'alar: nuqtali to'r ---
      for (const [lat, lon] of dots) {
        const p = project(lat, lon, rot);
        if (p.z <= 0.02) continue; // orqa yarim shar
        const sx = cx + p.x * R;
        const sy = cy - p.y * R;
        const a = 0.45 + p.z * 0.55;
        const s = 0.85 + p.z * 1.15;
        // Old tomondagi nuqtalar deyarli oq-siyohrang, chekkadagilar violet
        const tint = p.z > 0.35 ? BRIGHT : VIOLET;
        ctx.fillStyle = `rgba(${tint}, ${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, s, 0, Math.PI * 2);
        ctx.fill();
      }

      // --- Tarmoq: tugunlar orasidagi chiziqlar ---
      const hubPts = HUBS.map(([lat, lon]) => {
        const p = project(lat, lon, rot);
        return { ...p, sx: cx + p.x * R, sy: cy - p.y * R };
      });

      ctx.lineWidth = 1;
      for (const [i, j] of edges) {
        const a = hubPts[i];
        const b = hubPts[j];
        if (a.z <= 0.08 || b.z <= 0.08) continue;
        const alpha = 0.34 + Math.min(a.z, b.z) * 0.55;
        ctx.strokeStyle = `rgba(${CYAN}, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.stroke();
      }

      // --- Signallar: har chiziq bo'ylab yuguruvchi nur ---
      ctx.shadowColor = `rgba(${CYAN}, 0.9)`;
      ctx.shadowBlur = 8;
      edges.forEach(([i, j], k) => {
        const a = hubPts[i];
        const b = hubPts[j];
        if (a.z <= 0.12 || b.z <= 0.12) return;
        const tt = reduced ? 0.5 : ((time * 0.00028 + k * 0.17) % 1);
        const sx = a.sx + (b.sx - a.sx) * tt;
        const sy = a.sy + (b.sy - a.sy) * tt;
        ctx.fillStyle = `rgba(${CYAN}, ${(0.5 + Math.min(a.z, b.z) * 0.5).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // --- Tugunlar ---
      for (const p of hubPts) {
        if (p.z <= 0.08) continue;
        ctx.fillStyle = `rgba(255, 255, 255, ${(0.25 + p.z * 0.6).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, 1.1 + p.z * 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // --- Sayyora chegarasi: yupqa yorug' halqa ---
      ctx.strokeStyle = `rgba(${BRIGHT}, 0.95)`;
      ctx.lineWidth = 1.4;
      ctx.shadowColor = `rgba(${VIOLET}, 0.9)`;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Yorug'lik dog'i — shar ekanligi shundan o'qiladi
      const spec = ctx.createRadialGradient(
        cx - R * 0.38, cy - R * 0.42, 0, cx - R * 0.38, cy - R * 0.42, R * 0.85,
      );
      spec.addColorStop(0, "rgba(190, 170, 255, 0.30)");
      spec.addColorStop(1, "rgba(190, 170, 255, 0)");
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = spec;
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      ctx.restore();

      // --- Tashqi orbitalar bo'ylab aylanuvchi signallar ---
      const rings = [
        { rx: R * 2.25, speed: 0.00011, count: 3, phase: 0 },
        { rx: R * 1.78, speed: -0.00016, count: 2, phase: 1.1 },
        { rx: R * 1.3, speed: 0.00022, count: 2, phase: 2.3 },
      ];
      ctx.shadowColor = `rgba(${VIOLET}, 0.9)`;
      ctx.shadowBlur = 10;
      for (const ring of rings) {
        const ry = ring.rx * 0.46;
        for (let n = 0; n < ring.count; n++) {
          const ang =
            (reduced ? 0.8 : time * ring.speed) + ring.phase + (n / ring.count) * Math.PI * 2;
          const sx = cx + Math.cos(ang) * ring.rx;
          const sy = cy + Math.sin(ang) * ry;
          const depth = (Math.sin(ang) + 1) / 2;
          ctx.fillStyle = `rgba(${VIOLET}, ${(0.35 + depth * 0.6).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(sx, sy, 1.4 + depth * 1.1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.shadowBlur = 0;

      if (!reduced) raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={ref} aria-hidden className={`absolute inset-0 h-full w-full ${className}`} />;
}
