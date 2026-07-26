import { ForbiddenException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { OnboardingService } from './onboarding.service';
import type { User } from '@prisma/client';
import type { OnboardingDto, InstallRecommendationsDto } from './dto/onboarding.dto';

/**
 * OnboardingService — /role/detect engine oqimi (halal-block vs engine-down),
 * 2FA sirlarining javobdan chiqarilishi, va Y-chegara: installRecommendations
 * AgentsService.create'ni chetlab o'tmasligi (har agent uchun assertCanCreateAgent
 * bir xil lock ostida chaqirilishi SHART — aks holda free-tarif 5-agent
 * chegarasi cheksiz buzilishi mumkin edi).
 */

function baseUser(overrides: Record<string, any> = {}) {
  return {
    id: 'u1',
    domain: null,
    preferredLanguage: 'uz',
    twoFactorSecret: 'SECRET',
    twoFactorSecretPending: 'PENDING',
    ...overrides,
  } as unknown as User;
}

function makeMock() {
  const prisma: any = {
    user: { update: jest.fn(async (a: any) => ({ ...baseUser(), ...a.data })) },
    agent: { findMany: jest.fn(async () => []), findFirst: jest.fn(async () => null), create: jest.fn(async (a: any) => ({ id: `a-${Math.random()}`, ...a.data })) },
    $executeRaw: jest.fn(),
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  };
  const http = { get: jest.fn(), post: jest.fn() } as any;
  const audit = { record: jest.fn(async () => {}) } as any;
  const twin = { addFact: jest.fn(async () => {}), extractAndStore: jest.fn(async () => {}) } as any;
  const usage = { assertCanCreateAgent: jest.fn(async () => {}) } as any;
  return { prisma, http, audit, twin, usage };
}

describe('OnboardingService.completeOnboarding', () => {
  it("muvaffaqiyatli tanish -> profil saqlanadi, twin urug'lanadi, 2FA sirlari javobda YO'Q", async () => {
    const { prisma, http, audit, twin, usage } = makeMock();
    http.post.mockReturnValue(
      of({
        data: {
          profession_title: "Do'kon egasi",
          domain: 'retail',
          domain_label: 'Retail',
          confidence: 0.9,
          goals: ['savdoni oshirish'],
          reasoning: 'chunki...',
          method: 'llm',
          dashboard: { widgets: ['stock'], quick_actions: ['reorder'] },
        },
      }),
    );
    const svc = new OnboardingService(prisma, http, audit, twin, usage);
    const dto: OnboardingDto = { text: "Men do'kon egasiman", language: 'uz', city: 'Toshkent' } as any;

    const res = await svc.completeOnboarding(baseUser(), dto);

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ professionTitle: "Do'kon egasi", domain: 'retail', onboardingCompleted: true, city: 'Toshkent' }),
      }),
    );
    expect(twin.addFact).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ label: 'Kasb', value: "Do'kon egasi" }));
    expect(twin.addFact).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ label: 'Shahar', value: 'Toshkent' }));
    expect(twin.extractAndStore).toHaveBeenCalledWith(expect.anything(), dto.text, 'conversation');
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'onboarding.complete' }));
    expect(res.user).not.toHaveProperty('twoFactorSecret');
    expect(res.user).not.toHaveProperty('twoFactorSecretPending');
  });

  it("noma'lum kasb nomi ('Not specified') -> Kasb fakti QO'SHILMAYDI", async () => {
    const { prisma, http, audit, twin, usage } = makeMock();
    http.post.mockReturnValue(
      of({ data: { profession_title: 'Not specified', domain: 'general', confidence: 0.2, method: 'heuristic' } }),
    );
    const svc = new OnboardingService(prisma, http, audit, twin, usage);

    await svc.completeOnboarding(baseUser(), { text: 'xxx', language: 'uz' } as any);

    expect(twin.addFact).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ label: 'Kasb' }));
  });

  it('twin urug\'lash xato bersa ham onboarding muvaffaqiyatli yakunlanadi', async () => {
    const { prisma, http, audit, twin, usage } = makeMock();
    http.post.mockReturnValue(of({ data: { profession_title: 'Haydovchi', domain: 'transport', confidence: 0.8, method: 'llm' } }));
    twin.addFact.mockRejectedValue(new Error('twin DB xatosi'));
    const svc = new OnboardingService(prisma, http, audit, twin, usage);

    await expect(svc.completeOnboarding(baseUser(), { text: 'men haydovchiman', language: 'uz' } as any)).resolves.toBeDefined();
  });

  it('engine 422 halal-block -> UnprocessableEntityException + audit halal_block, DB yozilmaydi', async () => {
    const { prisma, http, audit, twin, usage } = makeMock();
    http.post.mockReturnValue(
      throwError(() => ({ response: { status: 422, data: { detail: { blocked: true, reason: 'illegal_content' } } } })),
    );
    const svc = new OnboardingService(prisma, http, audit, twin, usage);

    await expect(svc.completeOnboarding(baseUser(), { text: 'xxx', language: 'uz' } as any)).rejects.toMatchObject({ status: 422 });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'onboarding.halal_block' }));
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('engine mavjud emas -> BadGatewayException (502)', async () => {
    const { prisma, http, audit, twin, usage } = makeMock();
    http.post.mockReturnValue(throwError(() => ({ message: 'ECONNREFUSED' })));
    const svc = new OnboardingService(prisma, http, audit, twin, usage);

    await expect(svc.completeOnboarding(baseUser(), { text: 'xxx', language: 'uz' } as any)).rejects.toMatchObject({ status: 502 });
  });
});

