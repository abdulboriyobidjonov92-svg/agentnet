import {
  forecastProduct,
  rankByUrgency,
  reorderMessage,
  type ForecastConfig,
  type ProductForecast,
  type SalePoint,
} from './retail-forecast';

const DAY = 86_400_000;
const NOW = new Date('2026-07-06T12:00:00Z');
const CFG: ForecastConfig = { windowDays: 28, leadTimeDays: 3, coverDays: 14 };

/** 28 kun davomida kuniga aynan `perDay` dona — har chelakka bittadan tushadi. */
function steadySales(perDay: number): SalePoint[] {
  const out: SalePoint[] = [];
  for (let i = 0; i < 28; i++) out.push({ qty: perDay, at: new Date(NOW.getTime() - i * DAY - DAY / 2) });
  return out;
}

describe('retail-forecast (agent #1 bashorat matematikasi)', () => {
  it('barqaror 1/kun savdo → velocity 1, days-to-stockout = stock', () => {
    const f = forecastProduct({ sku: 'A', name: 'Cola', stock: 6, reorderLevel: 5 }, steadySales(1), CFG, NOW);
    expect(f.dailyVelocity).toBe(1);
    expect(f.daysUntilStockout).toBe(6);
    expect(f.trend).toBe('flat');
    expect(f.stockoutDate).not.toBeNull();
  });

  it('zaxira lead-time ichida tugaydi → CRITICAL', () => {
    const f = forecastProduct({ sku: 'A', name: 'Sut', stock: 2, reorderLevel: 5 }, steadySales(1), CFG, NOW);
    expect(f.urgency).toBe('critical'); // 2 kun <= 3 kun lead-time
    // tavsiya: (lead+cover)*velocity - stock = 17*1 - 2 = 15
    expect(f.recommendedOrderQty).toBe(15);
  });

  it('lead+cover oynasida tugaydi → WARNING', () => {
    const f = forecastProduct({ sku: 'A', name: 'Non', stock: 6, reorderLevel: 3 }, steadySales(1), CFG, NOW);
    expect(f.urgency).toBe('warning'); // 6 kun (3..17 oralig'ida)
    expect(f.recommendedOrderQty).toBe(11); // 17 - 6
  });

  it('katta zaxira → OK, buyurtma tavsiya etilmaydi', () => {
    const f = forecastProduct({ sku: 'A', name: 'Yog', stock: 100, reorderLevel: 4 }, steadySales(1), CFG, NOW);
    expect(f.urgency).toBe('ok');
    expect(f.recommendedOrderQty).toBe(0);
  });

  it("savdo yo'q → STALE, tugash sanasi yo'q", () => {
    const f = forecastProduct({ sku: 'A', name: 'Eskisi', stock: 10, reorderLevel: 5 }, [], CFG, NOW);
    expect(f.urgency).toBe('stale');
    expect(f.dailyVelocity).toBe(0);
    expect(f.daysUntilStockout).toBeNull();
    expect(f.recommendedOrderQty).toBe(0);
  });

  it("o'sib borayotgan savdo → trend 'rising'", () => {
    // Yaqin kunlarda ko'proq: i=0 (eng yangi) qty 28 ... i=27 (eng eski) qty 1
    const sales: SalePoint[] = [];
    for (let i = 0; i < 28; i++) sales.push({ qty: 28 - i, at: new Date(NOW.getTime() - i * DAY - DAY / 2) });
    const f = forecastProduct({ sku: 'A', name: 'Trend', stock: 50, reorderLevel: 5 }, sales, CFG, NOW);
    expect(f.trend).toBe('rising');
    expect(f.trendSlope).toBeGreaterThan(0);
  });

  it('rankByUrgency: critical < warning < ok < stale', () => {
    const mk = (u: ProductForecast['urgency'], d: number | null): ProductForecast =>
      ({ urgency: u, daysUntilStockout: d } as ProductForecast);
    const arr = [mk('ok', 30), mk('stale', null), mk('critical', 2), mk('warning', 10)].sort(rankByUrgency);
    expect(arr.map((x) => x.urgency)).toEqual(['critical', 'warning', 'ok', 'stale']);
  });

  it('reorderMessage — mahsulot nomi + miqdorni o\'z ichiga oladi', () => {
    const f = forecastProduct({ sku: 'COLA', name: 'Cola 1L', stock: 2, reorderLevel: 5 }, steadySales(1), CFG, NOW);
    const msg = reorderMessage(f, 'uz');
    expect(msg).toContain('Cola 1L');
    expect(msg).toContain(String(f.recommendedOrderQty));
  });
});
