import { HttpException } from '@nestjs/common';
import { of } from 'rxjs';
import { AgentsService } from './agents.service';
import { UsageService } from '../usage/usage.service';
import type { User } from '@prisma/client';

/**
 * BLOK A (sinov limiti) va BLOK B (Pro/Max/Enterprise platforma obunasi)
 * BIR-BIRIGA ARALASHMASLIGINI tasdiqlovchi izolyatsiya testi.
 *
 * Talab (foydalanuvchidan): "Pro obunasi bo'lmagan foydalanuvchi baribir
 * do'kon-agentini yarata olishini tasdiqlang."
 *
 * Bu yerda MOCK emas, HAQIQIY UsageService instansiyasi ishlatiladi — shu
 * bilan "agent yaratish/ishlatish platformPlan'ni umuman TEKSHIRMAYDI" degan
 * da'vo test-o'tkazish darajasida (kod-o'qish emas) isbotlanadi: agar kimdir
 * kelajakda agents.service.ts'ga chalkashlik bilan platformPlan tekshiruvi
 * qo'shib qo'ysa, bu test DARHOL qizarardi.
 */

function makeMock() {
  const prisma: any = {
    user: { updateMany: jest.fn(), findUniqueOrThrow: jest.fn() },
    agent: {
      count: jest.fn(async () => 0),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(async (a: any) => a),
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

  // HAQIQIY UsageService — Block B'ning consumePlatformFeature'i ham shu
  // klassda, shuning uchun "chaqirilmadi" degan da'vo spy bilan tekshiriladi.
  const usagePrisma: any = {
    usageCounter: {
      upsert: jest.fn(async () => ({ count: 1 })),
      updateMany: jest.fn(async () => ({ count: 1 })),
      findUnique: jest.fn(async () => null),
    },
    agent: { count: jest.fn(async () => 0) },
  };
  const usage = new UsageService(usagePrisma);
  const agentBilling = { chargeOne: jest.fn(), resolveTrialEnd: jest.fn() } as any;
  return { prisma, http, audit, usage, agentBilling };
}

// Block B'da HECH QANDAY platforma-obunasi yo'q (eng qattiq holat).
const noSubscriptionUser = {
  id: 'u1',
  balanceTiyin: 100_000_000,
  plan: 'free',
  proUntil: null,
  platformPlan: 'none',
  platformPlanUntil: null,
  platformPlanFrozen: false,
} as unknown as User;

describe('BLOK A/B izolyatsiyasi — platforma obunasi vertikal agentlarga TA\'SIR QILMAYDI', () => {
  it("obunasiz foydalanuvchi do'kon-agentini (vertikal, retail) MUVAFFAQIYATLI yaratadi", async () => {
    const { prisma, http, audit, usage, agentBilling } = makeMock();
    prisma.agent.create.mockResolvedValue({ id: 'agent1', name: "Do'kon agenti", vertical: 'retail' });
    const svc = new AgentsService(prisma, http, audit, usage, agentBilling);

    const agent = await svc.create(noSubscriptionUser, {
      name: "Do'kon agenti",
      systemPrompt: "Sen do'kon yordamchisisan — tovar hisobini yuritasan.",
      toolsConfig: [],
      vertical: 'retail',
    } as any);

    expect(agent).toEqual(expect.objectContaining({ id: 'agent1', vertical: 'retail' }));
    expect(prisma.agent.create).toHaveBeenCalled();
  });

  it('obunasiz foydalanuvchi shu agent bilan MUVAFFAQIYATLI suhbatlashadi — consumeChat ishlaydi, consumePlatformFeature UMUMAN CHAQIRILMAYDI', async () => {
    const { prisma, http, audit, usage, agentBilling } = makeMock();
    const platformFeatureSpy = jest.spyOn(usage, 'consumePlatformFeature');
    prisma.agent.findUnique.mockResolvedValue({
      id: 'agent1',
      userId: 'u1',
      frozen: false,
      isTrialAgent: false,
      name: "Do'kon agenti",
      systemPrompt: 'p',
      model: 'claude-sonnet-4-6',
      toolsConfig: [],
      halalFilterEnabled: true,
      memoryEnabled: true,
    });
    http.post.mockReturnValue(of({ data: { messages: [{ content: 'Salom! Qanday yordam bera olaman?' }] } }));
    const svc = new AgentsService(prisma, http, audit, usage, agentBilling);

    const res = await svc.run('agent1', noSubscriptionUser, "Tovar qoldig'i qancha?");

    expect(res.conversationId).toBe('conv1');
    expect(http.post).toHaveBeenCalled(); // agent haqiqatan ishladi
    expect(platformFeatureSpy).not.toHaveBeenCalled(); // Block B mexanizmi bu yo'lda IZ QOLDIRMAYDI
  });

  it("SHU BIR XIL foydalanuvchi Twin/Fusion kabi platforma-funksiyaga to'g'ridan-to'g'ri murojaat qilsa -> 402 (lekin bu yuqoridagi vertikal-agent oqimiga hech qanday aloqasi yo'q)", async () => {
    const { usage } = makeMock();

    try {
      await usage.consumePlatformFeature(noSubscriptionUser);
      throw new Error('402 kutilgan edi');
    } catch (e: any) {
      expect(e).toBeInstanceOf(HttpException);
      expect(e.getStatus()).toBe(402);
      expect(e.getResponse().reason).toBe('platform_subscription_required');
    }
  });

  it("agent yaratish/ishlatish User.platformPlan maydonini UMUMAN o'qimaydi (real UsageService bilan — 'none' bo'lsa ham hech narsa yiqilmaydi)", async () => {
    const { prisma, http, audit, usage, agentBilling } = makeMock();
    prisma.agent.findUnique.mockResolvedValue({
      id: 'agent1', userId: 'u1', frozen: false, isTrialAgent: false,
      name: 'X', systemPrompt: 'p', model: 'claude-sonnet-4-6',
      toolsConfig: [], halalFilterEnabled: true, memoryEnabled: true,
    });
    http.post.mockReturnValue(of({ data: { messages: [{ content: 'ok' }] } }));
    const svc = new AgentsService(prisma, http, audit, usage, agentBilling);

    // platformPlanFrozen: true HAM bo'lsa (eng yomon holat) — vertikal agent baribir ishlashi kerak
    const frozenPlatformUser = { ...noSubscriptionUser, platformPlan: 'pro', platformPlanFrozen: true } as unknown as User;
    await expect(svc.run('agent1', frozenPlatformUser, 'salom')).resolves.toBeDefined();
  });
});
