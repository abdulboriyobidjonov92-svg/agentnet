"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * AgentNet — jiddiy "command-center" grafik primitivlari (sof SVG, og'ir kutubxonasiz).
 * Trading/operatsion dashboard estetikasi: gradient to'ldirishли area chart,
 * sparkline, trend-belgili stat plitka, ring gauge. Haqiqiy ma'lumotga asoslangan.
 */

/**
 * Chart palitrasi — faqat Obsidian tokenlaridan.
 * Asosiy seriya: accent-line (arctic). Qo'shimcha seriyalar: shu accent'ning
 * opacity pog'onalari (ko'p seriyani farqlash uchun yetarli, ikkinchi rang yo'q).
 * Fill: accent 8% → 0% nozik gradient. Glow/drop-shadow ishlatilmaydi.
 */
const ACCENTS = {
  cyan: { stroke: "hsl(var(--accent-line))", from: "hsl(var(--accent-line) / 0.08)", to: "hsl(var(--accent-line) / 0)" },
  blue: { stroke: "hsl(var(--accent-line) / 0.8)", from: "hsl(var(--accent-line) / 0.07)", to: "hsl(var(--accent-line) / 0)" },
  emerald: { stroke: "hsl(var(--accent-line) / 0.65)", from: "hsl(var(--accent-line) / 0.06)", to: "hsl(var(--accent-line) / 0)" },
  violet: { stroke: "hsl(var(--accent-line) / 0.5)", from: "hsl(var(--accent-line) / 0.05)", to: "hsl(var(--accent-line) / 0)" },
  gold: { stroke: "hsl(var(--accent-line) / 0.38)", from: "hsl(var(--accent-line) / 0.04)", to: "hsl(var(--accent-line) / 0)" },
  rose: { stroke: "hsl(var(--danger))", from: "hsl(var(--danger) / 0.08)", to: "hsl(var(--danger) / 0)" },
};
export type Accent = keyof typeof ACCENTS;

function buildPath(data: number[], w: number, h: number, pad = 2) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const step = (w - pad * 2) / (data.length - 1 || 1);
  return data.map((v, i) => {
    const x = pad + i * step;
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
}

/** Ichki area chart — animatsion "chizilish" bilan. */
export function AreaChart({
  data,
  accent = "cyan",
  height = 180,
  className,
  showGrid = true,
}: {
  data: number[];
  accent?: Accent;
  height?: number;
  className?: string;
  showGrid?: boolean;
}) {
  const [w, setW] = useState(600);
  const ref = useRef<HTMLDivElement>(null);
  const a = ACCENTS[accent];
  const id = useMemo(() => `ag-${Math.random().toString(36).slice(2, 8)}`, []);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((e) => setW(e[0].contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const pts = buildPath(data, w, height);
  const line = `M ${pts.join(" L ")}`;
  const area = `M ${pts[0]} L ${pts.join(" L ")} L ${w - 2},${height - 2} L 2,${height - 2} Z`;

  return (
    <div ref={ref} className={cn("w-full", className)}>
      <svg width={w} height={height} className="overflow-visible">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={a.from} />
            <stop offset="100%" stopColor={a.to} />
          </linearGradient>
        </defs>
        {showGrid &&
          [0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1="0" y1={height * f} x2={w} y2={height * f} stroke="hsl(var(--border))" strokeWidth="1" strokeDasharray="3 5" opacity="0.5" />
          ))}
        <path d={area} fill={`url(#${id})`} />
        <path d={line} fill="none" stroke={a.stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Oxirgi nuqta — "jonli" belgi */}
        <circle cx={pts[pts.length - 1].split(",")[0]} cy={pts[pts.length - 1].split(",")[1]} r="3.5" fill={a.stroke}>
          <animate attributeName="opacity" values="1;0.3;1" dur="1.8s" repeatCount="indefinite" />
        </circle>
      </svg>
    </div>
  );
}

/** Kichik sparkline — stat plitkalar uchun. */
export function Sparkline({ data, accent = "cyan", width = 96, height = 30 }: { data: number[]; accent?: Accent; width?: number; height?: number }) {
  const a = ACCENTS[accent];
  const id = useMemo(() => `sp-${Math.random().toString(36).slice(2, 8)}`, []);
  const pts = buildPath(data, width, height);
  const line = `M ${pts.join(" L ")}`;
  const area = `M ${pts[0]} L ${pts.join(" L ")} L ${width},${height} L 0,${height} Z`;
  return (
    <svg width={width} height={height}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={a.from} />
          <stop offset="100%" stopColor={a.to} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={a.stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Rasmdagidek stat plitka: gradient urg'u chizig'i, katta raqam, sparkline, trend. */
export function StatTile({
  label,
  value,
  accent = "cyan",
  data,
  trend,
  icon,
}: {
  label: string;
  value: string | number;
  accent?: Accent;
  data?: number[];
  trend?: number;
  icon?: React.ReactNode;
}) {
  const a = ACCENTS[accent];
  const up = (trend ?? 0) >= 0;
  return (
    <div className="group relative overflow-hidden rounded-2xl border bg-card/60 p-4 backdrop-blur transition hover:border-foreground/20">
      {/* Yuqori gradient urg'u chizig'i */}
      <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${a.stroke}, transparent)` }} />
      <div className="flex items-start justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        {icon && <span style={{ color: a.stroke }}>{icon}</span>}
      </div>
      <p className="mt-1.5 font-display text-2xl font-bold tabular-nums tracking-tight">
        {value}
      </p>
      <div className="mt-2 flex items-end justify-between gap-2">
        {trend !== undefined && (
          <span className={cn("text-[11px] font-semibold tabular-nums", up ? "text-ok" : "text-danger")}>
            {up ? "▲" : "▼"} {Math.abs(trend)}%
          </span>
        )}
        {data && data.length > 1 && <Sparkline data={data} accent={accent} width={90} height={26} />}
      </div>
    </div>
  );
}

/** Ring gauge — foizli ko'rsatkichlar uchun (masalan ethics/integrity darajasi). */
export function RingGauge({ value, accent = "emerald", size = 132, label }: { value: number; accent?: Accent; size?: number; label?: string }) {
  const a = ACCENTS[accent];
  const r = size / 2 - 10;
  const circ = 2 * Math.PI * r;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setShown(value), 100);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="9" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={a.stroke} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - shown / 100)}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute text-center">
        <p className="font-display text-2xl font-bold tabular-nums">{value}%</p>
        {label && <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>}
      </div>
    </div>
  );
}

/** Ko'p qatorli chiziqli chart (bir necha metrikани solishtirish uchun). */
export function MultiLine({ series, height = 180, className }: { series: { data: number[]; accent: Accent }[]; height?: number; className?: string }) {
  const [w, setW] = useState(600);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((e) => setW(e[0].contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className={cn("w-full", className)}>
      <svg width={w} height={height}>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" y1={height * f} x2={w} y2={height * f} stroke="hsl(var(--border))" strokeWidth="1" strokeDasharray="3 5" opacity="0.4" />
        ))}
        {series.map((s, i) => {
          const a = ACCENTS[s.accent];
          const pts = buildPath(s.data, w, height);
          return (
            <path key={i} d={`M ${pts.join(" L ")}`} fill="none" stroke={a.stroke} strokeWidth="1.5" strokeLinecap="round"
              strokeLinejoin="round" />
          );
        })}
      </svg>
    </div>
  );
}
