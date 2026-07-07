/**
 * Agent #1 (do'kon egasi) — jonli BASHORAT qatlami.
 *
 * Brief tamoyili: oddiy statistik trend (oxirgi haftalar savdosi) → "bu tovar
 * necha KUNDA tugaydi" degan sanali bashorat, "kam qoldi" emas. Murakkab ML'siz
 * ishonchli; keyinchalik haqiqiy prognoz modeli (Prophet/regressiya) bilan
 * almashtiriladi. Bu modul PURE (DB'siz) — deterministik va testlanadigan.
 */

export interface SalePoint {
  qty: number;
  at: Date;
}

export interface ForecastConfig {
  windowDays: number; // trend oynasi (kunlar)
  leadTimeDays: number; // ta'minotchi yetkazib berish muddati
  coverDays: number; // buyurtmadan keyin necha kunlik zaxira bo'lsin
}

export interface ProductForecast {
  sku: string;
  name: string;
  stock: number;
  reorderLevel: number;
  windowDays: number;
  soldInWindow: number;
  dailyVelocity: number; // dona/kun (o'rtacha)
  trendSlope: number; // kunlik o'zgarish (regressiya qiyaligi) — tezlashish/sekinlashish
  trend: 'rising' | 'falling' | 'flat';
  daysUntilStockout: number | null; // null = so'nggi oynada savdo yo'q
  stockoutDate: string | null;
  urgency: 'critical' | 'warning' | 'ok' | 'stale';
  recommendedOrderQty: number;
}

export function defaultConfig(): ForecastConfig {
  const int = (name: string, fb: number) => {
    const v = Number(process.env[name]);
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : fb;
  };
  return {
    windowDays: int('RETAIL_WINDOW_DAYS', 28),
    leadTimeDays: int('RETAIL_LEAD_DAYS', 3),
    coverDays: int('RETAIL_COVER_DAYS', 14),
  };
}

const DAY_MS = 86_400_000;
const TREND_EPS = 0.05; // dona/kun — shovqinni trenddan ajratish chegarasi

/** Kunlik savdoni [now-window, now] oralig'ida chelaklarga yig'adi. */
function dailyBuckets(sales: SalePoint[], now: Date, windowDays: number): number[] {
  const buckets = new Array(windowDays).fill(0);
  const start = now.getTime() - windowDays * DAY_MS;
  for (const s of sales) {
    const t = s.at.getTime();
    if (t < start || t > now.getTime()) continue;
    const idx = Math.min(windowDays - 1, Math.floor((t - start) / DAY_MS));
    buckets[idx] += Math.max(0, s.qty);
  }
  return buckets;
}

/** Oddiy chiziqli regressiya qiyaligi (least squares) — kunlik miqdorlar bo'yicha. */
function linearSlope(y: number[]): number {
  const n = y.length;
  if (n < 2) return 0;
  const xMean = (n - 1) / 2;
  const yMean = y.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (y[i] - yMean);
    den += (i - xMean) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

export function forecastProduct(
  product: { sku: string; name: string; stock: number; reorderLevel: number },
  sales: SalePoint[],
  config: ForecastConfig,
  now: Date = new Date(),
): ProductForecast {
  const { windowDays, leadTimeDays, coverDays } = config;
  const buckets = dailyBuckets(sales, now, windowDays);
  const soldInWindow = buckets.reduce((a, b) => a + b, 0);
  const dailyVelocity = soldInWindow / windowDays;
  const trendSlope = linearSlope(buckets);
  const trend: ProductForecast['trend'] =
    trendSlope > TREND_EPS ? 'rising' : trendSlope < -TREND_EPS ? 'falling' : 'flat';

  const stock = Math.max(0, product.stock);
  const daysUntilStockout = dailyVelocity > 0 ? stock / dailyVelocity : null;
  const stockoutDate =
    daysUntilStockout !== null
      ? new Date(now.getTime() + daysUntilStockout * DAY_MS).toISOString().slice(0, 10)
      : null;

  let urgency: ProductForecast['urgency'];
  if (dailyVelocity <= 0) {
    urgency = 'stale'; // so'nggi oynada savdo yo'q — tugash bashorati mumkin emas
  } else if ((daysUntilStockout as number) <= leadTimeDays || stock <= 0) {
    urgency = 'critical'; // ta'minot yetib kelguncha tugaydi
  } else if ((daysUntilStockout as number) <= leadTimeDays + coverDays || stock <= product.reorderLevel) {
    urgency = 'warning'; // hozir buyurtma bermasa kech bo'ladi
  } else {
    urgency = 'ok';
  }

  // Tavsiya: (lead + cover) kunlik ehtiyojni qoplaydigan miqdor (mavjud zaxira chiqarib)
  const target = (leadTimeDays + coverDays) * dailyVelocity;
  const recommendedOrderQty =
    dailyVelocity > 0 ? Math.max(0, Math.ceil(target - stock)) : 0;

  return {
    sku: product.sku,
    name: product.name,
    stock,
    reorderLevel: product.reorderLevel,
    windowDays,
    soldInWindow,
    dailyVelocity: Math.round(dailyVelocity * 100) / 100,
    trendSlope: Math.round(trendSlope * 1000) / 1000,
    trend,
    daysUntilStockout: daysUntilStockout !== null ? Math.round(daysUntilStockout * 10) / 10 : null,
    stockoutDate,
    urgency,
    recommendedOrderQty,
  };
}

const URGENCY_RANK: Record<ProductForecast['urgency'], number> = {
  critical: 0,
  warning: 1,
  ok: 2,
  stale: 3,
};

/** Ta'minotchiga avto-buyurtma qoralamasi matni (egaga tasdiqlash uchun). */
export function reorderMessage(f: ProductForecast, language: string): string {
  const days = f.daysUntilStockout ?? '?';
  const uz = `📦 Buyurtma tavsiyasi: "${f.name}" (${f.sku}). Joriy zaxira ${f.stock} dona, kunlik savdo ~${f.dailyVelocity} dona — taxminan ${days} kunda tugaydi. Ta'minotchiga ${f.recommendedOrderQty} dona buyurtma bering.`;
  const ru = `📦 Рекомендация к заказу: «${f.name}» (${f.sku}). Остаток ${f.stock} шт., продажи ~${f.dailyVelocity}/день — закончится примерно через ${days} дн. Закажите у поставщика ${f.recommendedOrderQty} шт.`;
  const en = `📦 Reorder suggestion: "${f.name}" (${f.sku}). Stock ${f.stock}, selling ~${f.dailyVelocity}/day — runs out in ~${days} days. Order ${f.recommendedOrderQty} units from the supplier.`;
  return language === 'ru' ? ru : language === 'en' ? en : uz;
}

/** Bashoratlarni ustuvorlik bo'yicha tartiblaydi (eng shoshilinch birinchi). */
export function rankByUrgency(a: ProductForecast, b: ProductForecast): number {
  if (URGENCY_RANK[a.urgency] !== URGENCY_RANK[b.urgency]) {
    return URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
  }
  // Bir xil ustuvorlikda — tezroq tugaydigani oldinga
  const da = a.daysUntilStockout ?? Infinity;
  const db = b.daysUntilStockout ?? Infinity;
  return da - db;
}
