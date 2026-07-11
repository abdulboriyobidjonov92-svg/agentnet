import { HttpException, ForbiddenException } from '@nestjs/common';
import { UsageService } from './usage.service';
import type { User } from '@prisma/client';

// UsageCounter'ni xotirada modellashtiruvchi mock Prisma.
// upsert (bumpReturning) va updateMany (decrement) atomik hisoblagichni taqlid qiladi.
function counterKey(where: any): string {
  const w = where.userId_day_kind ?? where;
  return `${w.userId}|${w.day}|${w.kind}`;
}

function makeMockPrisma(store: Map<string, number>, agentCount = 0) {
  return {
    usageCounter: {
      upsert: jest.fn(async ({ where }: any) => {
        const k = counterKey(where);
        const next = (store.get(k) ?? 0) + 1;
        store.set(k, next);
        return { count: next };
      }),
      updateMany: jest.fn(async ({ where }: any) => {
        const k = counterKey(where);
        store.set(k, Math.max(0, (store.get(k) ?? 0) - 1));
        return { count: 1 };
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        const k = counterKey(where);
        return store.has(k) ? { count: store.get(k) } : null;
      }),
    },
    agent: { count: jest.fn(async () => agentCount) },
  };
}

const freeUser = { id: 'u1', plan: 'free', proUntil: null } as unknown as User;
const today = new Date().toISOString().slice(0, 10);

describe('UsageService.consumeChat (atomik limit — race yo\'q)', () => {
  beforeEach(() => {
    process.env.USAGE_FREE_CHAT_PER_DAY = '2';
    process.env.USAGE_GLOBAL_LLM_PER_DAY = '100';
    process.env.USAGE_GLOBAL_LLM_ALERT = '99';
  });

  it('limit ichida -> qolgan kvota qaytadi, xato yo\'q', async () => {
    const store = new Map<string, number>();
    const svc = new UsageService(makeMockPrisma(store) as any);
    const res = await svc.consumeChat(freeUser);
    expect(res).toEqual({ remaining: 1, plan: 'free' });
    expect(store.get(`u1|${today}|chat`)).toBe(1);
  });

  it('user kunlik limit oshsa -> 429 + ikkala hisob kompensatsiya qilinadi', async () => {
    const store = new Map<string, number>();
    const prisma = makeMockPrisma(store);
    const svc = new UsageService(prisma as any);

    await svc.consumeChat(freeUser); // 1/2
    await svc.consumeChat(freeUser); // 2/2
    prisma.usageCounter.updateMany.mockClear();

    // 3-chi so'rov limitdan oshadi
    await expect(svc.consumeChat(freeUser)).rejects.toBeInstanceOf(HttpException);
    try {
      await svc.consumeChat(freeUser);
    } catch (e: any) {
      expect(e.getResponse().reason).toBe('user_daily_cap');
    }
    // Kompensatsiya: hisoblar limitda qoladi (minusga tushmaydi, oshib ketmaydi)
    expect(store.get(`u1|${today}|chat`)).toBe(2);
    expect(store.get(`_global|${today}|llm`)).toBe(2);
  });

  it('global kunlik cap oshsa -> 429 global; user hisobi oshmaydi', async () => {
    process.env.USAGE_GLOBAL_LLM_PER_DAY = '1';
    process.env.USAGE_FREE_CHAT_PER_DAY = '100';
    const store = new Map<string, number>();
    const svc = new UsageService(makeMockPrisma(store) as any);

    await svc.consumeChat(freeUser); // global 1/1 ok
    try {
      await svc.consumeChat(freeUser); // global 2 > 1 -> reject
      throw new Error('kutilgan xato tashlanmadi');
    } catch (e: any) {
      expect(e.getResponse().reason).toBe('global_daily_cap');
    }
    // global kompensatsiya qilindi (1), user esa 2-chi so'rovda umuman oshmadi (1)
    expect(store.get(`_global|${today}|llm`)).toBe(1);
    expect(store.get(`u1|${today}|chat`)).toBe(1);
  });
});

/**
 * UsageService.consumePlatformFeature — Pro/Max/Enterprise platforma-obunasi
 * gate'i (Twin/Fusion/Supermode/Ethics/Knowledge). PER-AGENT `consumeChat`dan
 * ALOHIDA hisoblagich ('platform_chat' kind) — ikkalasi bir-biriga
 * ARALASHMASLIGI shart (buni isolation testida ham tekshiramiz).
 */
