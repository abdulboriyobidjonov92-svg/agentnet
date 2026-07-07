import { priceForAgent, usdUzsRate } from './agent-pricing';

describe('agent-pricing (Y4 MVP: murakkablik + tool → narx)', () => {
  it('★★★ (complexity 3), 1 tool → bazaviy narx', () => {
    const p = priceForAgent(3, 1, 12_600);
    expect(p.creationUsd).toBe(35);
    expect(p.monthlyUsd).toBe(18);
    expect(p.creationSom).toBe(35 * 12_600);
    expect(p.monthlySom).toBe(18 * 12_600);
    expect(p.complexity).toBe(3);
  });

  it("qo'shimcha tool'lar narxni oshiradi (har biri +$3 / +$1)", () => {
    const p = priceForAgent(3, 3, 12_600); // 2 ta qo'shimcha tool
    expect(p.creationUsd).toBe(35 + 2 * 3); // 41
    expect(p.monthlyUsd).toBe(18 + 2 * 1); // 20
  });

  it('0 yoki 1 tool uchun qo\'shimcha yo\'q', () => {
    expect(priceForAgent(2, 0, 12_600).creationUsd).toBe(25);
    expect(priceForAgent(2, 1, 12_600).creationUsd).toBe(25);
  });

  it('murakkablik 1..5 oralig\'iga qisiladi (clamp)', () => {
    expect(priceForAgent(0, 1, 12_600).complexity).toBe(1);
    expect(priceForAgent(9, 1, 12_600).complexity).toBe(5);
    expect(priceForAgent(5, 1, 12_600).creationUsd).toBe(60);
  });

  it('noto\'g\'ri murakkablik → default 3', () => {
    expect(priceForAgent(NaN as any, 1, 12_600).complexity).toBe(3);
  });

  it('usdUzsRate: env yo\'q → default 12600; env bor → o\'sha', () => {
    delete process.env.USD_UZS_RATE;
    expect(usdUzsRate()).toBe(12_600);
    process.env.USD_UZS_RATE = '13000';
    expect(usdUzsRate()).toBe(13_000);
    delete process.env.USD_UZS_RATE;
  });
});
