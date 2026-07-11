import { createHash } from 'crypto';
import { HttpException } from '@nestjs/common';
import { ClickService } from './click.service';
import { WalletCreditService } from './wallet-credit.service';
import type { User } from '@prisma/client';

function makePrismaMock() {
  return {
    user: { findUnique: jest.fn(), update: jest.fn() },
    clickTransaction: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      // Holat-himoyalangan atomik update (default: bitta qator o'zgardi)
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    creditLedger: { create: jest.fn(async (a: any) => ({ id: 'ledger1', ...a.data })) },
    $transaction: jest.fn(async (fn: any) => fn(undefined as any)),
  };
}

function makePlatformBillingMock() {
  return { activateFromPayment: jest.fn(async () => ({})) } as any;
}

const user = { id: 'u1' } as unknown as User;

function sign(parts: (string | number)[], secret: string) {
  return createHash('md5').update([parts[0], parts[1], secret, ...parts.slice(2)].join('')).digest('hex');
}

function prepareBody(overrides: Record<string, any> = {}) {
  const base: Record<string, any> = {
    click_trans_id: '111',
    service_id: 'svc1',
    merchant_trans_id: 'u1',
    amount: '5000.00',
    action: 0,
    sign_time: '2026-07-07 10:00:00',
    ...overrides,
  };
  base.sign_string =
    overrides.sign_string ??
    sign([base.click_trans_id, base.service_id, base.merchant_trans_id, base.amount, base.action, base.sign_time], 'secret1');
  return base;
}

describe('ClickService.createTopupReceipt', () => {
  it('CLICK kalitlarisiz -> 503', async () => {
    delete process.env.CLICK_MERCHANT_ID;
    delete process.env.CLICK_SERVICE_ID;
    delete process.env.CLICK_SECRET_KEY;
    const prisma = makePrismaMock();
    const svc = new ClickService(prisma as any, new WalletCreditService(prisma as any), makePlatformBillingMock());

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

describe('ClickService.handleWebhook — imzo va Prepare/Complete oqimi', () => {
  beforeEach(() => {
    process.env.CLICK_MERCHANT_ID = 'm1';
    process.env.CLICK_SERVICE_ID = 'svc1';
    process.env.CLICK_SECRET_KEY = 'secret1';
  });

  it("noto'g'ri imzo -> -1 SIGN CHECK FAILED, hech narsa yozilmaydi", async () => {
    const prisma = makePrismaMock();
    const svc = new ClickService(prisma as any, new WalletCreditService(prisma as any), makePlatformBillingMock());
    const body = prepareBody({ sign_string: 'wrong' });

    const res = await svc.handleWebhook(body);

    expect(res.error).toBe(-1);
    expect(prisma.clickTransaction.create).not.toHaveBeenCalled();
  });

  it("Prepare: foydalanuvchi topilmasa -> -5 USER NOT FOUND", async () => {
    const prisma = makePrismaMock();
    prisma.user.findUnique.mockResolvedValue(null);
    const svc = new ClickService(prisma as any, new WalletCreditService(prisma as any), makePlatformBillingMock());

    const res = await svc.handleWebhook(prepareBody());

    expect(res.error).toBe(-5);
  });

  it('Prepare: muvaffaqiyatli -> ClickTransaction yaratiladi, merchant_prepare_id qaytadi', async () => {
    const prisma = makePrismaMock();
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    prisma.clickTransaction.findUnique.mockResolvedValue(null);
    prisma.clickTransaction.create.mockResolvedValue({ id: 'ctx1' });
    const svc = new ClickService(prisma as any, new WalletCreditService(prisma as any), makePlatformBillingMock());

    const res = await svc.handleWebhook(prepareBody());

    expect(res.error).toBe(0);
    expect((res as any).merchant_prepare_id).toBe('ctx1');
    expect(prisma.clickTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ clickTransId: '111', userId: 'u1', amountTiyin: 500_000 }) }),
    );
  });

  it('Complete: muvaffaqiyatli -> balans BIR marta kreditlanadi', async () => {
    const prisma = makePrismaMock();
    prisma.clickTransaction.findUnique.mockResolvedValue({ id: 'ctx1', userId: 'u1', amountTiyin: 500_000, state: 0 });
    prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
    prisma.clickTransaction.update.mockResolvedValue({ id: 'ctx1' });
    prisma.user.update.mockResolvedValue({ balanceTiyin: 500_000 });
    const svc = new ClickService(prisma as any, new WalletCreditService(prisma as any), makePlatformBillingMock());

    const completeBody: Record<string, any> = {
      click_trans_id: '111',
      service_id: 'svc1',
      merchant_trans_id: 'u1',
      merchant_prepare_id: 'ctx1',
      amount: '5000.00',
      action: 1,
      error: 0,
      sign_time: '2026-07-07 10:01:00',
    };
    completeBody.sign_string = createHash('md5')
      .update([completeBody.click_trans_id, completeBody.service_id, 'secret1', completeBody.merchant_trans_id, completeBody.merchant_prepare_id, completeBody.amount, completeBody.action, completeBody.sign_time].join(''))
      .digest('hex');

    const res = await svc.handleWebhook(completeBody);

    expect(res.error).toBe(0);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { balanceTiyin: { increment: 500_000 } } }),
    );
    expect(prisma.creditLedger.create).toHaveBeenCalledTimes(1);
  });

  it('Complete: allaqachon bajarilgan (state=1) -> IKKINCHI marta kreditlanmaydi', async () => {
    const prisma = makePrismaMock();
    prisma.clickTransaction.findUnique.mockResolvedValue({ id: 'ctx1', userId: 'u1', amountTiyin: 500_000, state: 1 });
    const svc = new ClickService(prisma as any, new WalletCreditService(prisma as any), makePlatformBillingMock());

    const completeBody: any = {
      click_trans_id: '111',
      service_id: 'svc1',
      merchant_trans_id: 'u1',
      merchant_prepare_id: 'ctx1',
      amount: '5000.00',
      action: 1,
      error: 0,
      sign_time: '2026-07-07 10:01:00',
    };
    completeBody.sign_string = createHash('md5')
      .update([completeBody.click_trans_id, completeBody.service_id, 'secret1', completeBody.merchant_trans_id, completeBody.merchant_prepare_id, completeBody.amount, completeBody.action, completeBody.sign_time].join(''))
      .digest('hex');

    const res = await svc.handleWebhook(completeBody);

    expect(res.error).toBe(0);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.creditLedger.create).not.toHaveBeenCalled();
  });

  it("Complete: tranzaksiya topilmasa -> -6 TRANSACTION NOT FOUND", async () => {
    const prisma = makePrismaMock();
    prisma.clickTransaction.findUnique.mockResolvedValue(null);
    const svc = new ClickService(prisma as any, new WalletCreditService(prisma as any), makePlatformBillingMock());

    const completeBody: any = {
      click_trans_id: '999',
      service_id: 'svc1',
      merchant_trans_id: 'u1',
      merchant_prepare_id: 'missing',
      amount: '5000.00',
      action: 1,
      error: 0,
      sign_time: '2026-07-07 10:01:00',
    };
    completeBody.sign_string = createHash('md5')
      .update([completeBody.click_trans_id, completeBody.service_id, 'secret1', completeBody.merchant_trans_id, completeBody.merchant_prepare_id, completeBody.amount, completeBody.action, completeBody.sign_time].join(''))
      .digest('hex');

    const res = await svc.handleWebhook(completeBody);
    expect(res.error).toBe(-6);
  });
});

