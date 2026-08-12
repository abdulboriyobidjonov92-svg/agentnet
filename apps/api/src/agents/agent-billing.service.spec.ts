import { AgentBillingService } from './agent-billing.service';

/**
 * Y4: oylik avtomatik yechim. Muhim: bir oy ichida IKKI MARTA yechilmasligi
 * (idempotency), balans yetmasa qayta urinish, MAX_RETRIES'dan keyin
 * "muzlatish" (o'chirilmaydi).
 */

function makeMock() {
  const prisma: any = {
    agent: { findMany: jest.fn(async () => []), update: jest.fn(), findUniqueOrThrow: jest.fn() },
    user: { updateMany: jest.fn(), findUniqueOrThrow: jest.fn() },
    creditLedger: { create: jest.fn(async (a: any) => ({ id: 'ledger1', ...a.data })), findUnique: jest.fn(async () => null) },
    $executeRaw: jest.fn(),
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  };
  const audit = { record: jest.fn(async () => {}) } as any;
  const connectors = { sendViaChannel: jest.fn(async () => ({ ok: true })) } as any;
  return { prisma, audit, connectors };
}

function makeAgent(overrides: Record<string, any> = {}) {
  return {
    id: 'agent1',
    userId: 'u1',
    name: 'Bookkeeper',
    monthlyPriceTiyin: 300_000n,
    chargeRetries: 0,
    nextChargeAt: new Date('2026-07-01T00:00:00Z'),
    user: { id: 'u1', telegramChatId: 'chat1' },
    ...overrides,
  };
}

describe('AgentBillingService.chargeOne', () => {
  it('balans yetarli -> BIR marta yechiladi, nextChargeAt 1 oyga suriladi, chargeRetries=0', async () => {
    const { prisma, audit, connectors } = makeMock();
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.findUniqueOrThrow.mockResolvedValue({ balanceTiyin: 700_000n });
    const svc = new AgentBillingService(prisma, audit, connectors, { runExclusive: (_n: string, fn: () => Promise<unknown>) => fn() } as any);

    await svc.chargeOne(makeAgent() as any);

    expect(prisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1', balanceTiyin: { gte: 300_000n } },
        data: { balanceTiyin: { decrement: 300_000n } },
      }),
    );
    expect(prisma.creditLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ kind: 'agent_monthly', amount: -300_000n }) }),
    );
    expect(prisma.agent.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ chargeRetries: 0, frozen: false }) }),
    );
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'agent.monthly_charge' }));
  });

  it('shu oy uchun ALLAQACHON yechilgan (idempotencyKey mavjud) -> IKKINCHI marta yechilmaydi', async () => {
    const { prisma, audit, connectors } = makeMock();
    prisma.creditLedger.findUnique.mockResolvedValue({ id: 'ledger-existing' }); // shu oy uchun sikl allaqachon yozilgan
    const svc = new AgentBillingService(prisma, audit, connectors, { runExclusive: (_n: string, fn: () => Promise<unknown>) => fn() } as any);

    await svc.chargeOne(makeAgent() as any);

    expect(prisma.user.updateMany).not.toHaveBeenCalled();
    expect(prisma.creditLedger.create).not.toHaveBeenCalled();
  });

  it('balans yetarli emas, chargeRetries < MAX -> ertaga qayta urinish, ogohlantirish yuboriladi, MUZLATILMAYDI', async () => {
    const { prisma, audit, connectors } = makeMock();
    prisma.user.updateMany.mockResolvedValue({ count: 0 });
    const svc = new AgentBillingService(prisma, audit, connectors, { runExclusive: (_n: string, fn: () => Promise<unknown>) => fn() } as any);

    await svc.chargeOne(makeAgent({ chargeRetries: 1 }) as any);

    expect(prisma.agent.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ chargeRetries: 2 }) }),
    );
    const updateArgs = prisma.agent.update.mock.calls[0][0];
    expect(updateArgs.data.frozen).toBeUndefined();
    expect(connectors.sendViaChannel).toHaveBeenCalledWith(
      expect.anything(), 'telegram', 'chat1', expect.stringContaining('to\'lov'),
    );
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'agent.charge_retry' }));
  });

  it('balans yetarli emas, MAX_RETRIES ga yetdi -> MUZLATILADI (o\'chirilmaydi), ogohlantirish yuboriladi', async () => {
    const { prisma, audit, connectors } = makeMock();
    prisma.user.updateMany.mockResolvedValue({ count: 0 });
    const svc = new AgentBillingService(prisma, audit, connectors, { runExclusive: (_n: string, fn: () => Promise<unknown>) => fn() } as any);

    await svc.chargeOne(makeAgent({ chargeRetries: 2 }) as any); // 3-chi urinish = MAX_RETRIES

    expect(prisma.agent.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ frozen: true, chargeRetries: 3 }) }),
    );
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'agent.frozen' }));
    expect(connectors.sendViaChannel).toHaveBeenCalledWith(
      expect.anything(), 'telegram', 'chat1', expect.stringContaining('muzlatildi'),
    );
  });
});

