"use client";

import { useEffect, useRef } from "react";

/**
 * TIRIK SAYYORA — orbitaning markazidagi Yer.
 *
 * NEGA CANVAS: sayyora ~1500 nuqta, 46 tarmoq tuguni va uchta signal
 * yoyidan iborat; har biri kadr boshiga aylanadi, chuqurlikka qarab
 * so'nadi va o'lchamini o'zgartiradi. DOM'da bu mingdan ortiq
 * `transform` degani — canvas'da esa bitta chizish sikli.
 *
 * QATLAMLAR (har biri boshqa tezlikda — tirik hissi shundan):
 *   1. Volumetrik nur — sayyora atrofidagi yumshoq ko'k halo.
 *   2. Tanasi: quyuq ko'k shar, yorug'lik yuqori chapdan.
 *   3. Nozik meridian/parallel panjarasi (juda past kontrastda).
 *   4. Qit'alar — nuqtali to'r; old tomonda oq-ko'k, chekkada so'nadi.
 *   5. GEOMETRIK TARMOQ — yuzadagi 46 tugun va ular orasidagi qisqa
 *      chiziqlar.
 *   6. MAYOQLAR — tarmoqning har to'rtinchi tuguni puls bilan yonadi.
 *   7. SIGNAL YOYLARI — sayyorani YAQINDAN o'rab o'tuvchi uchta yassi
 *      halqa, har birida yorqin bosh yuguradi: agentlar bir-biriga
 *      signal berayotgandek.
 *
 * QIT'ALAR aniq geografiya EMAS: ekvatorial koordinatalarda o'nta ellips
 * bilan berilgan taxminiy siluet. Bu o'lchamda Yer sifatida o'qiladi,
 * lekin xarita sifatida ishlatib bo'lmaydi.
 *
 * `prefers-reduced-motion`: hamma harakat to'xtaydi, sayyora bir marta
 * chiziladi va shundayligicha qoladi.
 */

interface Ellipse {
  lon: number;
  lat: number;
  rx: number;
  ry: number;
}

/** Qit'alar siluetining taxminiy shakli (gradusda). */
const LAND: Ellipse[] = [
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

/** Ko'k-binafsha palitra (referens: quyuq ko'k fon, oq-ko'k nuqtalar). */
const DEEP = "8, 16, 46";
const LAND_DOT = "116, 165, 255";
const LAND_HOT = "198, 222, 255";
const MESH = "104, 142, 235";
const ARC = "150, 130, 255";
const HALO = "58, 104, 224";

interface Node3 {
  x: number;
  y: number;
  z: number;
}

/** Fibonacci sferasi — yuzada tekis taqsimlangan tugunlar. */
function fibSphere(n: number): Node3[] {
  const pts: Node3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = golden * i;
    pts.push({ x: Math.cos(th) * r, y, z: Math.sin(th) * r });
  }
  return pts;
}

function rotateY(p: Node3, a: number): Node3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c };
}