describe('UsageService.consumePlatformFeature', () => {
  beforeEach(() => {
    process.env.PLATFORM_PRO_CHAT_PER_DAY = '2';
    process.env.PLATFORM_MAX_CHAT_PER_DAY = '5';
  });

  function makeUser(overrides: Record<string, any> = {}): User {
    return { id: 'u1', plan: 'free', proUntil: null, platformPlan: 'none', platformPlanUntil: null, platformPlanFrozen: false, ...overrides } as unknown as User;
  }

  it('obunasi yo\'q ("none") -> 402 platform_subscription_required, hisoblagichga tegilmaydi', async () => {
    const store = new Map<string, number>();
    const svc = new UsageService(makeMockPrisma(store) as any);

    try {
      await svc.consumePlatformFeature(makeUser());
      throw new Error('402 kutilgan edi');
    } catch (e: any) {
      expect(e).toBeInstanceOf(HttpException);
      expect(e.getStatus()).toBe(402);
      expect(e.getResponse().reason).toBe('platform_subscription_required');
    }
    expect(store.size).toBe(0);
  });

  it('muzlatilgan obuna (platformPlanFrozen) -> 402, rawPlan nima bo\'lishidan qat\'i nazar', async () => {
    const store = new Map<string, number>();
    const svc = new UsageService(makeMockPrisma(store) as any);
    const user = makeUser({ platformPlan: 'pro', platformPlanUntil: new Date(Date.now() + 999_999), platformPlanFrozen: true });

    await expect(svc.consumePlatformFeature(user)).rejects.toBeInstanceOf(HttpException);
  });

  it('Pro -> kunlik limit (2) ichida ishlaydi, oshsa 429 platform_daily_cap', async () => {
    const store = new Map<string, number>();
    const svc = new UsageService(makeMockPrisma(store) as any);
    const user = makeUser({ platformPlan: 'pro', platformPlanUntil: new Date(Date.now() + 999_999) });

    const r1 = await svc.consumePlatformFeature(user);
    expect(r1).toEqual({ remaining: 1, plan: 'pro' });
    await svc.consumePlatformFeature(user); // 2/2

    try {
      await svc.consumePlatformFeature(user);
      throw new Error('429 kutilgan edi');
    } catch (e: any) {
      expect(e.getResponse().reason).toBe('platform_daily_cap');
      expect(e.getResponse().plan).toBe('pro');
      expect(e.getResponse().limit).toBe(2);
    }
    // kompensatsiya — limitdan oshmaydi
    expect(store.get(`u1|${today}|platform_chat`)).toBe(2);
  });

  it('Max -> Pro\'dan KENGROQ limit (5), Pro limitidan (2) ko\'p bo\'lsa ham o\'tadi', async () => {
    const store = new Map<string, number>();
    const svc = new UsageService(makeMockPrisma(store) as any);
    const user = makeUser({ platformPlan: 'max', platformPlanUntil: new Date(Date.now() + 999_999) });

    for (let i = 0; i < 5; i++) {
      await expect(svc.consumePlatformFeature(user)).resolves.toBeDefined();
    }
    await expect(svc.consumePlatformFeature(user)).rejects.toBeInstanceOf(HttpException);
  });

  it('Enterprise -> cheksiz, hisoblagichga UMUMAN tegilmaydi (limit=null)', async () => {
    const store = new Map<string, number>();
    const svc = new UsageService(makeMockPrisma(store) as any);
    const user = makeUser({ platformPlan: 'enterprise', platformPlanUntil: new Date(Date.now() + 999_999) });

    const res = await svc.consumePlatformFeature(user);
    expect(res).toEqual({ remaining: null, plan: 'enterprise' });
    expect(store.size).toBe(0); // hech qanday hisoblagich yozilmadi
  });

  it('muddati o\'tgan obuna (lazy-expiry, cron hali ulgurmagan) -> 402ga qaytadi', async () => {
    const store = new Map<string, number>();
    const svc = new UsageService(makeMockPrisma(store) as any);
    const user = makeUser({ platformPlan: 'pro', platformPlanUntil: new Date(Date.now() - 1000) });

    await expect(svc.consumePlatformFeature(user)).rejects.toBeInstanceOf(HttpException);
  });

  it("consumeChat'ning hisoblagichi ('chat' kind) platform_chat'dan ALOHIDA — bir-biriga ta'sir qilmaydi", async () => {
    process.env.USAGE_FREE_CHAT_PER_DAY = '2';
    process.env.USAGE_GLOBAL_LLM_PER_DAY = '100';
    const store = new Map<string, number>();
    const svc = new UsageService(makeMockPrisma(store) as any);
    const proUser = makeUser({ platformPlan: 'pro', platformPlanUntil: new Date(Date.now() + 999_999) });

    await svc.consumeChat(proUser); // 'chat' kind
    await svc.consumePlatformFeature(proUser); // 'platform_chat' kind — mustaqil hisoblagich

    expect(store.get(`u1|${today}|chat`)).toBe(1);
    expect(store.get(`u1|${today}|platform_chat`)).toBe(1);
  });
});

describe('UsageService.assertCanCreateAgent', () => {
  beforeEach(() => {
    process.env.USAGE_FREE_AGENTS_MAX = '5';
  });

  it('limit ostida -> xato yo\'q', async () => {
    const svc = new UsageService(makeMockPrisma(new Map(), 3) as any);
    await expect(svc.assertCanCreateAgent(freeUser)).resolves.toBeUndefined();
  });

  it('limitga yetgan -> ForbiddenException (agent_limit)', async () => {
    const svc = new UsageService(makeMockPrisma(new Map(), 5) as any);
    await expect(svc.assertCanCreateAgent(freeUser)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
