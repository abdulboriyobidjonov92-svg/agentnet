/**
 * Y4 (MVP): per-agent narx — murakkablik (1-5) + tool soniga qarab.
 * Narx dollarda belgilanadi (kanonik asos), so'mga joriy kurs orqali o'giriladi
 * (Y4: real-time FX; hozircha USD_UZS_RATE env, default ~12600). Bu — TAKLIF
 * narxi (kalkulyator); haqiqiy yechim/bonus Y4/Y5'da amalga oshiriladi.
 *
 * Bazaviy narxlar brief'dagi 20-agent jadvaliga mos (★★★ ≈ $35/$18 ...).
 */

export interface AgentPrice {
  complexity: number; // 1-5
  toolCount: number;
  creationUsd: number;
  monthlyUsd: number;
  creationSom: number;
  monthlySom: number;
  fxRate: number; // 1 USD = fxRate so'm
}

// Murakkablik → bazaviy narx (USD). Brief 20-agent jadvalidan kalibrlangan.
const CREATION_USD: Record<number, number> = { 1: 15, 2: 25, 3: 35, 4: 45, 5: 60 };
const MONTHLY_USD: Record<number, number> = { 1: 8, 2: 12, 3: 18, 4: 22, 5: 30 };

function clampComplexity(v: number): number {
  if (!Number.isFinite(v)) return 3;
  return Math.max(1, Math.min(5, Math.round(v)));
}

/** Joriy USD→UZS kursi. Y4'da real-time FX bilan almashtiriladi. */
export function usdUzsRate(): number {
  const v = Number(process.env.USD_UZS_RATE);
  return Number.isFinite(v) && v > 0 ? v : 12_600;
}

export function priceForAgent(
  complexity: number,
  toolCount: number,
  fxRate: number = usdUzsRate(),
): AgentPrice {
  const c = clampComplexity(complexity);
  const tools = Math.max(0, Math.floor(toolCount));
  // Har QO'SHIMCHA tool (1-dan ortig'i) yaratishga +$3, oyligiga +$1
  const extraTools = Math.max(0, tools - 1);
  const creationUsd = CREATION_USD[c] + extraTools * 3;
  const monthlyUsd = MONTHLY_USD[c] + extraTools * 1;
  return {
    complexity: c,
    toolCount: tools,
    creationUsd,
    monthlyUsd,
    creationSom: Math.round(creationUsd * fxRate),
    monthlySom: Math.round(monthlyUsd * fxRate),
    fxRate,
  };
}
