import { HttpException, HttpStatus } from '@nestjs/common';
import { TwinService } from './twin.service';
import { of } from 'rxjs';
import type { User } from '@prisma/client';

/**
 * TwinService — platforma-obunasi gate'i (usage.consumePlatformFeature)
 * FAQAT LLM chaqiruvchi/foydalanuvchi-tomon yo'llarda (whatIf, extract manual)
 * chaqirilishini tekshiradi. MUHIM: source='conversation' (fon-rejimdagi
 * fakt-ajratish hook'i, HAR bir suhbatda — vertikal agentlar ham) GATING
 * QILINMAYDI, aks holda vertikal agentlar obunaga qaram bo'lib qolardi.
 */

function makeMock() {
  const prisma: any = {
    twinFact: { findMany: jest.fn(async () => []), findFirst: jest.fn(async () => null), create: jest.fn(async (a: any) => ({ id: 'f1', ...a.data })) },
  };
  const http = { post: jest.fn() } as any;
  const audit = { record: jest.fn(async () => {}) } as any;
  const usage = { consumePlatformFeature: jest.fn(async () => ({ remaining: 10, plan: 'pro' })) } as any;
  return { prisma, http, audit, usage };
}

const user = { id: 'u1', preferredLanguage: 'uz', goals: [], professionTitle: '' } as unknown as User;

describe('TwinService — platforma-obunasi gate joylashuvi', () => {
  it('whatIf -> consumePlatformFeature CHAQIRILADI (umumiy platforma-funksiya)', async () => {
    const { prisma, http, audit, usage } = makeMock();
    http.post.mockReturnValue(of({ data: { answer: 'ok', method: 'llm' } }));
    const svc = new TwinService(prisma, http, audit, usage);

    await svc.whatIf(user, 'agar men ...bo\'lsa nima bo\'ladi?');

    expect(usage.consumePlatformFeature).toHaveBeenCalledWith(user);
  });

  it('extractAndStore source="manual" -> consumePlatformFeature CHAQIRILADI', async () => {
    const { prisma, http, audit, usage } = makeMock();
    http.post.mockReturnValue(of({ data: { facts: [], method: 'llm' } }));
    const svc = new TwinService(prisma, http, audit, usage);

    await svc.extractAndStore(user, 'matn', 'manual');

    expect(usage.consumePlatformFeature).toHaveBeenCalledWith(user);
  });

  it('extractAndStore source="conversation" (fon-hook, HAR suhbatda) -> consumePlatformFeature CHAQIRILMAYDI', async () => {
    const { prisma, http, audit, usage } = makeMock();
    http.post.mockReturnValue(of({ data: { facts: [], method: 'llm' } }));
    const svc = new TwinService(prisma, http, audit, usage);

    await svc.extractAndStore(user, 'suhbat matni', 'conversation');

    expect(usage.consumePlatformFeature).not.toHaveBeenCalled();
  });

  it('whatIf: obuna yo\'q bo\'lsa (402) -> engine\'ga CHIQILMAYDI', async () => {
    const { prisma, http, audit, usage } = makeMock();
    usage.consumePlatformFeature.mockRejectedValue(
      new HttpException({ reason: 'platform_subscription_required' }, HttpStatus.PAYMENT_REQUIRED),
    );
    const svc = new TwinService(prisma, http, audit, usage);

    await expect(svc.whatIf(user, 'savol')).rejects.toThrow();
    expect(http.post).not.toHaveBeenCalled();
  });
});