/**
 * Platforma obunasi — transaction_param "userId::sub::plan" shaklida keladi.
 * Muvaffaqiyatli to'lov WALLET'GA TEGMASLIGI kerak (activateFromPayment
 * chaqiriladi, wallet.credit EMAS).
 */
describe('ClickService — platforma obunasi to\'lovi (wallet\'ga tegmaydi)', () => {
  beforeEach(() => {
    process.env.CLICK_MERCHANT_ID = 'm1';
    process.env.CLICK_SERVICE_ID = 'svc1';
    process.env.CLICK_SECRET_KEY = 'secret1';
  });

  it('Prepare: "u1::sub::pro" -> purpose/subscriptionPlan ClickTransaction\'ga yoziladi', async () => {
    const prisma = makePrismaMock();
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    prisma.clickTransaction.findUnique.mockResolvedValue(null);
    prisma.clickTransaction.create.mockResolvedValue({ id: 'ctx1' });
    const svc = new ClickService(prisma as any, new WalletCreditService(prisma as any), makePlatformBillingMock());

    const body = prepareBody({ merchant_trans_id: 'u1::sub::pro' });
    body.sign_string = sign([body.click_trans_id, body.service_id, body.merchant_trans_id, body.amount, body.action, body.sign_time], 'secret1');

    const res = await svc.handleWebhook(body);

    expect(res.error).toBe(0);
    expect(prisma.clickTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'u1', purpose: 'platform_subscription', subscriptionPlan: 'pro' }) }),
    );
  });

  it('Complete: purpose="platform_subscription" -> activateFromPayment chaqiriladi, wallet.credit CHAQIRILMAYDI', async () => {
    const prisma = makePrismaMock();
    prisma.clickTransaction.findUnique.mockResolvedValue({
      id: 'ctx1', userId: 'u1', amountTiyin: 25_200_000, state: 0, purpose: 'platform_subscription', subscriptionPlan: 'pro',
    });
    prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
    prisma.clickTransaction.update.mockResolvedValue({ id: 'ctx1' });
    const platformBilling = makePlatformBillingMock();
    const svc = new ClickService(prisma as any, new WalletCreditService(prisma as any), platformBilling);

    const completeBody: Record<string, any> = {
      click_trans_id: '111', service_id: 'svc1', merchant_trans_id: 'u1::sub::pro',
      merchant_prepare_id: 'ctx1', amount: '252000.00', action: 1, error: 0,
      sign_time: '2026-07-07 10:01:00',
    };
    completeBody.sign_string = createHash('md5')
      .update([completeBody.click_trans_id, completeBody.service_id, 'secret1', completeBody.merchant_trans_id, completeBody.merchant_prepare_id, completeBody.amount, completeBody.action, completeBody.sign_time].join(''))
      .digest('hex');

    const res = await svc.handleWebhook(completeBody);

    expect(res.error).toBe(0);
    expect(platformBilling.activateFromPayment).toHaveBeenCalledWith('u1', 'pro', prisma);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.creditLedger.create).not.toHaveBeenCalled();
  });
});
