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
    monthlyPriceTiyin: 300_000,
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
    prisma.user.findUniqueOrThrow.mockResolvedValue({ balanceTiyin: 700_000 });
    const svc = new AgentBillingService(prisma, audit, connectors);

    await svc.chargeOne(makeAgent() as any);

    expect(prisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1', balanceTiyin: { gte: 300_000 } },
        data: { balanceTiyin: { decrement: 300_000 } },
      }),
    );
    expect(prisma.creditLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ kind: 'agent_monthly', amount: -300_000 }) }),
    );
    expect(prisma.agent.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ chargeRetries: 0, frozen: false }) }),
    );
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'agent.monthly_charge' }));
  });

  it('shu oy uchun ALLAQACHON yechilgan (idempotencyKey mavjud) -> IKKINCHI marta yechilmaydi', async () => {
    const { prisma, audit, connectors } = makeMock();
    prisma.creditLedger.findUnique.mockResolvedValue({ id: 'ledger-existing' }); // shu oy uchun sikl allaqachon yozilgan
    const svc = new AgentBillingService(prisma, audit, connectors);

    await svc.chargeOne(makeAgent() as any);

    expect(prisma.user.updateMany).not.toHaveBeenCalled();
    expect(prisma.creditLedger.create).not.toHaveBeenCalled();
  });

  it('balans yetarli emas, chargeRetries < MAX -> ertaga qayta urinish, ogohlantirish yuboriladi, MUZLATILMAYDI', async () => {
    const { prisma, audit, connectors } = makeMock();
    prisma.user.updateMany.mockResolvedValue({ count: 0 });
    const svc = new AgentBillingService(prisma, audit, connectors);

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
    const svc = new AgentBillingService(prisma, audit, connectors);

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
