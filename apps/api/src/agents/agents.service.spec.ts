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
 * Y4: agent YARATISH bepul (activation'ni bo'g'masin — Pricing audit topilmasi:
 * avval har agent $15-60 turardi, foydalanuvchi qiymat ko'rmasdan to'lardi).
 * Faqat OYLIK narx bor; balans-yechish mexanizmi endi faqat priceOverride
 * bilan chaqirilganda ishlaydi (masalan pullik shablon/marketplace nusxasi).
 * Bu testlar tasdiqlaydi: (1) standart yaratish bepul va balansga tegmaydi,
 * (2) priceOverride bilan haqiqiy narx bo'lsa balans yetmasa YARATILMAYDI,
 * (3) bir xil so'rov ikki marta yuborilsa IKKINCHI marta yechilmaydi (idempotency).
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
      update: jest.fn(async (a: any) => a),
      // Atomik sinov-hisoblagichi (default: limitdan past, bitta qator o'zgardi)
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    creditLedger: {
      create: jest.fn(async (a: any) => ({ id: 'ledger1', ...a.data })),
      findUnique: jest.fn(async () => null),
    },
    conversation: {
      create: jest.fn(async (a: any) => ({ id: 'conv1', ...a.data })),
      findUnique: jest.fn(async () => ({ id: 'conv1', userId: 'u1' })),
      update: jest.fn(async (a: any) => a),
    },
    // A15: xabarlar endi Message jadvalida (mustaqil INSERT'lar)
    message: {
      create: jest.fn(async (a: any) => ({ id: 'm_' + Math.random().toString(36).slice(2), createdAt: new Date(), halalFlag: null, demoMode: false, ...a.data })),
    },
    $executeRaw: jest.fn(),
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  };
  const http = { post: jest.fn() } as any;
  const audit = { record: jest.fn(async () => {}) } as any;
  const usage = { assertCanCreateAgent: jest.fn(async () => {}), consumeChat: jest.fn(async () => {}) } as any;
  const agentBilling = { chargeOne: jest.fn(), resolveTrialEnd: jest.fn() } as any;
  // Prepaid billing — run() endi har LLM chaqiruvida balansdan yechadi.
  const billing = { chargeForMessage: jest.fn(async () => ({})), refund: jest.fn(async () => ({})) } as any;
  return { prisma, http, audit, usage, agentBilling, billing };
}

const user = { id: 'u1', balanceTiyin: 100_000_000n } as unknown as User;

const baseDto = {
  name: 'Test agent',
  systemPrompt: 'Sen yordamchisan',
  toolsConfig: [],
};

