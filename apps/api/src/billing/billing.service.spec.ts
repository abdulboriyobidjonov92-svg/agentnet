import { HttpException } from '@nestjs/common';
import { BillingService } from './billing.service';
import type { User } from '@prisma/client';

function makeMock() {
  return {
    user: {
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    creditLedger: { create: jest.fn(async (a: any) => ({ id: 'ledger1', ...a.data })) },
  };
}

function makeProviderMock(providerId: 'payme' | 'click') {
  return { providerId, isConfigured: jest.fn(() => true), createTopupReceipt: jest.fn(async () => ({ provider: providerId, payUrl: `https://${providerId}.example/pay`, amountSom: 5000 })) };
}

const user = { id: 'u1', balanceTiyin: 100_000, proUntil: null } as unknown as User;

describe('BillingService.chargeForMessage (atomik — balansdan ortiq sarflab bo\'lmaydi)', () => {
  beforeEach(() => {
    process.env.BILLING_PRICE_PER_MESSAGE_TIYIN = '50000';
  });

  it('balans yetarli -> yechiladi va usage-ledger yoziladi', async () => {
    const prisma = makeMock();
    prisma.user.updateMany.mockResolvedValue({ count: 1 }); // atomik yechim muvaffaqiyatli
    prisma.user.findUniqueOrThrow.mockResolvedValue({ balanceTiyin: 50_000 });
    const svc = new BillingService(prisma as any, makeProviderMock('payme') as any, makeProviderMock('click') as any);

    await svc.chargeForMessage(user);

    // Atomik shart: WHERE balanceTiyin >= amount
    expect(prisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1', balanceTiyin: { gte: 50_000 } },
        data: { balanceTiyin: { decrement: 50_000 } },
      }),
    );
    expect(prisma.creditLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ kind: 'usage', amount: -50_000 }) }),
    );
  });

  it('balans yetarli emas (count=0) -> 402, pul YECHILMAYDI va ledger yozilmaydi', async () => {
    const prisma = makeMock();
    prisma.user.updateMany.mockResolvedValue({ count: 0 }); // yetarli balans yo'q
    const svc = new BillingService(prisma as any, makeProviderMock('payme') as any, makeProviderMock('click') as any);

    try {
      await svc.chargeForMessage(user);
      throw new Error('402 kutilgan edi');
    } catch (e: any) {
      expect(e).toBeInstanceOf(HttpException);
      expect(e.getStatus()).toBe(402);
      expect(e.getResponse().reason).toBe('insufficient_balance');
    }
    expect(prisma.creditLedger.create).not.toHaveBeenCalled();
  });
});

describe('BillingService.upgradePro (atomik prepaid yechim)', () => {
  beforeEach(() => {
    process.env.BILLING_PRO_MONTH_TIYIN = '2500000';
  });

  it('balans yetarli -> pro yoqiladi', async () => {
    const prisma = makeMock();
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.update.mockResolvedValue({
      balanceTiyin: 0,
      proUntil: new Date(Date.now() + 30 * 864e5),
    });
    const svc = new BillingService(prisma as any, makeProviderMock('payme') as any, makeProviderMock('click') as any);

    const res = await svc.upgradePro(user);
    expect(res.plan).toBe('pro');
    expect(prisma.creditLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ kind: 'subscription' }) }),
    );
  });

  it('balans yetarli emas -> 402, pro yoqilmaydi', async () => {
    const prisma = makeMock();
    prisma.user.updateMany.mockResolvedValue({ count: 0 });
    const svc = new BillingService(prisma as any, makeProviderMock('payme') as any, makeProviderMock('click') as any);

    await expect(svc.upgradePro(user)).rejects.toBeInstanceOf(HttpException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('BillingService.createTopupReceipt (Payme yoki Click orasida marshrutlash)', () => {
  it('provider ko\'rsatilmasa -> Payme (standart)', async () => {
    const prisma = makeMock();
    const payme = makeProviderMock('payme');
    const click = makeProviderMock('click');
    const svc = new BillingService(prisma as any, payme as any, click as any);

    const res = await svc.createTopupReceipt(user, 5000);

    expect(payme.createTopupReceipt).toHaveBeenCalledWith(user, 5000);
    expect(click.createTopupReceipt).not.toHaveBeenCalled();
    expect(res.provider).toBe('payme');
  });

  it('provider="click" -> Click Merchant chaqiriladi, Payme emas', async () => {
    const prisma = makeMock();
    const payme = makeProviderMock('payme');
    const click = makeProviderMock('click');
    const svc = new BillingService(prisma as any, payme as any, click as any);

    const res = await svc.createTopupReceipt(user, 5000, 'click');

    expect(click.createTopupReceipt).toHaveBeenCalledWith(user, 5000);
    expect(payme.createTopupReceipt).not.toHaveBeenCalled();
    expect(res.provider).toBe('click');
  });
});
