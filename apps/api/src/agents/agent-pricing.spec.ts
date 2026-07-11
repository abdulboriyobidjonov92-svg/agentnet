import { priceForAgent, usdUzsRate } from './agent-pricing';

describe('agent-pricing (Y4 MVP: murakkablik + tool → narx)', () => {
  it('agent YARATISH har doim bepul (creationUsd/creationSom = 0)', () => {
    const p = priceForAgent(3, 1, 12_600);
    expect(p.creationUsd).toBe(0);
    expect(p.creationSom).toBe(0);
  });

  it('★★★ (complexity 3), 1 tool → bazaviy oylik narx', () => {
    const p = priceForAgent(3, 1, 12_600);
    expect(p.monthlyUsd).toBe(18);
    expect(p.monthlySom).toBe(18 * 12_600);
    expect(p.complexity).toBe(3);
  });

  it("qo'shimcha tool'lar faqat oylik narxni oshiradi (har biri +$1), yaratish bepul qoladi", () => {
    const p = priceForAgent(3, 3, 12_600); // 2 ta qo'shimcha tool
    expect(p.creationUsd).toBe(0);
    expect(p.monthlyUsd).toBe(18 + 2 * 1); // 20
  });

  it('0 yoki 1 tool uchun qo\'shimcha yo\'q', () => {
    expect(priceForAgent(2, 0, 12_600).monthlyUsd).toBe(12);
    expect(priceForAgent(2, 1, 12_600).monthlyUsd).toBe(12);
  });

  it('murakkablik 1..5 oralig\'iga qisiladi (clamp)', () => {
    expect(priceForAgent(0, 1, 12_600).complexity).toBe(1);
    expect(priceForAgent(9, 1, 12_600).complexity).toBe(5);
    expect(priceForAgent(5, 1, 12_600).monthlyUsd).toBe(30);
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
