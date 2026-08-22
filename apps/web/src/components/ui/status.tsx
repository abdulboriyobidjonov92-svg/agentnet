import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * V3-P0 status primitivlari (UI-1).
 *
 * IKKI ALOHIDA SHKALA — ular chalkashtirilmaydi:
 *   `RiskBadge`  — amal QANCHALIK XAVFLI (SAFETY_POLICY_LAYER §2)
 *   `StateBadge` — ijro HOZIR QAYSI HOLATDA (P0_BLUEPRINT §2.3)
 *
 * Ranglar `globals.css` dagi `--risk-*` / `--state-*` tokenlaridan keladi;
 * bu faylda hech qanday hex/hsl qiymat YO'Q (token qoidasi).
 *
 * ⚠️ MATN PROP ORQALI: yorliqlar `label` bilan beriladi va tarjima
 * chaqiruvchida (`t(...)`) qilinadi. Sabab: bu primitivlar hali yakuniy
 * uy topmagan (UI-4/UI-7 da ishlatiladi) — ularga hozir i18n kaliti
 * o'ylab topish uchta lokalga o'lik kalit qo'shish demakdir (CLAUDE.md
 * kalit-parity qoidasi). Yorliqsiz ishlatilsa texnik nom ko'rsatiladi.
 */

export const RISK_TIERS = ["low", "medium", "high", "critical"] as const;
export type RiskTier = (typeof RISK_TIERS)[number];

export const RUN_STATES = [
  "running",
  "waiting",
  "blocked",
  "success",
  "failed",
  "cancelled",
] as const;
export type RunState = (typeof RUN_STATES)[number];

/**
 * A11Y: rang YAKKA O'ZI signal emas. Har tier o'z SHAKLI bilan ham
 * ajraladi — rang ko'rmaydigan foydalanuvchi ham farqni ko'radi.
 *   low ─ tekis chiziq · medium ◆ · high ▲ · critical ⬢
 */
const RISK_GLYPH: Record<RiskTier, string> = {
  low: "─",
  medium: "◆",
  high: "▲",
  critical: "⬢",
};

export interface RiskBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tier: RiskTier;
  /** Ko'rinadigan yorliq (tarjima qilingan). Berilmasa — texnik nom. */
  label?: string;
  /** `false` — faqat rang va shakl, matnsiz (zich jadvallar uchun). */
  showLabel?: boolean;
}

const RiskBadge = React.forwardRef<HTMLSpanElement, RiskBadgeProps>(
  ({ tier, label, showLabel = true, className, ...props }, ref) => {
    const text = label ?? tier.toUpperCase();
    return (
      <span
        ref={ref}
        data-risk={tier}
        // `risk-edge` tiriklik shkalasini beradi: LOW tekis → CRITICAL puls.
        className={cn(
          "risk-surface risk-edge inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
          className,
        )}
        {...props}
      >
        <span aria-hidden="true" className="text-[0.75em] leading-none">
          {RISK_GLYPH[tier]}
        </span>
        {showLabel ? text : <span className="sr-only">{text}</span>}
      </span>
    );
  },
);
RiskBadge.displayName = "RiskBadge";

export interface StateBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  state: RunState;
  label?: string;
}

const StateBadge = React.forwardRef<HTMLSpanElement, StateBadgeProps>(
  ({ state, label, className, ...props }, ref) => (
    <span
      ref={ref}
      data-state-kind={state}
      className={cn(
        "state-surface inline-flex items-center gap-2 rounded-full px-2.5 py-0.5 text-xs font-medium",
        className,
      )}
      {...props}
    >
      <StatusDot state={state} />
      {label ?? state}
    </span>
  ),
);
StateBadge.displayName = "StateBadge";

export interface StatusDotProps extends React.HTMLAttributes<HTMLSpanElement> {
  state: RunState;
}

/**
 * Yolg'iz nuqta — jadval qatorlari va chat qadamlari uchun.
 * Faqat `running` va `waiting` harakatlanadi (ular e'tibor so'raydi);
 * tugagan holatlar ataylab qotib turadi.
 */
const StatusDot = React.forwardRef<HTMLSpanElement, StatusDotProps>(
  ({ state, className, ...props }, ref) => (
    <span
      ref={ref}
      data-state-kind={state}
      aria-hidden="true"
      className={cn("state-dot h-1.5 w-1.5 shrink-0", className)}
      {...props}
    />
  ),
);
StatusDot.displayName = "StatusDot";

export { RiskBadge, StateBadge, StatusDot };
