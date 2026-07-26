import { BillingController } from './billing.controller';
import type { User } from '@prisma/client';

/**
 * BillingController — plans() tiyin->so'm birlik-o'zgartirishni bajaradi
 * va ikkita katalogni birlashtiradi; paymeWebhook Payme'ning o'ziga xos
 * xato-shaklini (jsonrpc {error}) qayta shakllantiradi — bu ikkalasi ham
 * servis EMAS, controllerning o'zida yashovchi mantiq.
 */

const user = { id: 'u1' } as unknown as User;

function makeMock() {
  const billing = {
    getBalance: jest.fn(async () => ({ balanceTiyin: 1_000_000 })),
    pricePerMessageTiyin: 50_000,
    proMonthTiyin: 2_500_000,
    upgradePro: jest.fn(async () => ({})),
    chargeForMessage: jest.fn(async () => ({})),
    refund: jest.fn(async () => ({})),
    createTopupReceipt: jest.fn(async () => ({})),
  } as any;
  const usage = { limitsCatalog: jest.fn(() => ({ free: { chatPerDay: 20 } })) } as any;
  const payme = { verifyMerchantAuth: jest.fn(), handleMerchantRpc: jest.fn() } as any;
  return { billing, usage, payme };
}

describe('BillingController.plans — tiyin->so\'m + limitlar katalogi', () => {
  it("narxlarni so'mga aylantiradi va usage limitlarini birlashtiradi", () => {
    const { billing, usage, payme } = makeMock();
    const controller = new BillingController(billing, usage, payme);

    const res = controller.plans();

    expect(res).toEqual({ pricePerMessageSom: 500, proMonthSom: 25_000, limits: { free: { chatPerDay: 20 } } });
  });
});

describe('BillingController — user delegatsiyasi', () => {
  it('getBalance / upgradePro / chargeMessage / topup', async () => {
    const { billing, usage, payme } = makeMock();
    const controller = new BillingController(billing, usage, payme);

    await controller.getBalance(user);
    await controller.upgradePro(user);
    await controller.chargeMessage(user);
    await controller.topup(user, { amountSom: 50_000, provider: 'click' });

    expect(billing.getBalance).toHaveBeenCalledWith(user);
    expect(billing.upgradePro).toHaveBeenCalledWith(user);
    expect(billing.chargeForMessage).toHaveBeenCalledWith(user);
    expect(billing.createTopupReceipt).toHaveBeenCalledWith(user, 50_000, 'click');
  });

  it("refund — user, reason va idempotencyKey'ni uzatadi (InternalTokenGuard + ClerkGuard bilan himoyalangan)", async () => {
    const { billing, usage, payme } = makeMock();
    const controller = new BillingController(billing, usage, payme);

    await controller.refund(user, { reason: "engine ishlamadi", idempotencyKey: 'idem-1' });
    expect(billing.refund).toHaveBeenCalledWith(user, 'engine ishlamadi', 'idem-1');
  });
});

describe('BillingController.paymeWebhook', () => {
  it("muvaffaqiyatli RPC -> handleMerchantRpc natijasini qaytaradi", async () => {
    const { billing, usage, payme } = makeMock();
    payme.handleMerchantRpc.mockResolvedValue({ result: { transaction: '1', state: 1 } });
    const controller = new BillingController(billing, usage, payme);

    const res = await controller.paymeWebhook('Basic xxx', { id: 1, method: 'CheckPerformTransaction' });

    expect(payme.verifyMerchantAuth).toHaveBeenCalledWith('Basic xxx');
    expect(res).toEqual({ result: { transaction: '1', state: 1 } });
  });

  it("verifyMerchantAuth Payme-shaklidagi xato tashlasa -> jsonrpc {error} + so'rov id'si bilan qaytariladi (throw EMAS)", async () => {
    const { billing, usage, payme } = makeMock();
    payme.verifyMerchantAuth.mockImplementation(() => {
      throw { jsonrpc: '2.0', error: { code: -32504, message: 'Avtorizatsiya xatosi' } };
    });
    const controller = new BillingController(billing, usage, payme);

    const res = await controller.paymeWebhook('Basic notogri', { id: 42, method: 'CheckPerformTransaction' });

    expect(res).toEqual({ jsonrpc: '2.0', id: 42, error: { code: -32504, message: 'Avtorizatsiya xatosi' } });
    expect(payme.handleMerchantRpc).not.toHaveBeenCalled();
  });

  it("handleMerchantRpc Payme-shaklidagi xato tashlasa -> xuddi shu tarzda qayta shakllantiriladi", async () => {
    const { billing, usage, payme } = makeMock();
    payme.handleMerchantRpc.mockRejectedValue({ jsonrpc: '2.0', error: { code: -31003, message: 'Tranzaksiya topilmadi' } });
    const controller = new BillingController(billing, usage, payme);

    const res = await controller.paymeWebhook('Basic xxx', { id: 7, method: 'CheckTransaction' });
    expect(res).toEqual({ jsonrpc: '2.0', id: 7, error: { code: -31003, message: 'Tranzaksiya topilmadi' } });
  });

  it("Payme-shaklida bo'lmagan (kutilmagan) xato -> qayta shakllantirilmasdan OTILADI", async () => {
    const { billing, usage, payme } = makeMock();
    const unexpected = new Error("kutilmagan DB xatosi");
    payme.handleMerchantRpc.mockRejectedValue(unexpected);
    const controller = new BillingController(billing, usage, payme);

    await expect(controller.paymeWebhook('Basic xxx', { id: 1 })).rejects.toBe(unexpected);
  });
});
