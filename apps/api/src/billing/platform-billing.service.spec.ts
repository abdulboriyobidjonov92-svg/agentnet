import { PlatformBillingService, effectivePlatformPlan } from './platform-billing.service';

/**
 * Platforma obunasi (Pro/Max) — PER-AGENT narxlashdan ALOHIDA. Wallet-balansga
 * TEGMAYDI; qo'lda to'lov (Payme/Click kvitansiya) + kunlik eslatma/muzlatish
 * cron'i, xuddi per-agent oylik to'lov bilan bir xil naqsh.
 */

function makeMock() {
  const prisma: any = {
    user: {
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(async (a: any) => ({ id: a.where.id, ...a.data })),
      findMany: jest.fn(async () => []),
    },
  };
  const audit = { record: jest.fn(async () => {}) } as any;
  const connectors = { sendViaChannel: jest.fn(async () => ({ ok: true })) } as any;
  return { prisma, audit, connectors };
}

describe('effectivePlatformPlan', () => {
  it('muzlatilgan bo\'lsa -> "none" (rawPlan nima bo\'lishidan qat\'i nazar)', () => {
    expect(effectivePlatformPlan({ platformPlan: 'pro', platformPlanUntil: new Date(Date.now() + 999_999), platformPlanFrozen: true })).toBe('none');
  });

  it('muddati o\'tgan (lekin hali muzlatilmagan) -> "none" (himoya sifatida)', () => {
    expect(effectivePlatformPlan({ platformPlan: 'pro', platformPlanUntil: new Date(Date.now() - 1000), platformPlanFrozen: false })).toBe('none');
  });

  it('faol -> haqiqiy tarif qaytadi', () => {
    expect(effectivePlatformPlan({ platformPlan: 'max', platformPlanUntil: new Date(Date.now() + 999_999), platformPlanFrozen: false })).toBe('max');
  });

  it('hech qachon obuna bo\'lmagan -> "none"', () => {
    expect(effectivePlatformPlan({ platformPlan: 'none', platformPlanUntil: null, platformPlanFrozen: false })).toBe('none');
  });
});

describe('PlatformBillingService.activateFromPayment', () => {
  it('yangi obuna -> platformPlan/Until o\'rnatiladi, frozen tozalanadi, audit yoziladi', async () => {
    const { prisma, audit, connectors } = makeMock();
    prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'u1', platformPlan: 'none', platformPlanUntil: null, platformPlanFrozen: false });
    const svc = new PlatformBillingService(prisma, audit, connectors, { runExclusive: (_n: string, fn: () => Promise<unknown>) => fn() } as any);

    await svc.activateFromPayment('u1', 'pro');

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({ platformPlan: 'pro', platformPlanFrozen: false, platformReminderSentAt: null }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'platform.subscription_activated' }));
  });

  it('hali faol obunani ERTA yangilash -> muddat DAVOMIDAN qo\'shiladi (yo\'qotilmaydi)', async () => {
    const { prisma, audit, connectors } = makeMock();
    const stillActiveUntil = new Date(Date.now() + 10 * 86_400_000); // 10 kun qoldi
    prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'u1', platformPlan: 'pro', platformPlanUntil: stillActiveUntil, platformPlanFrozen: false });
    const svc = new PlatformBillingService(prisma, audit, connectors, { runExclusive: (_n: string, fn: () => Promise<unknown>) => fn() } as any);

    await svc.activateFromPayment('u1', 'pro');

    const call = prisma.user.update.mock.calls[0][0];
    const newUntil: Date = call.data.platformPlanUntil;
    // 10 kun qolgan + yana 30 kun = ~40 kun (hozirgidan emas, eskisidan boshlab)
    const daysFromNow = (newUntil.getTime() - Date.now()) / 86_400_000;
    expect(daysFromNow).toBeGreaterThan(35);
  });

  it('muzlatilgan holatdan yangilash -> muddat HOZIRGIDAN boshlanadi, frozen:false', async () => {
    const { prisma, audit, connectors } = makeMock();
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      id: 'u1', platformPlan: 'pro', platformPlanUntil: new Date(Date.now() - 999_999), platformPlanFrozen: true,
    });
    const svc = new PlatformBillingService(prisma, audit, connectors, { runExclusive: (_n: string, fn: () => Promise<unknown>) => fn() } as any);

    await svc.activateFromPayment('u1', 'pro');

    const call = prisma.user.update.mock.calls[0][0];
    expect(call.data.platformPlanFrozen).toBe(false);
    const daysFromNow = (call.data.platformPlanUntil.getTime() - Date.now()) / 86_400_000;
    expect(daysFromNow).toBeLessThan(31);
    expect(daysFromNow).toBeGreaterThan(29);
  });
});

describe('PlatformBillingService.checkSubscriptions (kunlik cron)', () => {
  it('muddati yaqinlashayotganlarga BIR MARTA eslatma yuboriladi, platformReminderSentAt yoziladi', async () => {
    const { prisma, audit, connectors } = makeMock();
    const soonUser = { id: 'u1', telegramChatId: 'chat1', platformPlan: 'pro', platformPlanUntil: new Date(Date.now() + 2 * 86_400_000) };
    prisma.user.findMany.mockResolvedValueOnce([soonUser]).mockResolvedValueOnce([]);
    const svc = new PlatformBillingService(prisma, audit, connectors, { runExclusive: (_n: string, fn: () => Promise<unknown>) => fn() } as any);

    await svc.checkSubscriptions();

    expect(connectors.sendViaChannel).toHaveBeenCalledWith(expect.anything(), 'telegram', 'chat1', expect.stringContaining('tugaydi'));
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u1' }, data: expect.objectContaining({ platformReminderSentAt: expect.any(Date) }) }),
    );
  });

  it('muddati o\'tgan (yangilanmagan) -> MUZLATILADI, audit "platform.subscription_frozen"', async () => {
    const { prisma, audit, connectors } = makeMock();
    const overdueUser = { id: 'u2', telegramChatId: 'chat2', platformPlan: 'max', platformPlanUntil: new Date(Date.now() - 1000) };
    prisma.user.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([overdueUser]);
    const svc = new PlatformBillingService(prisma, audit, connectors, { runExclusive: (_n: string, fn: () => Promise<unknown>) => fn() } as any);

    await svc.checkSubscriptions();

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u2' }, data: { platformPlanFrozen: true } }),
    );
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'platform.subscription_frozen' }));
    expect(connectors.sendViaChannel).toHaveBeenCalledWith(expect.anything(), 'telegram', 'chat2', expect.stringContaining('tugadi'));
  });
});