describe('OnboardingService.getRecommendations', () => {
  it('mavjud agentlarni nomi bo\'yicha installed=true deb belgilaydi', async () => {
    const { prisma, http, audit, twin, usage } = makeMock();
    prisma.agent.findMany.mockResolvedValue([{ name: "Do'kon yordamchisi" }]);
    http.get.mockReturnValue(
      of({
        data: {
          recommended_agents: [
            { name: { uz: "Do'kon yordamchisi", en: 'Shop assistant' } },
            { name: { uz: 'Yangi agent', en: 'New agent' } },
          ],
        },
      }),
    );
    const svc = new OnboardingService(prisma, http, audit, twin, usage);

    const res = await svc.getRecommendations(baseUser({ domain: 'retail' }));

    expect(res.recommended_agents[0].installed).toBe(true);
    expect(res.recommended_agents[1].installed).toBe(false);
  });

  it("engine mavjud emas -> BadGatewayException", async () => {
    const { prisma, http, audit, twin, usage } = makeMock();
    http.get.mockReturnValue(throwError(() => new Error('timeout')));
    const svc = new OnboardingService(prisma, http, audit, twin, usage);

    await expect(svc.getRecommendations(baseUser())).rejects.toMatchObject({ status: 502 });
  });
});

describe("OnboardingService.installRecommendations — Y-chegara (5-agent) CHETLAB O'TILMAYDI", () => {
  it('har yangi agent uchun assertCanCreateAgent SHU BIR XIL lock ostida chaqiriladi', async () => {
    const { prisma, http, audit, twin, usage } = makeMock();
    const svc = new OnboardingService(prisma, http, audit, twin, usage);
    const dto: InstallRecommendationsDto = {
      agents: [
        { name: 'Agent 1', systemPrompt: 'p1', toolsConfig: [] },
        { name: 'Agent 2', systemPrompt: 'p2', toolsConfig: [] },
      ],
    } as any;

    const res = await svc.installRecommendations(baseUser(), dto);

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1); // advisory lock — bitta transaksiyada
    expect(usage.assertCanCreateAgent).toHaveBeenCalledTimes(2); // HAR agent uchun
    expect(res.agents).toHaveLength(2);
    expect(res.agents.every((a: any) => !a.alreadyExisted)).toBe(true);
    expect(audit.record).toHaveBeenCalledTimes(2);
  });

  it("chegara tugagan bo'lsa (assertCanCreateAgent rad etadi) -> butun partiya to'xtaydi, xech biri yaratilmaydi", async () => {
    const { prisma, http, audit, twin, usage } = makeMock();
    usage.assertCanCreateAgent.mockRejectedValue(new ForbiddenException({ reason: 'agent_limit' }));
    const svc = new OnboardingService(prisma, http, audit, twin, usage);
    const dto: InstallRecommendationsDto = { agents: [{ name: 'Agent 1', systemPrompt: 'p1', toolsConfig: [] }] } as any;

    await expect(svc.installRecommendations(baseUser(), dto)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.agent.create).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("nomi bo'yicha allaqachon mavjud agent -> qayta yaratilmaydi va chegara tekshiruvidan O'TKAZILMAYDI (alreadyExisted: true)", async () => {
    const { prisma, http, audit, twin, usage } = makeMock();
    prisma.agent.findFirst.mockResolvedValue({ id: 'existing-1', name: 'Agent 1' });
    const svc = new OnboardingService(prisma, http, audit, twin, usage);
    const dto: InstallRecommendationsDto = { agents: [{ name: 'Agent 1', systemPrompt: 'p1', toolsConfig: [] }] } as any;

    const res = await svc.installRecommendations(baseUser(), dto);

    expect(res.agents).toEqual([{ id: 'existing-1', name: 'Agent 1', alreadyExisted: true }]);
    expect(usage.assertCanCreateAgent).not.toHaveBeenCalled();
    expect(prisma.agent.create).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled(); // mavjud agent uchun audit yozilmaydi
  });

  it("domain -> vertical compliance pack avtomatik biriktiriladi", async () => {
    const { prisma, http, audit, twin, usage } = makeMock();
    const svc = new OnboardingService(prisma, http, audit, twin, usage);
    const dto: InstallRecommendationsDto = { agents: [{ name: 'Agent 1', systemPrompt: 'p1', toolsConfig: [] }] } as any;

    await svc.installRecommendations(baseUser({ domain: 'healthcare' }), dto);

    expect(prisma.agent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ vertical: 'healthcare' }) }));
  });
});
