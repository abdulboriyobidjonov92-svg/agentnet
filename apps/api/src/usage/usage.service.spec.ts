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
