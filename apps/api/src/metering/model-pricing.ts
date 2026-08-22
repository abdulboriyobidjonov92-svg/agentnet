/**
 * V3-P0 · P0-5 — MODEL NARXLARI (ichki xarajat hisobi).
 *
 * ⚠️ BU RAQAMLAR — PROVAYDER E'LON QILGAN RO'YXAT NARXLARI, bizning
 * o'lchovimiz EMAS. Manba belgisi: `[FROM-RESEARCH] 2026-08`.
 * METRICS.md §6 Qoida 5: `[FROM-RESEARCH]` raqam hech qachon
 * `[MEASURED]` ga aylanmaydi — bizning o'lchovimiz undan farq qilsa,
 * BIZNING o'lchovimiz ustun.
 *
 * ⚠️ BU FOYDALANUVCHI NARXI EMAS. PRICING_ARCHITECTURE §2.2 / ADR-023 §4:
 * `INTERNAL COST` va `USER PRICE` hech qachon bitta kod yo'lida
 * hisoblanmaydi — aks holda marjani o'lchab bo'lmaydi. Bu fayl faqat
 * birinchisini biladi.
 *
 * Narxlar $/1M token. Provayder narxi o'zgarsa — bu jadval yangilanadi
 * va DECISION_LOG'ga qator yoziladi (METRICS §6 Qoida 4: har chorak
 * qayta ko'riladi).
 */

export interface ModelRate {
  /** $/1M input token. */
  inputPerMTok: number;
  /** $/1M output token. */
  outputPerMTok: number;
  /**
   * $/1M cache-read token. Anthropic'da cache-read ~90% arzon
   * (`[FROM-RESEARCH]` R4) — shuning uchun alohida.
   */
  cacheReadPerMTok: number;
}

/**
 * Model → narx. Kalit — modelning TO'LIQ nomi yoki prefiksi
 * (`resolveRate` prefiks bo'yicha ham qidiradi, chunki provayderlar
 * `-20260101` kabi sana-suffikslar qo'shadi).
 */
const RATES: Record<string, ModelRate> = {
  // --- Anthropic (pullik tier) `[FROM-RESEARCH] 2026-08` ---
  'claude-opus-4-8': { inputPerMTok: 15, outputPerMTok: 75, cacheReadPerMTok: 1.5 },
  'claude-sonnet-5': { inputPerMTok: 3, outputPerMTok: 15, cacheReadPerMTok: 0.3 },
  'claude-haiku-4-5': { inputPerMTok: 1, outputPerMTok: 5, cacheReadPerMTok: 0.1 },

  // --- OpenRouter `:free` modellari (bepul tier) ---
  // Marjinal xarajat NOL — PRICING §3.1 A2 shuni aniq aytadi
  // ("bepul modellarda marjinal xarajat ~0"). Ular jadvalda ATAYLAB
  // turibdi: "noma'lum model" belgisi bilan aralashmasin.
  'nvidia/nemotron-3-ultra-550b-a55b:free': ZERO(),
  'google/gemma-4-31b-it:free': ZERO(),
  'nvidia/nemotron-3.5-lightning:free': ZERO(),
  'google/gemma-4-26b-a4b-it:free': ZERO(),
  'cohere/north-mini-code:free': ZERO(),
};

function ZERO(): ModelRate {
  return { inputPerMTok: 0, outputPerMTok: 0, cacheReadPerMTok: 0 };
}

/**
 * Modelga narx topadi.
 *
 * `null` — model jadvalda YO'Q. Chaqiruvchi buni `costUnknown` bilan
 * belgilaydi: jim 0 yozish marjani soxta yaxshi ko'rsatardi.
 */
export function resolveRate(model: string | null | undefined): ModelRate | null {
  if (!model) return null;
  const key = model.trim();
  if (RATES[key]) return RATES[key];

  // Sana-suffiksli variantlar: `claude-sonnet-5-20260101`.
  for (const [name, rate] of Object.entries(RATES)) {
    if (key.startsWith(name)) return rate;
  }
  // Har qanday `:free` model — marjinal xarajat 0 (yuqoridagi izoh).
  if (key.endsWith(':free')) return ZERO();
  return null;
}

/** USD→UZS kursi — mavjud `agent-pricing` bilan BIR XIL manbadan. */
export function usdUzsRate(): number {
  const v = Number(process.env.USD_UZS_RATE);
  return Number.isFinite(v) && v > 0 ? v : 12_600;
}

export interface TokenCounts {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
}

/**
 * Ichki xarajat — TIYINDA (Konstitutsiya #20: BigInt, float YO'Q).
 *
 * Hisob float'da bajariladi (narxlar kasr), lekin NATIJA darhol butun
 * tiyinga yaxlitlanadi va shundan keyin pul yo'liga hech qachon float
 * kirmaydi.
 */
export function internalCostTiyin(
  model: string | null | undefined,
  tokens: TokenCounts,
): { tiyin: bigint; unknown: boolean } {
  const rate = resolveRate(model);
  if (!rate) return { tiyin: 0n, unknown: true };

  const usd =
    (tokens.inputTokens / 1_000_000) * rate.inputPerMTok +
    (tokens.outputTokens / 1_000_000) * rate.outputPerMTok +
    (tokens.cacheReadTokens / 1_000_000) * rate.cacheReadPerMTok;

  // 1 so'm = 100 tiyin.
  const tiyin = BigInt(Math.round(usd * usdUzsRate() * 100));
  return { tiyin, unknown: false };
}