describe('AgentsService.create — haqiqiy pul yechish (avval faqat kalkulyator edi)', () => {
  it('standart yaratish (override yo\'q) -> BEPUL, balansga tegilmaydi, ledger yozilmaydi', async () => {
    const { prisma, http, audit, usage, agentBilling, billing } = makeMock();
    prisma.agent.create.mockResolvedValue({ id: 'agent1', ...baseDto });
    const svc = new AgentsService(prisma, http, audit, usage, agentBilling, billing);

    await svc.create(user, { ...baseDto, complexity: 5 } as any); // eng qimmat murakkablik ham bepul

    expect(prisma.user.updateMany).not.toHaveBeenCalled();
    expect(prisma.creditLedger.create).not.toHaveBeenCalled();
    expect(prisma.agent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ creationPriceTiyin: 0n }),
      }),
    );
  });

  it('priceOverride bilan (masalan pullik shablon) narx ATOMIK yechiladi, ledger yoziladi', async () => {
    const { prisma, http, audit, usage, agentBilling, billing } = makeMock();
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.findUniqueOrThrow.mockResolvedValue({ balanceTiyin: 50_000_000n });
    prisma.agent.create.mockResolvedValue({ id: 'agent1', ...baseDto });
    const svc = new AgentsService(prisma, http, audit, usage, agentBilling, billing);

    const fxRate = usdUzsRate();
    const priceOverride = { creationUsd: 30, monthlyUsd: 15 };
    // A13: servis narxni `bigint` tiyinda hisoblaydi — kutilma ham shunday.
    const expectedCreationTiyin = BigInt(Math.round(priceOverride.creationUsd * fxRate) * 100);

    await svc.create(user, baseDto as any, priceOverride);

    expect(prisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1', balanceTiyin: { gte: expectedCreationTiyin } },
        data: { balanceTiyin: { decrement: expectedCreationTiyin } },
      }),
    );
    expect(prisma.creditLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: 'agent_creation', amount: -expectedCreationTiyin }),
      }),
    );
  });

  it('priceOverride bilan balans yetarli emas -> 402, agent YARATILMAYDI, ledger yozilmaydi', async () => {
    const { prisma, http, audit, usage, agentBilling, billing } = makeMock();
    prisma.user.updateMany.mockResolvedValue({ count: 0 });
    const svc = new AgentsService(prisma, http, audit, usage, agentBilling, billing);

    try {
      await svc.create(user, baseDto as any, { creationUsd: 30, monthlyUsd: 15 });
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
    const { prisma, http, audit, usage, agentBilling, billing } = makeMock();
    usage.assertCanCreateAgent.mockRejectedValue(new ForbiddenException({ reason: 'agent_limit' }));
    const svc = new AgentsService(prisma, http, audit, usage, agentBilling, billing);

    await expect(svc.create(user, baseDto as any)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
    expect(prisma.agent.create).not.toHaveBeenCalled();
  });

  it('bir xil idempotencyKey bilan IKKINCHI so\'rov -> avvalgi agent qaytadi, IKKINCHI marta yechilmaydi', async () => {
    const { prisma, http, audit, usage, agentBilling, billing } = makeMock();
    // Birinchi so'rov allaqachon shu kalit bilan yozilgan (ledger + agent mavjud)
    prisma.creditLedger.findUnique.mockResolvedValue({ id: 'ledger1', meta: { agentId: 'agent1' } });
    prisma.agent.findUnique.mockResolvedValue({ id: 'agent1', ...baseDto });
    const svc = new AgentsService(prisma, http, audit, usage, agentBilling, billing);

    const res = await svc.create(user, { ...baseDto, idempotencyKey: 'key-1' } as any);

    expect(res).toEqual(expect.objectContaining({ id: 'agent1' }));
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
    expect(prisma.agent.create).not.toHaveBeenCalled();
    expect(prisma.creditLedger.create).not.toHaveBeenCalled();
  });

  it('parallel so\'rov bir xil kalit bilan g\'olib kelsa (unique constraint) -> g\'olibning agentini qaytaradi', async () => {
    const { prisma, http, audit, usage, agentBilling, billing } = makeMock();
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.findUniqueOrThrow.mockResolvedValue({ balanceTiyin: 50_000_000n });
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
    const svc = new AgentsService(prisma, http, audit, usage, agentBilling, billing);

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
    const { prisma, http, audit, usage, agentBilling, billing } = makeMock();
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
    const svc = new AgentsService(prisma, http, audit, usage, agentBilling, billing);

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
    const { prisma, http, audit, usage, agentBilling, billing } = makeMock();
    http.post.mockReturnValue(
      throwError(() => ({ response: { status: 422, data: { detail: { message: "So'rovni qayta ifodalab ko'ring." } } } })),
    );
    const svc = new AgentsService(prisma, http, audit, usage, agentBilling, billing);

    await expect(svc.compose(user, 'harom mahsulot sotish')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('engine bilan aloqa yo\'q -> ServiceUnavailableException', async () => {
    const { prisma, http, audit, usage, agentBilling, billing } = makeMock();
    http.post.mockReturnValue(throwError(() => new Error('ECONNREFUSED')));
    const svc = new AgentsService(prisma, http, audit, usage, agentBilling, billing);

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
    model: 'claude-sonnet-5',
    toolsConfig: [],
    halalFilterEnabled: true,
    memoryEnabled: true,
  };

  it('agent muzlatilgan bo\'lsa -> 402, usage.consumeChat CHAQIRILMAYDI, engine\'ga chiqilmaydi', async () => {
    const { prisma, http, audit, usage, agentBilling, billing } = makeMock();
    prisma.agent.findUnique.mockResolvedValue({ ...agent, frozen: true });
    const svc = new AgentsService(prisma, http, audit, usage, agentBilling, billing);

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
    const { prisma, http, audit, usage, agentBilling, billing } = makeMock();
    prisma.agent.findUnique.mockResolvedValue({ ...agent, userId: 'boshqa-user' });
    const svc = new AgentsService(prisma, http, audit, usage, agentBilling, billing);

    await expect(svc.run('agent1', user, 'salom')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('muvaffaqiyatli -> kunlik limit tekshiriladi, engine chaqiriladi, suhbat yaratilib xabarlar yoziladi', async () => {
    const { prisma, http, audit, usage, agentBilling, billing } = makeMock();
    prisma.agent.findUnique.mockResolvedValue(agent);
    prisma.conversation.findUnique.mockResolvedValue({ id: 'conv1', messages: [] });
    http.post.mockReturnValue(
      of({ data: { messages: [{ role: 'assistant', content: 'Salom!' }], halal_flag: 'ok' } }),
    );
    const svc = new AgentsService(prisma, http, audit, usage, agentBilling, billing);

    const res = await svc.run('agent1', user, 'salom');

    expect(usage.consumeChat).toHaveBeenCalledWith(user);
    expect(http.post).toHaveBeenCalledWith(
      'http://localhost:8000/agents/run',
      expect.objectContaining({ user_id: 'u1', message: 'salom' }),
    );
    expect(prisma.conversation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'u1', agentId: 'agent1' }) }),
    );
    // A15: juftlik ikkita mustaqil INSERT — tartib kiritilgan tartib.
    expect(prisma.message.create.mock.calls.map((c: any) => c[0].data)).toEqual([
      expect.objectContaining({ conversationId: 'conv1', role: 'user', content: 'salom' }),
      expect.objectContaining({ conversationId: 'conv1', role: 'assistant', content: 'Salom!', halalFlag: 'ok' }),
    ]);
    // Suhbat "oxirgi faollik" uchun faqat updatedAt bilan yangilanadi.
    expect(prisma.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'conv1' }, data: { updatedAt: expect.any(Date) } }),
    );
    expect(res.conversationId).toBe('conv1');
  });

  it('mavjud conversationId berilsa -> yangi suhbat yaratilmaydi, mavjudiga qo\'shiladi', async () => {
    const { prisma, http, audit, usage, agentBilling, billing } = makeMock();
    prisma.agent.findUnique.mockResolvedValue(agent);
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conv-existing',
      userId: 'u1', // egasi shu foydalanuvchi — IDOR tekshiruvidan o'tadi
    });
    http.post.mockReturnValue(of({ data: { messages: [{ content: 'Davom etamiz' }] } }));
    const svc = new AgentsService(prisma, http, audit, usage, agentBilling, billing);

    const res = await svc.run('agent1', user, 'davom et', 'conv-existing');

    expect(prisma.conversation.create).not.toHaveBeenCalled();
    expect(res.conversationId).toBe('conv-existing');
    // A15: mavjud tarix O'QILMAYDI (O(n) yo'qoldi) — faqat 2 yangi INSERT.
    expect(prisma.message.create).toHaveBeenCalledTimes(2);
    expect(prisma.message.create.mock.calls[1][0].data).toEqual(
      expect.objectContaining({ conversationId: 'conv-existing', role: 'assistant' }),
    );
  });

  it('Halal Filter bloklasa (422) -> UnprocessableEntityException', async () => {
    const { prisma, http, audit, usage, agentBilling, billing } = makeMock();
    prisma.agent.findUnique.mockResolvedValue(agent);
    http.post.mockReturnValue(
      throwError(() => ({ response: { status: 422, data: { detail: { blocked: true, reason: 'halal_filter' } } } })),
    );
    const svc = new AgentsService(prisma, http, audit, usage, agentBilling, billing);

    await expect(svc.run('agent1', user, 'harom so\'rov')).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('engine bilan aloqa yo\'q -> BadGatewayException', async () => {
    const { prisma, http, audit, usage, agentBilling, billing } = makeMock();
    prisma.agent.findUnique.mockResolvedValue(agent);
    http.post.mockReturnValue(throwError(() => new Error('ECONNREFUSED')));
    const svc = new AgentsService(prisma, http, audit, usage, agentBilling, billing);

    await expect(svc.run('agent1', user, 'x')).rejects.toBeInstanceOf(BadGatewayException);
  });

  // H1: `POST /agents/:id/run` (va Telegram bot) ilgari FAQAT consumeChat'ni
  // chaqirar, balansdan pul YECHMAS edi — bepul LLM (prepaid billing bypass).
  describe('AgentsService.run — prepaid billing (H1 bypass yopildi)', () => {
    it('muvaffaqiyatli ishlaganda balansdan pul yechiladi (chargeForMessage)', async () => {
      const { prisma, http, audit, usage, agentBilling, billing } = makeMock();
      prisma.agent.findUnique.mockResolvedValue(agent);
      http.post.mockReturnValue(of({ data: { messages: [{ content: 'ok' }] } }));
      const svc = new AgentsService(prisma, http, audit, usage, agentBilling, billing);

      await svc.run('agent1', user, 'salom');

      expect(billing.chargeForMessage).toHaveBeenCalledWith(user, expect.objectContaining({ agentId: 'agent1' }));
      expect(billing.refund).not.toHaveBeenCalled();
    });

    it('balans yetmasa (chargeForMessage 402) -> engine\'ga so\'rov KETMAYDI', async () => {
      const { prisma, http, audit, usage, agentBilling, billing } = makeMock();
      prisma.agent.findUnique.mockResolvedValue(agent);
      billing.chargeForMessage.mockRejectedValue(
        new HttpException({ reason: 'insufficient_balance' }, 402),
      );
      const svc = new AgentsService(prisma, http, audit, usage, agentBilling, billing);

      await expect(svc.run('agent1', user, 'salom')).rejects.toBeInstanceOf(HttpException);
      expect(http.post).not.toHaveBeenCalled();
      expect(billing.refund).not.toHaveBeenCalled(); // yechilmagan pul qaytarilmaydi
    });

    it('engine xatosi (yoki halal-blok) -> yechilgan pul QAYTARILADI (refund)', async () => {
      const { prisma, http, audit, usage, agentBilling, billing } = makeMock();
      prisma.agent.findUnique.mockResolvedValue(agent);
      http.post.mockReturnValue(throwError(() => new Error('ECONNREFUSED')));
      const svc = new AgentsService(prisma, http, audit, usage, agentBilling, billing);

      await expect(svc.run('agent1', user, 'x')).rejects.toBeInstanceOf(BadGatewayException);
      expect(billing.chargeForMessage).toHaveBeenCalled();
      expect(billing.refund).toHaveBeenCalledWith(user, 'agent_run_failed');
    });

    // M6: avval PUL, keyin RATE-LIMIT — kunlik/global limitga urilsa (429) pul
    // allaqachon yechilgani uchun QAYTARILADI, engine'ga so'rov ketmaydi.
    it('kunlik limit (consumeChat 429) charge\'dan KEYIN -> pul qaytariladi, engine\'ga chiqmaydi', async () => {
      const { prisma, http, audit, usage, agentBilling, billing } = makeMock();
      prisma.agent.findUnique.mockResolvedValue(agent);
      usage.consumeChat.mockRejectedValue(new HttpException({ reason: 'user_daily_cap' }, 429));
      const svc = new AgentsService(prisma, http, audit, usage, agentBilling, billing);

      await expect(svc.run('agent1', user, 'salom')).rejects.toBeInstanceOf(HttpException);
      expect(billing.chargeForMessage).toHaveBeenCalled(); // pul avval yechildi
      expect(billing.refund).toHaveBeenCalledWith(user, 'rate_limited'); // limit -> qaytarildi
      expect(http.post).not.toHaveBeenCalled();
    });
  });

  /**
   * Sinov (FAQAT birinchi agent): 20 xabar chegarasi shu yerda (3-kunlik
   * chegara — agent-billing.service.spec.ts'da, chunki u kunlik cron orqali
   * ishlaydi). resolveTrialEnd() ATOMIK charge-yoki-frozen qaror qabul qiladi;
   * bu testlar faqat run()ning o'sha qarorga to'g'ri munosabatini tekshiradi.
   */
  describe('AgentsService.run — sinov (20-xabar chegarasi)', () => {
    const trialAgent = { ...agent, isTrialAgent: true, trialStartedAt: new Date(), trialMessageCount: 5, monthlyPriceTiyin: 300_000n };

    it('limit ostida (5/20) -> trialMessageCount +1, resolveTrialEnd CHAQIRILMAYDI, xabar davom etadi', async () => {
      const { prisma, http, audit, usage, agentBilling, billing } = makeMock();
      prisma.agent.findUnique.mockResolvedValue(trialAgent);
      http.post.mockReturnValue(of({ data: { messages: [{ content: 'ok' }] } }));
      const svc = new AgentsService(prisma, http, audit, usage, agentBilling, billing);

      await svc.run('agent1', user, 'salom');

      expect(agentBilling.resolveTrialEnd).not.toHaveBeenCalled();
      expect(prisma.agent.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'agent1', trialMessageCount: { lt: 20 } }),
          data: { trialMessageCount: { increment: 1 } },
        }),
      );
      expect(http.post).toHaveBeenCalled(); // xabar baribir yuborildi
    });

    it('20-chi xabardan keyingi (limit oshdi) + balans yetarli -> resolveTrialEnd chaqiriladi, konvertatsiya bo\'lsa xabar DAVOM ETADI', async () => {
      const { prisma, http, audit, usage, agentBilling, billing } = makeMock();
      const atLimit = { ...trialAgent, trialMessageCount: 20 };
      prisma.agent.findUnique.mockResolvedValue(atLimit);
      prisma.agent.updateMany.mockResolvedValue({ count: 0 }); // limit to'ldi -> atomik bump 0 qator
      agentBilling.resolveTrialEnd.mockResolvedValue({ ...atLimit, isTrialAgent: false, frozen: false, frozenReason: null });
      http.post.mockReturnValue(of({ data: { messages: [{ content: 'ok' }] } }));
      const svc = new AgentsService(prisma, http, audit, usage, agentBilling, billing);

      const res = await svc.run('agent1', user, '21-chi xabar');

      expect(agentBilling.resolveTrialEnd).toHaveBeenCalledWith(atLimit, user);
      expect(http.post).toHaveBeenCalled(); // konvertatsiya muvaffaqiyatli -> xabar o'tadi
      expect(res).toBeDefined();
    });

    it('20-chi xabardan keyingi + balans YETARLI EMAS -> resolveTrialEnd muzlatadi, 402 trial_expired, engine\'ga CHIQILMAYDI', async () => {
      const { prisma, http, audit, usage, agentBilling, billing } = makeMock();
      const atLimit = { ...trialAgent, trialMessageCount: 20 };
      prisma.agent.findUnique.mockResolvedValue(atLimit);
      prisma.agent.updateMany.mockResolvedValue({ count: 0 }); // limit to'ldi -> atomik bump 0 qator
      agentBilling.resolveTrialEnd.mockResolvedValue({
        ...atLimit,
        isTrialAgent: false,
        frozen: true,
        frozenReason: 'trial_expired',
      });
      const svc = new AgentsService(prisma, http, audit, usage, agentBilling, billing);

      try {
        await svc.run('agent1', user, '21-chi xabar');
        throw new Error('402 kutilgan edi');
      } catch (e: any) {
        expect(e).toBeInstanceOf(HttpException);
        expect(e.getStatus()).toBe(402);
        expect(e.getResponse().reason).toBe('trial_expired');
        expect(e.getResponse().message).toContain('sinov');
      }
      expect(http.post).not.toHaveBeenCalled();
      expect(usage.consumeChat).not.toHaveBeenCalled();
    });
  });
});
