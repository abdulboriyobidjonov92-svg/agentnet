import { PlatformBillingController } from './platform-billing.controller';
import type { User } from '@prisma/client';

/**
 * PlatformBillingController — bu yerda ikkita real logika bor (servis EMAS):
 *   1. plans() — narx (billing) + kunlik limit (usage) katalogini birlashtiradi.
 *   2. subscribe() — provider='click' bo'lsa Click, aks holda Payme'ga
 *      yo'naltiradi va tiyin narxini so'mga aylantiradi.
 */

const user = { id: 'u1' } as unknown as User;

function makeMock() {
  const platformBilling = {
    plansCatalog: jest.fn(() => ({
      pro: { priceSom: 149_000 },
      max: { priceSom: 1_260_000 },
      max200: { priceSom: 2_520_000 },
      enterprise: { priceSom: null },
    })),
    status: jest.fn(() => ({ plan: 'pro' })),
    priceForPlan: jest.fn((plan: string) => (plan === 'max' ? 126_000_000 : 14_900_000)),
  } as any;
  const payme = { createSubscriptionReceipt: jest.fn(async () => ({ provider: 'payme' })) } as any;
  const click = { createSubscriptionReceipt: jest.fn(async () => ({ provider: 'click' })) } as any;
  const usage = {
    platformLimitsCatalog: jest.fn(() => ({
      pro: { chatPerDay: 50 },
      max: { chatPerDay: 300 },
      max200: { chatPerDay: 1000 },
      enterprise: { chatPerDay: null },
    })),
  } as any;
  return { platformBilling, payme, click, usage };
}

describe('PlatformBillingController.plans — narx + limit birlashtirilgan katalog', () => {
  it("har tarif uchun priceSom VA chatPerDay ikkalasi ham bor", () => {
    const { platformBilling, payme, click, usage } = makeMock();
    const controller = new PlatformBillingController(platformBilling, payme, click, usage);

    const res = controller.plans();

    expect(res.pro).toEqual({ priceSom: 149_000, chatPerDay: 50 });
    expect(res.max).toEqual({ priceSom: 1_260_000, chatPerDay: 300 });
    expect(res.max200).toEqual({ priceSom: 2_520_000, chatPerDay: 1000 });
    expect(res.enterprise).toEqual({ priceSom: null, chatPerDay: null });
  });
});

describe('PlatformBillingController.status', () => {
  it("joriy foydalanuvchi bilan PlatformBillingService.status'ni chaqiradi", () => {
    const { platformBilling, payme, click, usage } = makeMock();
    const controller = new PlatformBillingController(platformBilling, payme, click, usage);

    expect(controller.status(user)).toEqual({ plan: 'pro' });
    expect(platformBilling.status).toHaveBeenCalledWith(user);
  });
});

describe("PlatformBillingController.subscribe — provider tanlovi", () => {
  it("provider berilmasa -> Payme'ga yo'naltiradi, tiyinni so'mga aylantiradi", async () => {
    const { platformBilling, payme, click, usage } = makeMock();
    const controller = new PlatformBillingController(platformBilling, payme, click, usage);

    const res = await controller.subscribe(user, { plan: 'max' } as any);

    expect(payme.createSubscriptionReceipt).toHaveBeenCalledWith(user, 'max', 1_260_000);
    expect(click.createSubscriptionReceipt).not.toHaveBeenCalled();
    expect(res).toEqual({ provider: 'payme' });
  });

  it("provider='click' -> ClickService'ga yo'naltiradi, PaymeService CHAQIRILMAYDI", async () => {
    const { platformBilling, payme, click, usage } = makeMock();
    const controller = new PlatformBillingController(platformBilling, payme, click, usage);

    await controller.subscribe(user, { plan: 'pro', provider: 'click' } as any);

    expect(click.createSubscriptionReceipt).toHaveBeenCalledWith(user, 'pro', 149_000);
    expect(payme.createSubscriptionReceipt).not.toHaveBeenCalled();
  });
});
