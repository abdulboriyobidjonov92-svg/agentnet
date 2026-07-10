import {
  HttpException,
  ForbiddenException,
  BadRequestException,
  ServiceUnavailableException,
  UnprocessableEntityException,
  BadGatewayException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { of, throwError } from 'rxjs';
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
    conversation: {
      create: jest.fn(async (a: any) => ({ id: 'conv1', ...a.data })),
      findUnique: jest.fn(async () => ({ id: 'conv1', messages: [] })),
      update: jest.fn(async (a: any) => a),
    },
    $executeRaw: jest.fn(),
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  };
  const http = { post: jest.fn() } as any;
  const audit = { record: jest.fn(async () => {}) } as any;
  const usage = { assertCanCreateAgent: jest.fn(async () => {}), consumeChat: jest.fn(async () => {}) } as any;
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

/**
 * Y9: bir-klik agent kompozitori — tabiiy til tavsifidan tayyor agent
 * TAKLIFI (agent hali yaratilmaydi). Bu testlar: muvaffaqiyatli taklif,
 * Halal Filter bloki (422), va engine mavjud emasligi holatlarini tekshiradi.
 */
describe('AgentsService.compose — bir-klik agent taklifi (AI engine orqali)', () => {
  it('engine muvaffaqiyatli javob bersa -> proposal + meta + narx qaytadi', async () => {
    const { prisma, http, audit, usage, agentBilling } = makeMock();
    http.post.mockReturnValue(
      of({
        data: {
          name: 'Sotuv yordamchisi',
          system_prompt: 'Sen sotuv agentisan',
          tools: [{ tool_id: 'crm.lookup', config: {} }],
          complexity: 2,
          domain: 'sales',
          vertical: 'retail',
          reasoning: 'Foydalanuvchi CRM integratsiyasini so\'radi',
          method: 'llm',
        },
      }),
    );
    const svc = new AgentsService(prisma, http, audit, usage, agentBilling);

    const res = await svc.compose(user, 'menga sotuv yordamchisi kerak', 'uz');

    expect(http.post).toHaveBeenCalledWith(
      'http://localhost:8000/agents/compose',
      expect.objectContaining({ description: 'menga sotuv yordamchisi kerak', language: 'uz' }),
    );
    expect(res.proposal).toEqual(
      expect.objectContaining({ name: 'Sotuv yordamchisi', systemPrompt: 'Sen sotuv agentisan' }),
    );
    expect(res.meta.vertical).toBe('retail');
    expect(res.price).toEqual(priceForAgent(2, 1, usdUzsRate()));
  });

  it('Halal Filter bloklasa (422) -> BadRequestException, tushunarli xato', async () => {
    const { prisma, http, audit, usage, agentBilling } = makeMock();
    http.post.mockReturnValue(
      throwError(() => ({ response: { status: 422, data: { detail: { message: "So'rovni qayta ifodalab ko'ring." } } } })),
    );
    const svc = new AgentsService(prisma, http, audit, usage, agentBilling);

    await expect(svc.compose(user, 'harom mahsulot sotish')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('engine bilan aloqa yo\'q -> ServiceUnavailableException', async () => {
    const { prisma, http, audit, usage, agentBilling } = makeMock();
    http.post.mockReturnValue(throwError(() => new Error('ECONNREFUSED')));
    const svc = new AgentsService(prisma, http, audit, usage, agentBilling);

    await expect(svc.compose(user, 'nimadir')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

/**
 * AgentsService.run — agentga xabar yuborish (haqiqiy AI-agent ishga
 * tushirish). Muzlatilgan agent to'lovni to'siydi, kunlik limit
 * (usage.consumeChat) LLM chaqiruvidan OLDIN tekshiriladi, Halal Filter
 * bloki va engine-down holatlari to'g'ri xatoga aylantiriladi.
 */
describe('AgentsService.run — agentni ishga tushirish (AI engine orqali)', () => {
  const agent = {
    id: 'agent1',
    userId: 'u1',
    frozen: false,
    name: 'Test agent',
    systemPrompt: 'Sen yordamchisan',
    model: 'claude-sonnet-4-6',
    toolsConfig: [],
    halalFilterEnabled: true,
    memoryEnabled: true,
  };

  it('agent muzlatilgan bo\'lsa -> 402, usage.consumeChat CHAQIRILMAYDI, engine\'ga chiqilmaydi', async () => {
    const { prisma, http, audit, usage, agentBilling } = makeMock();
    prisma.agent.findUnique.mockResolvedValue({ ...agent, frozen: true });
    const svc = new AgentsService(prisma, http, audit, usage, agentBilling);

    try {
      await svc.run('agent1', user, 'salom');
      throw new Error('402 kutilgan edi');
    } catch (e: any) {
      expect(e).toBeInstanceOf(HttpException);
      expect(e.getStatus()).toBe(402);
      expect(e.getResponse().reason).toBe('agent_frozen');
    }
    expect(usage.consumeChat).not.toHaveBeenCalled();
    expect(http.post).not.toHaveBeenCalled();
  });

  it('boshqa foydalanuvchining agenti -> ForbiddenException', async () => {
    const { prisma, http, audit, usage, agentBilling } = makeMock();
    prisma.agent.findUnique.mockResolvedValue({ ...agent, userId: 'boshqa-user' });
    const svc = new AgentsService(prisma, http, audit, usage, agentBilling);

    await expect(svc.run('agent1', user, 'salom')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('muvaffaqiyatli -> kunlik limit tekshiriladi, engine chaqiriladi, suhbat yaratilib xabarlar yoziladi', async () => {
    const { prisma, http, audit, usage, agentBilling } = makeMock();
    prisma.agent.findUnique.mockResolvedValue(agent);
    prisma.conversation.findUnique.mockResolvedValue({ id: 'conv1', messages: [] });
    http.post.mockReturnValue(
      of({ data: { messages: [{ role: 'assistant', content: 'Salom!' }], halal_flag: 'ok' } }),
    );
    const svc = new AgentsService(prisma, http, audit, usage, agentBilling);

    const res = await svc.run('agent1', user, 'salom');

    expect(usage.consumeChat).toHaveBeenCalledWith(user);
    expect(http.post).toHaveBeenCalledWith(
      'http://localhost:8000/agents/run',
      expect.objectContaining({ user_id: 'u1', message: 'salom' }),
    );
    expect(prisma.conversation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'u1', agentId: 'agent1' }) }),
    );
    expect(prisma.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'conv1' },
        data: expect.objectContaining({
          messages: [
            expect.objectContaining({ role: 'user', content: 'salom' }),
            expect.objectContaining({ role: 'assistant', content: 'Salom!', halalFlag: 'ok' }),
          ],
        }),
      }),
    );
    expect(res.conversationId).toBe('conv1');
  });

  it('mavjud conversationId berilsa -> yangi suhbat yaratilmaydi, mavjudiga qo\'shiladi', async () => {
    const { prisma, http, audit, usage, agentBilling } = makeMock();
    prisma.agent.findUnique.mockResolvedValue(agent);
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conv-existing',
      messages: [{ role: 'user', content: 'oldingi', timestamp: 't0' }],
    });
    http.post.mockReturnValue(of({ data: { messages: [{ content: 'Davom etamiz' }] } }));
    const svc = new AgentsService(prisma, http, audit, usage, agentBilling);

    const res = await svc.run('agent1', user, 'davom et', 'conv-existing');

    expect(prisma.conversation.create).not.toHaveBeenCalled();
    expect(res.conversationId).toBe('conv-existing');
    const updateCall = prisma.conversation.update.mock.calls[0][0];
    expect(updateCall.data.messages).toHaveLength(3); // oldingi + user + assistant
  });

  it('Halal Filter bloklasa (422) -> UnprocessableEntityException', async () => {
    const { prisma, http, audit, usage, agentBilling } = makeMock();
    prisma.agent.findUnique.mockResolvedValue(agent);
    http.post.mockReturnValue(
      throwError(() => ({ response: { status: 422, data: { detail: { blocked: true, reason: 'halal_filter' } } } })),
    );
    const svc = new AgentsService(prisma, http, audit, usage, agentBilling);

    await expect(svc.run('agent1', user, 'harom so\'rov')).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('engine bilan aloqa yo\'q -> BadGatewayException', async () => {
    const { prisma, http, audit, usage, agentBilling } = makeMock();
    prisma.agent.findUnique.mockResolvedValue(agent);
    http.post.mockReturnValue(throwError(() => new Error('ECONNREFUSED')));
    const svc = new AgentsService(prisma, http, audit, usage, agentBilling);

    await expect(svc.run('agent1', user, 'x')).rejects.toBeInstanceOf(BadGatewayException);
  });
});
