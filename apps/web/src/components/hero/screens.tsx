"use client";
import { useState } from "react";
import {
  Bot, Camera, ShoppingCart, Stethoscope, Ship, Sparkles,
  TrendingUp, ListChecks, DollarSign, ArrowRight,
} from "lucide-react";
import { TokenMeter } from "./TokenMeter";

/**
 * Hero qurilma ekranlari — reference rasmlarga mos "jonli" demo UI:
 *   MacBook: Welcome Back + 3 stat + OLTIN "Create Your Agent" CTA +
 *            interaktiv Agent Complexity shkalasi (Easy/Medium/Complex).
 *   iPhone:  Create Your Agent onboarding + Get Started + o'lchagich.
 *   iPad:    Explore the Marketplace + boy agent kartalari.
 * Hamma tugma/karta HAQIQIY havola (sign-up / marketplace) — dekor emas.
 *
 * MUHIM: bu ekranlar drei <Html> ichida ham chizilishi mumkin (alohida React
 * root) — u yerda router/i18n konteksti yo'q. Shu sabab `t` prop orqali
 * beriladi va havolalar next/link emas, oddiy <a> bilan.
 */

export type HeroT = (key: string) => string;

const panel = "rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2";

/** Murakkablik shkalasi — gradientli yoy + strelka, bosiladigan segmentlar */
function ComplexityGauge({ t }: { t: HeroT }) {
  const [level, setLevel] = useState(1); // 0=Oson 1=O'rtacha 2=Murakkab
  const angles = [-62, 0, 62];
  const labels = [t("hero.easy"), t("hero.medium"), t("hero.complex")];
  return (
    <div className="flex items-center gap-3">
      {/* Yoy + strelka */}
      <svg viewBox="0 0 100 58" className="h-11 w-20 shrink-0" aria-hidden>
        <defs>
          <linearGradient id="cxArc" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="50%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>
        <path
          d="M 10 52 A 40 40 0 0 1 90 52"
          fill="none"
          stroke="url(#cxArc)"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <g transform={`rotate(${angles[level]} 50 52)`} style={{ transition: "transform 400ms cubic-bezier(0.32,0.72,0,1)" }}>
          <path d="M 50 52 L 46 48 L 50 20 L 54 48 Z" fill="#e8edf5" />
          <circle cx="50" cy="52" r="4.5" fill="#e8edf5" />
        </g>
      </svg>
      {/* Segment tugmalar */}
      <div className="flex flex-wrap gap-1">
        {labels.map((l, i) => (
          <button
            key={l}
            onClick={() => setLevel(i)}
            className={`rounded-full px-2 py-0.5 text-[9px] font-semibold transition ${
              level === i
                ? "bg-white/15 text-white"
                : "text-white/45 hover:text-white/80"
            }`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

/** MacBook — dashboard: salomlashuv, 3 stat, oltin CTA, murakkablik shkalasi */
export function MacScreen({ t }: { t: HeroT }) {
  return (
    <div className="flex h-full w-full flex-col gap-2 bg-[hsl(230_12%_5%)] p-4 text-left text-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-tight">
          <Sparkles className="h-3 w-3 text-[hsl(var(--accent-cyan))]" /> AgentNet
        </div>
        <div className="rounded-full border border-[hsl(var(--cta-gold)/0.4)] bg-[hsl(var(--cta-gold)/0.12)] px-2 py-0.5 text-[9px] font-bold text-[hsl(var(--cta-gold))]">
          12 450 · tokens
        </div>
      </div>

      <p className="text-base font-bold leading-tight">{t("hero.welcome")}</p>

      {/* 3 stat — reference: Tasks 18,750 APT · Revenue · $66,200 Today */}
      <div className="grid grid-cols-3 gap-2">
        <div className={panel}>
          <p className="flex items-center gap-1 text-[8px] uppercase tracking-wider text-white/50">
            <ListChecks className="h-2.5 w-2.5" /> {t("hero.tasksActive")}
          </p>
          <p className="nums text-[13px] font-semibold text-[hsl(var(--accent-cyan))]">18 750 APT</p>
        </div>
        <div className={panel}>
          <p className="flex items-center gap-1 text-[8px] uppercase tracking-wider text-white/50">
            <TrendingUp className="h-2.5 w-2.5" /> {t("hero.revenue")}
          </p>
          <svg viewBox="0 0 90 22" className="mt-0.5 h-4 w-full" aria-hidden>
            <polyline
              points="0,17 12,13 24,15 36,9 48,12 60,6 72,9 90,3"
              fill="none"
              stroke="hsl(var(--accent-cyan))"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className={panel}>
          <p className="flex items-center gap-1 text-[8px] uppercase tracking-wider text-white/50">
            <DollarSign className="h-2.5 w-2.5" /> {t("hero.today")}
          </p>
          <p className="nums text-[13px] font-semibold text-[hsl(var(--accent-emerald))]">$66 200</p>
        </div>
      </div>

      {/* OLTIN CTA — reference'dagi markaziy tugma, haqiqiy havola */}
      <a
        href="/sign-up"
        className="cta-gold mx-auto mt-0.5 flex w-[62%] items-center justify-center gap-1.5 rounded-lg py-2 text-[12px] font-bold"
      >
        {t("hero.createAgent")} <ArrowRight className="h-3 w-3" />
      </a>

      {/* Agent Complexity — interaktiv shkala */}
      <div className="mt-auto flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold text-white/80">{t("hero.complexity")}</p>
        <ComplexityGauge t={t} />
      </div>
    </div>
  );
}

/** iPhone — "Create Your Agent" + murakkablik o'lchagichi (TokenMeter) */
export function PhoneScreen({ t }: { t: HeroT }) {
  return (
    <div className="flex h-full w-full flex-col items-center gap-2 bg-[hsl(230_12%_5%)] p-3 pt-5 text-center text-white">
      <p className="text-[13px] font-bold leading-tight">{t("hero.createAgent")}</p>
      <div className="flex gap-1" aria-hidden>
        {[...Array(6)].map((_, i) => (
          <span key={i} className={`h-1 w-1 rounded-full ${i < 4 ? "bg-[hsl(var(--accent-cyan))]" : "bg-white/20"}`} />
        ))}
      </div>
      <a href="/sign-up" className="cta-gold mt-1 rounded-full px-4 py-1.5 text-[11px] font-bold">
        {t("hero.getStarted")}
      </a>
      <p className="mt-1 text-[9px] uppercase tracking-wider text-white/50">{t("hero.complexity")}</p>
      <TokenMeter frozen size={86} value="64%" />
    </div>
  );
}

/** iPad — "Explore the Marketplace" + boy agent kartalari (reference) */
export function PadScreen({ t }: { t: HeroT }) {
  const agents = [
    { icon: ShoppingCart, name: t("hero.agent1"), grad: "from-[hsl(188_100%_62%/0.35)] to-[hsl(210_100%_50%/0.2)]", tone: "text-[hsl(var(--accent-cyan))]" },
    { icon: Stethoscope, name: t("hero.agent2"), grad: "from-[hsl(160_70%_55%/0.35)] to-[hsl(188_100%_62%/0.2)]", tone: "text-[hsl(var(--accent-emerald))]" },
    { icon: Ship, name: t("hero.agent3"), grad: "from-[hsl(42_88%_58%/0.35)] to-[hsl(20_90%_55%/0.2)]", tone: "text-[hsl(var(--cta-gold))]" },
    { icon: Camera, name: t("hero.agent4"), grad: "from-[hsl(260_100%_70%/0.35)] to-[hsl(188_100%_62%/0.2)]", tone: "text-[hsl(var(--neon-violet))]" },
  ];
  return (
    <div className="flex h-full w-full flex-col gap-1.5 bg-[hsl(230_12%_5%)] p-3.5 text-left text-white">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold leading-tight">{t("hero.marketplaceTitle")}</p>
          <p className="mt-0.5 text-[9px] uppercase tracking-wider text-white/50">{t("hero.topAgents")}</p>
        </div>
        {/* Mini trend grafigi — reference'dagi yuqori-o'ng chiziq */}
        <svg viewBox="0 0 70 24" className="h-5 w-16 shrink-0" aria-hidden>
          <polyline
            points="0,19 10,14 20,17 30,10 40,13 50,6 60,9 70,3"
            fill="none"
            stroke="hsl(var(--accent-cyan))"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="grid flex-1 grid-cols-2 gap-1.5">
        {agents.map(({ icon: Icon, name, grad, tone }) => (
          <a key={name} href="/marketplace" className={`${panel} flex items-center gap-2 transition hover:border-white/25`}>
            {/* Avatar plitka — gradient + belgi */}
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br ${grad}`}>
              <Icon className={`h-3.5 w-3.5 ${tone}`} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[10px] font-semibold leading-tight">{name}</span>
              <span className="block text-[8px] text-white/45">AI · 24/7</span>
            </span>
          </a>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <Bot className="h-3 w-3 text-white/40" />
        <a href="/marketplace" className="cta-gold rounded-full px-2.5 py-0.5 text-[9px] font-bold">
          {t("hero.explore")}
        </a>
      </div>
    </div>
  );
}
