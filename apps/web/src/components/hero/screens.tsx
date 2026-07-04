"use client";
import { Bot, Camera, ShoppingCart, Stethoscope, Ship, Sparkles, TrendingUp } from "lucide-react";
import { TokenMeter } from "./TokenMeter";

/**
 * Hero qurilma ekranlari — DOM sifatida chiziladi (uch o'lchamli sahnada
 * drei <Html transform>, fallback'da oddiy div). Matn har doim keskin
 * o'qiladi (canvas texture emas) va 3 tilda ishlaydi.
 *
 * MUHIM: drei <Html> kontentni ALOHIDA React root'da chizadi — u yerda
 * i18n konteksti (useT) mavjud emas. Shu sabab tarjima funksiyasi `t`
 * tashqaridan (asosiy daraxtdan) prop sifatida beriladi.
 */

export type HeroT = (key: string) => string;

const panel = "rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2";

/** MacBook — dashboard: salomlashuv, statistika, daromad sparkline */
export function MacScreen({ t }: { t: HeroT }) {
  return (
    <div className="flex h-full w-full flex-col gap-2.5 bg-[hsl(230_12%_5%)] p-4 text-left text-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-tight">
          <Sparkles className="h-3 w-3 text-[hsl(var(--accent-cyan))]" /> AgentNet
        </div>
        <div className="rounded-full border border-[hsl(var(--cta-gold)/0.4)] bg-[hsl(var(--cta-gold)/0.12)] px-2 py-0.5 text-[9px] font-bold text-[hsl(var(--cta-gold))]">
          12 450 · tokens
        </div>
      </div>
      <p className="text-base font-bold leading-tight">{t("hero.welcome")}</p>
      <div className="grid grid-cols-2 gap-2">
        <div className={panel}>
          <p className="text-[9px] uppercase tracking-wider text-white/50">{t("hero.tokens")}</p>
          <p className="nums text-sm font-semibold text-[hsl(var(--accent-cyan))]">12 500 APT</p>
        </div>
        <div className={panel}>
          <p className="text-[9px] uppercase tracking-wider text-white/50">{t("hero.tasksActive")}</p>
          <p className="nums text-sm font-semibold text-[hsl(var(--accent-emerald))]">28 · active</p>
        </div>
      </div>
      <div className={`${panel} flex-1`}>
        <div className="flex items-center justify-between">
          <p className="text-[9px] uppercase tracking-wider text-white/50">{t("hero.revenue")}</p>
          <TrendingUp className="h-3 w-3 text-[hsl(var(--accent-cyan))]" />
        </div>
        {/* Sparkline — reference'dagi revenue grafigi */}
        <svg viewBox="0 0 200 44" className="mt-1 h-10 w-full" aria-hidden>
          <polyline
            points="0,34 18,28 36,31 54,22 72,26 90,16 108,21 126,12 144,17 162,8 180,13 200,5"
            fill="none"
            stroke="hsl(var(--accent-cyan))"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <polyline
            points="0,34 18,28 36,31 54,22 72,26 90,16 108,21 126,12 144,17 162,8 180,13 200,5 200,44 0,44"
            fill="hsl(var(--accent-cyan) / 0.12)"
            stroke="none"
          />
        </svg>
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
      <button className="cta-gold mt-1 rounded-full px-4 py-1.5 text-[11px] font-bold">
        {t("hero.getStarted")}
      </button>
      <p className="mt-1 text-[9px] uppercase tracking-wider text-white/50">{t("hero.complexity")}</p>
      <TokenMeter frozen size={86} value="64%" />
    </div>
  );
}

/** iPad — "Explore the Marketplace" + top agent kartalari */
export function PadScreen({ t }: { t: HeroT }) {
  const agents = [
    { icon: ShoppingCart, name: t("hero.agent1"), tone: "text-[hsl(var(--accent-cyan))]" },
    { icon: Stethoscope, name: t("hero.agent2"), tone: "text-[hsl(var(--accent-emerald))]" },
    { icon: Ship, name: t("hero.agent3"), tone: "text-[hsl(var(--cta-gold))]" },
    { icon: Camera, name: t("hero.agent4"), tone: "text-[hsl(var(--accent-cyan))]" },
  ];
  return (
    <div className="flex h-full w-full flex-col gap-2 bg-[hsl(230_12%_5%)] p-3.5 text-left text-white">
      <p className="text-sm font-bold leading-tight">{t("hero.marketplaceTitle")}</p>
      <p className="text-[9px] uppercase tracking-wider text-white/50">{t("hero.topAgents")}</p>
      <div className="grid flex-1 grid-cols-2 gap-1.5">
        {agents.map(({ icon: Icon, name, tone }) => (
          <div key={name} className={`${panel} flex items-center gap-1.5`}>
            <Icon className={`h-3.5 w-3.5 shrink-0 ${tone}`} />
            <span className="truncate text-[10px] font-medium">{name}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <Bot className="h-3 w-3 text-white/40" />
        <span className="cta-gold rounded-full px-2.5 py-0.5 text-[9px] font-bold">Explore</span>
      </div>
    </div>
  );
}
