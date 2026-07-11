import { HttpException, HttpStatus } from '@nestjs/common';
import { of } from 'rxjs';
import { IntelligenceService } from './intelligence.service';
import type { User } from '@prisma/client';

/**
 * IntelligenceService — Fusion/Ethics/Knowledge/Supermode HAMMASI platforma-
 * obunasi gate'i (usage.consumePlatformFeature) ostida, chunki bularning
 * hech biri boshqa joydan (masalan vertikal agent konveyeridan) fon-rejimida
 * chaqirilmaydi — faqat shu servisning o'z endpointlari orqali (tekshirilgan:
 * boshqa hech qanday caller yo'q). fusionRoles (katalog, LLM emas) esa GATING
 * QILINMAYDI.
 */

function makeMock() {
  const prisma: any = { goal: { findMany: jest.fn(async () => []) } };
  const http = { post: jest.fn(), get: jest.fn() } as any;
  const audit = { record: jest.fn(async () => {}) } as any;
  const twin = { factsForEngine: jest.fn(async () => []) } as any;
  const usage = { consumePlatformFeature: jest.fn(async () => ({ remaining: 10, plan: 'pro' })) } as any;
  return { prisma, http, audit, twin, usage };
}

const user = { id: 'u1', preferredLanguage: 'uz', professionTitle: '', valuesProfile: null, city: 'Tashkent' } as unknown as User;

describe('IntelligenceService — platforma-obunasi gate har bir LLM-metodda', () => {
  it('fusion -> consumePlatformFeature CHAQIRILADI', async () => {
    const { prisma, http, audit, twin, usage } = makeMock();
    http.post.mockReturnValue(of({ data: { roles: [], method: 'llm' } }));
    const svc = new IntelligenceService(prisma, http, audit, twin, usage);

    await svc.fusion(user, 'muammo');

    expect(usage.consumePlatformFeature).toHaveBeenCalledWith(user);
  });

  it('ethicsEvaluate -> consumePlatformFeature CHAQIRILADI', async () => {
    const { prisma, http, audit, twin, usage } = makeMock();
    http.post.mockReturnValue(of({ data: { verdict: 'ok', method: 'llm' } }));
    const svc = new IntelligenceService(prisma, http, audit, twin, usage);

    await svc.ethicsEvaluate(user, 'harakat');

    expect(usage.consumePlatformFeature).toHaveBeenCalledWith(user);
  });

  it('knowledgeSearch -> consumePlatformFeature CHAQIRILADI', async () => {
    const { prisma, http, audit, twin, usage } = makeMock();
    http.post.mockReturnValue(of({ data: {} }));
    const svc = new IntelligenceService(prisma, http, audit, twin, usage);

    await svc.knowledgeSearch(user, 'so\'rov');

    expect(usage.consumePlatformFeature).toHaveBeenCalledWith(user);
  });

  it('superMode -> consumePlatformFeature CHAQIRILADI', async () => {
    const { prisma, http, audit, twin, usage } = makeMock();
    http.post.mockReturnValue(of({ data: { stages: [], method: 'llm' } }));
    const svc = new IntelligenceService(prisma, http, audit, twin, usage);

    await svc.superMode(user, 'buyruq');

    expect(usage.consumePlatformFeature).toHaveBeenCalledWith(user);
  });

  it('fusionRoles (katalog, LLM emas) -> consumePlatformFeature CHAQIRILMAYDI', async () => {
    const { prisma, http, audit, twin, usage } = makeMock();
    http.get.mockReturnValue(of({ data: { roles: [] } }));
    const svc = new IntelligenceService(prisma, http, audit, twin, usage);

    await svc.fusionRoles(user);

    expect(usage.consumePlatformFeature).not.toHaveBeenCalled();
  });

  it('fusion: obuna yo\'q bo\'lsa (402) -> engine\'ga CHIQILMAYDI', async () => {
    const { prisma, http, audit, twin, usage } = makeMock();
    usage.consumePlatformFeature.mockRejectedValue(
      new HttpException({ reason: 'platform_subscription_required' }, HttpStatus.PAYMENT_REQUIRED),
    );
    const svc = new IntelligenceService(prisma, http, audit, twin, usage);

    await expect(svc.fusion(user, 'muammo')).rejects.toThrow();
    expect(http.post).not.toHaveBeenCalled();
  });
});
