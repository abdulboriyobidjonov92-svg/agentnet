import { HttpException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AgentsService } from './agents.service';
import { priceForAgent, usdUzsRate } from './agent-pricing';
import type { User } from '@prisma/client';

/**
 * Y4: agent yaratish endi HAQIQIY pul yechadi (avval faqat kalkulyator edi).
 * Bu testlar tasdiqlaydi: (1) narx to'g'ri yechiladi, (2) balans yetmasa
 * agent YARATILMAYDI, (3) bir xil so'rov ikki marta yuborilsa IKKINCHI
 * marta yechilmaydi (idempotency).
 */

function makeMock() {
  const prisma: any = {
    user: {
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    agent: {
      count: jest.fn(async () => 0),
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    creditLedger: {
      create: jest.fn(async (a: any) => ({ id: 'ledger1', ...a.data })),
      findUnique: jest.fn(async () => null),
    },
    $executeRaw: jest.fn(),
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  };
  const http = {} as any;
  const audit = { record: jest.fn(async () => {}) } as any;
  const usage = { assertCanCreateAgent: jest.fn(async () => {}) } as any;
  const agentBilling = { chargeOne: jest.fn() } as any;
  return { prisma, http, audit, usage, agentBilling };
}

const user = { id: 'u1', balanceTiyin: 100_000_000 } as unknown as User;

const baseDto = {
  name: 'Test agent',
  systemPrompt: 'Sen yordamchisan',
  toolsConfig: [],
};

describe('AgentsService.create — haqiqiy pul yechish (avval faqat kalkulyator edi)', () => {
  it('balans yetarli -> creation narxi ATOMIK yechiladi, agent yaratiladi, ledger yoziladi', async () => {
    const { prisma, http, audit, usage, agentBilling } = makeMock();
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.findUniqueOrThrow.mockResolvedValue({ balanceTiyin: 50_000_000 });
    prisma.agent.create.mockResolvedValue({ id: 'agent1', ...baseDto });
    const svc = new AgentsService(prisma, http, audit, usage, agentBilling);

    const price = priceForAgent(1, 0, usdUzsRate());
    const expectedCreationTiyin = price.creationSom * 100;

    await svc.create(user, { ...baseDto, complexity: 1 } as any);

    expect(prisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1', balanceTiyin: { gte: expectedCreationTiyin } },
        data: { balanceTiyin: { decrement: expectedCreationTiyin } },
      }),
    );
    expect(prisma.agent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ creationPriceTiyin: expectedCreationTiyin }),
      }),
    );
    expect(prisma.creditLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: 'agent_creation', amount: -expectedCreationTiyin }),
      }),
    );
  });

  it('balans yetarli emas -> 402, agent YARATILMAYDI, ledger yozilmaydi', async () => {
    const { prisma, http, audit, usage, agentBilling } = makeMock();
    prisma.user.updateMany.mockResolvedValue({ count: 0 });
    const svc = new AgentsService(prisma, http, audit, usage, agentBilling);

    try {
      await svc.create(user, { ...baseDto, complexity: 3 } as any);
      throw new Error('402 kutilgan edi');
    } catch (e: any) {
      expect(e).toBeInstanceOf(HttpException);
      expect(e.getStatus()).toBe(402);
      expect(e.getResponse().reason).toBe('insufficient_balance');
    }
    expect(prisma.agent.create).not.toHaveBeenCalled();
    expect(prisma.creditLedger.create).not.toHaveBeenCalled();
  });

  it('tarif chegarasiga yetgan -> ForbiddenException, balans TEGILMAYDI', async () => {
    const { prisma, http, audit, usage, agentBilling } = makeMock();
    usage.assertCanCreateAgent.mockRejectedValue(new ForbiddenException({ reason: 'agent_limit' }));
    const svc = new AgentsService(prisma, http, audit, usage, agentBilling);

    await expect(svc.create(user, baseDto as any)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
    expect(prisma.agent.create).not.toHaveBeenCalled();
  });

  it('bir xil idempotencyKey bilan IKKINCHI so\'rov -> avvalgi agent qaytadi, IKKINCHI marta yechilmaydi', async () => {
    const { prisma, http, audit, usage, agentBilling } = makeMock();
    // Birinchi so'rov allaqachon shu kalit bilan yozilgan (ledger + agent mavjud)
    prisma.creditLedger.findUnique.mockResolvedValue({ id: 'ledger1', meta: { agentId: 'agent1' } });
    prisma.agent.findUnique.mockResolvedValue({ id: 'agent1', ...baseDto });
    const svc = new AgentsService(prisma, http, audit, usage, agentBilling);

    const res = await svc.create(user, { ...baseDto, idempotencyKey: 'key-1' } as any);

    expect(res).toEqual(expect.objectContaining({ id: 'agent1' }));
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
    expect(prisma.agent.create).not.toHaveBeenCalled();
    expect(prisma.creditLedger.create).not.toHaveBeenCalled();
  });

  it('parallel so\'rov bir xil kalit bilan g\'olib kelsa (unique constraint) -> g\'olibning agentini qaytaradi', async () => {
    const { prisma, http, audit, usage, agentBilling } = makeMock();
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.findUniqueOrThrow.mockResolvedValue({ balanceTiyin: 50_000_000 });
    prisma.agent.create.mockResolvedValue({ id: 'agent1', ...baseDto });
    // creditLedger.create ichida unique-constraint xatosi (boshqa parallel so'rov ulgurdi)
    prisma.creditLedger.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.19.3',
      } as any),
    );
    // Xato yuz berganda findByIdempotencyKey g'olib yozuvni topadi
    prisma.creditLedger.findUnique.mockResolvedValue({ id: 'ledger-winner', meta: { agentId: 'agent-winner' } });
    prisma.agent.findUnique.mockResolvedValue({ id: 'agent-winner' });
    const svc = new AgentsService(prisma, http, audit, usage, agentBilling);

    const res = await svc.create(user, { ...baseDto, idempotencyKey: 'key-race' } as any);

    expect(res).toEqual(expect.objectContaining({ id: 'agent-winner' }));
  });
});