/**
 * AgentBillingService.resolveTrialEnd — sinov tugashi (3 kun YOKI 20 xabar).
 * chargeOne'dan FARQI: qayta-urinish (MAX_RETRIES) siyosati YO'Q — bitta
 * urinish, muvaffaqiyatsiz bo'lsa DARHOL muzlatiladi (sinovning o'zi
 * allaqachon imtiyoz muddati edi).
 */
describe('AgentBillingService.resolveTrialEnd', () => {
  function makeTrialAgent(overrides: Record<string, any> = {}) {
    return {
      id: 'agent1',
      userId: 'u1',
      name: 'Birinchi agent',
      monthlyPriceTiyin: 300_000n,
      isTrialAgent: true,
      frozen: false,
      trialMessageCount: 20,
      ...overrides,
    };
  }
  const user = { id: 'u1', telegramChatId: 'chat1' } as any;

  it('balans yetarli -> DARHOL to\'lanadi, isTrialAgent:false, nextChargeAt +1oy, "trial_converted" audit', async () => {
    const { prisma, audit, connectors } = makeMock();
    prisma.agent.findUniqueOrThrow.mockResolvedValue(makeTrialAgent());
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.findUniqueOrThrow.mockResolvedValue({ balanceTiyin: 700_000n });
    prisma.agent.update.mockResolvedValue({ ...makeTrialAgent(), isTrialAgent: false, frozen: false, frozenReason: null });
    const svc = new AgentBillingService(prisma, audit, connectors, { runExclusive: (_n: string, fn: () => Promise<unknown>) => fn() } as any);

    const result = await svc.resolveTrialEnd(makeTrialAgent() as any, user);

    expect(prisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1', balanceTiyin: { gte: 300_000n } },
        data: { balanceTiyin: { decrement: 300_000n } },
      }),
    );
    expect(prisma.creditLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ kind: 'agent_monthly', amount: -300_000n }) }),
    );
    expect(prisma.agent.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isTrialAgent: false, frozen: false, frozenReason: null }) }),
    );
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'agent.trial_converted' }));
    expect(result.frozen).toBe(false);
  });

  it('balans YETARLI EMAS -> DARHOL muzlatiladi (retry/grace YO\'Q), frozenReason="trial_expired", "SINOV" xabari yuboriladi', async () => {
    const { prisma, audit, connectors } = makeMock();
    prisma.agent.findUniqueOrThrow.mockResolvedValue(makeTrialAgent());
    prisma.user.updateMany.mockResolvedValue({ count: 0 });
    prisma.agent.update.mockResolvedValue({ ...makeTrialAgent(), frozen: true, frozenReason: 'trial_expired', isTrialAgent: false });
    const svc = new AgentBillingService(prisma, audit, connectors, { runExclusive: (_n: string, fn: () => Promise<unknown>) => fn() } as any);

    const result = await svc.resolveTrialEnd(makeTrialAgent() as any, user);

    expect(prisma.agent.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { frozen: true, frozenReason: 'trial_expired', isTrialAgent: false } }),
    );
    expect(prisma.creditLedger.create).not.toHaveBeenCalled(); // pul YECHILMAYDI
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'agent.trial_expired' }));
    expect(connectors.sendViaChannel).toHaveBeenCalledWith(
      expect.anything(), 'telegram', 'chat1', expect.stringContaining('SINOV'),
    );
    expect(result.frozen).toBe(true);
  });

  it('allaqachon hal qilingan (boshqa yo\'l orqali) -> NO-OP, ikkinchi marta yechilmaydi/muzlatilmaydi, audit qayta yozilmaydi', async () => {
    const { prisma, audit, connectors } = makeMock();
    // fresh fetch ichida allaqachon isTrialAgent:false (boshqa parallel chaqiruv hal qilgan)
    prisma.agent.findUniqueOrThrow.mockResolvedValue({ ...makeTrialAgent(), isTrialAgent: false, frozen: false });
    const svc = new AgentBillingService(prisma, audit, connectors, { runExclusive: (_n: string, fn: () => Promise<unknown>) => fn() } as any);

    await svc.resolveTrialEnd(makeTrialAgent() as any, user);

    expect(prisma.user.updateMany).not.toHaveBeenCalled();
    expect(prisma.agent.update).not.toHaveBeenCalled();
    expect(prisma.creditLedger.create).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});