export function GlobeCanvas({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // --- Bir marta hisoblanadi (kadr ichida emas) ---
    const dots: [number, number][] = [];
    for (let lat = -88; lat <= 88; lat += 2.3) {
      const circ = Math.cos((lat * Math.PI) / 180);
      const step = 2.3 / Math.max(circ, 0.2);
      for (let lon = -180; lon < 180; lon += step) {
        if (isLand(lat, lon)) dots.push([lat, lon]);
      }
    }

    const netNodes = fibSphere(46);
    const netEdges: [number, number][] = [];
    for (let i = 0; i < netNodes.length; i++) {
      for (let j = i + 1; j < netNodes.length; j++) {
        const a = netNodes[i];
        const b = netNodes[j];
        if (Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 0.52) netEdges.push([i, j]);
      }
    }
    const beacons = netNodes.filter((_, i) => i % 4 === 0);

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
      const rot = reduced ? 0.6 : time * 0.000042;

      ctx.clearRect(0, 0, w, h);

      // 1 — Volumetrik nur
      const halo = ctx.createRadialGradient(cx, cy, R * 0.86, cx, cy, R * 1.75);
      halo.addColorStop(0, `rgba(${HALO}, 0.42)`);
      halo.addColorStop(0.45, `rgba(${HALO}, 0.14)`);
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.75, 0, Math.PI * 2);
      ctx.fill();

      // 2 — Sayyora tanasi
      const body = ctx.createRadialGradient(cx - R * 0.34, cy - R * 0.38, R * 0.08, cx, cy, R);
      body.addColorStop(0, "rgba(38, 62, 140, 0.96)");
      body.addColorStop(0.5, "rgba(16, 30, 82, 0.97)");
      body.addColorStop(1, `rgba(${DEEP}, 0.98)`);
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();

      const project = (lat: number, lon: number) => {
        const phi = (lat * Math.PI) / 180;
        const lambda = (lon * Math.PI) / 180 + rot;
        const cp = Math.cos(phi);
        return { x: cp * Math.sin(lambda), y: Math.sin(phi), z: cp * Math.cos(lambda) };
      };

      // 3 — Nozik panjara
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = `rgba(${MESH}, 0.16)`;
      const strokePath = (pts: Node3[]) => {
        ctx.beginPath();
        let started = false;
        for (const p of pts) {
          if (p.z <= 0.02) {
            started = false;
            continue;
          }
          const sx = cx + p.x * R;
          const sy = cy - p.y * R;
          if (started) ctx.lineTo(sx, sy);
          else {
            ctx.moveTo(sx, sy);
            started = true;
          }
        }
        ctx.stroke();
      };
      for (let m = 0; m < 8; m++) {
        const lon = -180 + m * 45;
        const pts: Node3[] = [];
        for (let lat = -90; lat <= 90; lat += 6) pts.push(project(lat, lon));
        strokePath(pts);
      }
      for (const lat of [-50, -20, 20, 50]) {
        const pts: Node3[] = [];
        for (let lon = -180; lon <= 180; lon += 6) pts.push(project(lat, lon));
        strokePath(pts);
      }

      // 4 — Qit'alar
      for (const [lat, lon] of dots) {
        const p = project(lat, lon);
        if (p.z <= 0.02) continue;
        const a = 0.35 + p.z * 0.6;
        ctx.fillStyle = `rgba(${p.z > 0.6 ? LAND_HOT : LAND_DOT}, ${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(cx + p.x * R, cy - p.y * R, 0.8 + p.z * 1.1, 0, Math.PI * 2);
        ctx.fill();
      }

      // 5 — Geometrik tarmoq
      const np = netNodes.map((p) => {
        const r = rotateY(p, rot);
        return { ...r, sx: cx + r.x * R, sy: cy - r.y * R };
      });
      ctx.lineWidth = 0.55;
      for (const [i, j] of netEdges) {
        const a = np[i];
        const b = np[j];
        if (a.z <= 0.06 || b.z <= 0.06) continue;
        ctx.strokeStyle = `rgba(${MESH}, ${(0.12 + Math.min(a.z, b.z) * 0.4).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.stroke();
      }

      // 6 — Mayoqlar
      ctx.shadowColor = `rgba(${LAND_HOT}, 0.9)`;
      ctx.shadowBlur = 7;
      beacons.forEach((p0, k) => {
        const p = rotateY(p0, rot);
        if (p.z <= 0.08) return;
        const pulse = reduced ? 0.7 : 0.55 + 0.45 * Math.sin(time * 0.0018 + k * 1.7);
        ctx.fillStyle = `rgba(${LAND_HOT}, ${(0.3 + p.z * 0.6 * pulse).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(cx + p.x * R, cy - p.y * R, 1.1 + p.z * 1.2 * pulse, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.shadowBlur = 0;

      // Sayyora chegarasi
      ctx.strokeStyle = `rgba(${LAND_HOT}, 0.5)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();

      // 7 — Signal yoylari (sayyorani yaqindan o'rab o'tadi)
      const arcs = [
        { tilt: -0.34, rx: R * 1.1, flat: 0.3, speed: 0.00032, phase: 0 },
        { tilt: 0.62, rx: R * 1.2, flat: 0.22, speed: -0.00025, phase: 2.1 },
        { tilt: 1.45, rx: R * 1.05, flat: 0.36, speed: 0.0004, phase: 4.0 },
      ];
      for (const a of arcs) {
        const ry = a.rx * a.flat;
        ctx.strokeStyle = `rgba(${ARC}, 0.2)`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.ellipse(cx, cy, a.rx, ry, a.tilt, 0, Math.PI * 2);
        ctx.stroke();

        const head = (reduced ? 1.2 : time * a.speed) + a.phase;
        ctx.strokeStyle = `rgba(${ARC}, 0.9)`;
        ctx.lineWidth = 1.6;
        ctx.shadowColor = `rgba(${ARC}, 0.95)`;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.ellipse(cx, cy, a.rx, ry, a.tilt, head, head + 0.55);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

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
