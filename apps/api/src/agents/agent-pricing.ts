/**
 * Y4 (MVP): per-agent narx — murakkablik (1-5) + tool soniga qarab.
 * Narx dollarda belgilanadi (kanonik asos), so'mga joriy kurs orqali o'giriladi
 * (Y4: real-time FX; hozircha USD_UZS_RATE env, default ~12600). Bu — TAKLIF
 * narxi (kalkulyator); haqiqiy yechim/bonus Y4/Y5'da amalga oshiriladi.
 *
 * Agent YARATISH bepul (activation'ni bo'g'masin — foydalanuvchi qiymat
 * ko'rmasdan pul to'lamaydi). Qiymat faqat oylik obunada undiriladi;
 * bazaviy narxlar brief'dagi 20-agent jadvaliga mos (★★★ ≈ $18/oy ...).
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

// Murakkablik → bazaviy oylik narx (USD). Brief 20-agent jadvalidan kalibrlangan.
// Yaratish HAR DOIM bepul — extraTools qo'shimchasi ham faqat oylikka qo'shiladi.
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
  // Har QO'SHIMCHA tool (1-dan ortig'i) oyligiga +$1 (yaratish bepul qoladi)
  const extraTools = Math.max(0, tools - 1);
  const monthlyUsd = MONTHLY_USD[c] + extraTools * 1;
  return {
    complexity: c,
    toolCount: tools,
    creationUsd: 0,
    monthlyUsd,
    creationSom: 0,
    monthlySom: Math.round(monthlyUsd * fxRate),
    fxRate,
  };
}