/**
 * chargeDueAgents cron — sinov agentlari (isTrialAgent) resolveTrialEnd()ga,
 * oddiy agentlar chargeOne()ga yo'naltirilishi kerak (bir xil cron, ikki xil siyosat).
 */
describe('AgentBillingService.chargeDueAgents — sinov vs oddiy yo\'naltirish', () => {
  it('isTrialAgent=true qator -> resolveTrialEnd chaqiriladi, chargeOne CHAQIRILMAYDI', async () => {
    const { prisma, audit, connectors } = makeMock();
    const trialDue = { id: 'agent-trial', userId: 'u1', isTrialAgent: true, frozen: false, monthlyPriceTiyin: 300_000n, user: { id: 'u1' } };
    prisma.agent.findMany.mockResolvedValue([trialDue]);
    prisma.agent.findUniqueOrThrow.mockResolvedValue(trialDue);
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.findUniqueOrThrow.mockResolvedValue({ balanceTiyin: 500_000n });
    prisma.agent.update.mockResolvedValue({ ...trialDue, isTrialAgent: false });
    const svc = new AgentBillingService(prisma, audit, connectors, { runExclusive: (_n: string, fn: () => Promise<unknown>) => fn() } as any);
    const resolveSpy = jest.spyOn(svc, 'resolveTrialEnd');
    const chargeSpy = jest.spyOn(svc, 'chargeOne');

    await svc.chargeDueAgents();

    expect(resolveSpy).toHaveBeenCalled();
    expect(chargeSpy).not.toHaveBeenCalled();
  });

  it('isTrialAgent=false (oddiy) qator -> chargeOne chaqiriladi, resolveTrialEnd CHAQIRILMAYDI', async () => {
    const { prisma, audit, connectors } = makeMock();
    const normalDue = { id: 'agent-normal', userId: 'u1', isTrialAgent: false, frozen: false, chargeRetries: 0n, monthlyPriceTiyin: 300_000n, nextChargeAt: new Date(), user: { id: 'u1', telegramChatId: null } };
    prisma.agent.findMany.mockResolvedValue([normalDue]);
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.findUniqueOrThrow.mockResolvedValue({ balanceTiyin: 500_000n });
    const svc = new AgentBillingService(prisma, audit, connectors, { runExclusive: (_n: string, fn: () => Promise<unknown>) => fn() } as any);
    const resolveSpy = jest.spyOn(svc, 'resolveTrialEnd');
    const chargeSpy = jest.spyOn(svc, 'chargeOne');

    await svc.chargeDueAgents();

    expect(chargeSpy).toHaveBeenCalled();
    expect(resolveSpy).not.toHaveBeenCalled();
  });
});
