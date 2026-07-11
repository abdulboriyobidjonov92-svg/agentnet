import { HttpException } from '@nestjs/common';
import { PaymeService } from './payme.service';
import { WalletCreditService } from './wallet-credit.service';
import type { User } from '@prisma/client';

function makePrismaMock() {
  return {
    user: { findUnique: jest.fn(), update: jest.fn() },
    paymeTransaction: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    creditLedger: { create: jest.fn(async (a: any) => ({ id: 'ledger1', ...a.data })) },
    $transaction: jest.fn(async (fn: any) => fn(undefined as any)),
  };
}

function makePlatformBillingMock() {
  return { activateFromPayment: jest.fn(async () => ({})) } as any;
}

const user = { id: 'u1' } as unknown as User;

describe('PaymeService.createTopupReceipt', () => {
  it('PAYME kalitlarisiz -> 503 (soxta muvaffaqiyat yo\'q)', async () => {
    delete process.env.PAYME_MERCHANT_ID;
    delete process.env.PAYME_SECRET_KEY;
    const prisma = makePrismaMock();
    const svc = new PaymeService(prisma as any, new WalletCreditService(prisma as any), makePlatformBillingMock());

    try {
      await svc.createTopupReceipt(user, 5000);
      throw new Error('503 kutilgan edi');
    } catch (e: any) {
      expect(e).toBeInstanceOf(HttpException);
      expect(e.getStatus()).toBe(503);
      expect(e.getResponse().reason).toBe('payment_not_configured');
    }
  });
});

describe('PaymeService.handleMerchantRpc — PerformTransaction (balansni faqat BIR marta kreditlaydi)', () => {
  beforeEach(() => {
    process.env.PAYME_MERCHANT_ID = 'm1';
    process.env.PAYME_SECRET_KEY = 's1';
  });

  it('state=1 (yaratilgan) -> bajariladi, balans oshadi, state=2 bo\'ladi', async () => {
    const prisma = makePrismaMock();
    const tx = { id: 'tx1', paycomId: 42, userId: 'u1', amountTiyin: 500_000, state: 1, performTimeMs: null };
    prisma.paymeTransaction.findUnique.mockResolvedValue(tx);
    prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
    prisma.paymeTransaction.update.mockResolvedValue({ ...tx, state: 2 });
    prisma.user.update.mockResolvedValue({ balanceTiyin: 500_000 });
    const svc = new PaymeService(prisma as any, new WalletCreditService(prisma as any), makePlatformBillingMock());

    const res = await svc.handleMerchantRpc({ method: 'PerformTransaction', params: { id: 42 }, id: 1 });

    expect(res.result.state).toBe(2);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { balanceTiyin: { increment: 500_000 } } }),
    );
    expect(prisma.creditLedger.create).toHaveBeenCalledTimes(1);
  });

  it('state=2 (allaqachon bajarilgan) -> IKKINCHI marta kreditlanmaydi (idempotent)', async () => {
    const prisma = makePrismaMock();
    const tx = { id: 'tx1', paycomId: 42, userId: 'u1', amountTiyin: 500_000, state: 2, performTimeMs: BigInt(123) };
    prisma.paymeTransaction.findUnique.mockResolvedValue(tx);
    const svc = new PaymeService(prisma as any, new WalletCreditService(prisma as any), makePlatformBillingMock());

    const res = await svc.handleMerchantRpc({ method: 'PerformTransaction', params: { id: 42 }, id: 1 });

    expect(res.result.state).toBe(2);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.creditLedger.create).not.toHaveBeenCalled();
  });
});

/**
 * Platforma obunasi (purpose="platform_subscription") — muvaffaqiyatli to'lov
 * WALLET'GA TEGMASLIGI kerak (activateFromPayment chaqiriladi, wallet.credit EMAS).
 */
describe('PaymeService — platforma obunasi to\'lovi (wallet\'ga tegmaydi)', () => {
  beforeEach(() => {
    process.env.PAYME_MERCHANT_ID = 'm1';
    process.env.PAYME_SECRET_KEY = 's1';
  });

  it('CreateTransaction: account.purpose="platform_subscription" -> purpose/subscriptionPlan saqlanadi', async () => {
    const prisma = makePrismaMock();
    prisma.paymeTransaction.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    prisma.paymeTransaction.create.mockResolvedValue({ id: 'tx1', createTimeMs: BigInt(1), state: 1 });
    const platformBilling = makePlatformBillingMock();
    const svc = new PaymeService(prisma as any, new WalletCreditService(prisma as any), platformBilling);

    await svc.handleMerchantRpc({
      method: 'CreateTransaction',
      params: { id: 42, amount: 25_200_000, account: { user_id: 'u1', purpose: 'platform_subscription', plan: 'pro' } },
      id: 1,
    });

    expect(prisma.paymeTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ purpose: 'platform_subscription', subscriptionPlan: 'pro' }) }),
    );
  });

  it('PerformTransaction: purpose="platform_subscription" -> activateFromPayment chaqiriladi, wallet.credit CHAQIRILMAYDI', async () => {
    const prisma = makePrismaMock();
    const tx = { id: 'tx1', paycomId: 42, userId: 'u1', amountTiyin: 25_200_000, state: 1, performTimeMs: null, purpose: 'platform_subscription', subscriptionPlan: 'pro' };
    prisma.paymeTransaction.findUnique.mockResolvedValue(tx);
    prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
    prisma.paymeTransaction.update.mockResolvedValue({ ...tx, state: 2 });
    const platformBilling = makePlatformBillingMock();
    const svc = new PaymeService(prisma as any, new WalletCreditService(prisma as any), platformBilling);

    const res = await svc.handleMerchantRpc({ method: 'PerformTransaction', params: { id: 42 }, id: 1 });

    expect(res.result.state).toBe(2);
    expect(platformBilling.activateFromPayment).toHaveBeenCalledWith('u1', 'pro', prisma);
    expect(prisma.user.update).not.toHaveBeenCalled(); // wallet.credit chaqirilmagan
    expect(prisma.creditLedger.create).not.toHaveBeenCalled();
  });
});
