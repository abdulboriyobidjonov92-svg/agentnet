import {
  FreeTierBudgetService,
  freeBudgetRedisKey,
  FREE_BUDGET_COUNTER_KIND,
  FREE_BUDGET_COUNTER_USER,
} from './free-tier-budget.service';

/**
 * OpenRouter'ning HISOB darajasidagi kunlik chegarasi uchun buferli hisoblagich.
 *
 * Ikki yo'l ham tekshiriladi: Redis (prod, ko'p instans) va Postgres fallback
 * (`REDIS_URL` yo'q — bugungi dev/prod holati). Ikkalasi BIR XIL qaror berishi
 * shart, aks holda Redis qo'shilgan kuni chegara jimgina siljib ketardi.
 */

function makeRedis(store: Map<string, number>, working = true) {
  const client = working
    ? {
        incr: jest.fn(async (k: string) => {
          const next = (store.get(k) ?? 0) + 1;
          store.set(k, next);
          return next;
        }),
        decr: jest.fn(async (k: string) => {
          const next = Math.max(0, (store.get(k) ?? 0) - 1);
          store.set(k, next);
          return next;
        }),
        get: jest.fn(async (k: string) => (store.has(k) ? String(store.get(k)) : null)),
        expire: jest.fn(async () => 1),
      }
    : null;
  return { getClient: () => client } as any;
}

function makePrisma(store: Map<string, number>) {
  const key = (w: any) => {
    const x = w.userId_day_kind ?? w;
    return `${x.userId}|${x.day}|${x.kind}`;
  };
  return {
    usageCounter: {
      upsert: jest.fn(async ({ where }: any) => {
        const k = key(where);
        const next = (store.get(k) ?? 0) + 1;
        store.set(k, next);
        return { count: next };
      }),
      updateMany: jest.fn(async ({ where }: any) => {
        const k = key(where);
        store.set(k, Math.max(0, (store.get(k) ?? 0) - 1));
        return { count: 1 };
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        const k = key(where);
        return store.has(k) ? { count: store.get(k) } : null;
      }),
    },
  } as any;
}

const DAY = '2026-08-16';

describe('FreeTierBudgetService', () => {
  beforeEach(() => {
    delete process.env.OPENROUTER_FREE_DAILY_CAP;
    delete process.env.OPENROUTER_FREE_DAILY_ALERT;
  });

  it('default chegara 45 — OpenRouter\'ning haqiqiy 50/kun limitidan ~10% past bufer', () => {
    const svc = new FreeTierBudgetService(makePrisma(new Map()), makeRedis(new Map()));
    expect(svc.cap).toBe(45);
    expect(svc.alertAt).toBe(36); // 80%
  });

  it('kredit sotib olingach env orqali 900 ga ko\'tariladi (1000/kun dan 10% past)', () => {
    process.env.OPENROUTER_FREE_DAILY_CAP = '900';
    const svc = new FreeTierBudgetService(makePrisma(new Map()), makeRedis(new Map()));
    expect(svc.cap).toBe(900);
    expect(svc.alertAt).toBe(720);
  });

  it('Redis yo\'lida chegaragacha ruxsat, chegaradan keyin ok:false va slot qaytariladi', async () => {
    process.env.OPENROUTER_FREE_DAILY_CAP = '2';
    const store = new Map<string, number>();
    const svc = new FreeTierBudgetService(makePrisma(new Map()), makeRedis(store));

    expect((await svc.reserve(DAY)).ok).toBe(true);
    expect((await svc.reserve(DAY)).ok).toBe(true);
    const third = await svc.reserve(DAY);
    expect(third.ok).toBe(false);
    // Rad etilgan so'rov hisobni OSHIRGANICHA qoldirmaydi
    expect(store.get(freeBudgetRedisKey(DAY))).toBe(2);
  });

  it('TTL faqat BIRINCHI oshirishda qo\'yiladi (muddat cheksiz cho\'zilmasin)', async () => {
    const store = new Map<string, number>();
    const redis = makeRedis(store);
    const svc = new FreeTierBudgetService(makePrisma(new Map()), redis);

    await svc.reserve(DAY);
    await svc.reserve(DAY);
    await svc.reserve(DAY);
    expect(redis.getClient().expire).toHaveBeenCalledTimes(1);
  });

  it('REDIS_URL yo\'q -> Postgres fallback AYNAN bir xil qaror beradi', async () => {
    process.env.OPENROUTER_FREE_DAILY_CAP = '2';
    const pgStore = new Map<string, number>();
    const svc = new FreeTierBudgetService(makePrisma(pgStore), makeRedis(new Map(), false));

    expect((await svc.reserve(DAY)).ok).toBe(true);
    expect((await svc.reserve(DAY)).ok).toBe(true);
    expect((await svc.reserve(DAY)).ok).toBe(false);
    expect(pgStore.get(`${FREE_BUDGET_COUNTER_USER}|${DAY}|${FREE_BUDGET_COUNTER_KIND}`)).toBe(2);
  });

  it('Redis xato bersa Postgres\'ga tushadi — so\'rov YIQILMAYDI', async () => {
    const broken = {
      getClient: () => ({
        incr: jest.fn(async () => {
          throw new Error('redis down');
        }),
        expire: jest.fn(),
      }),
    } as any;
    const pgStore = new Map<string, number>();
    const svc = new FreeTierBudgetService(makePrisma(pgStore), broken);

    const res = await svc.reserve(DAY);
    expect(res.ok).toBe(true);
    expect(res.source).toBe('postgres');
  });

  it('snapshot() hisobni OSHIRMAYDI (alert baholovchisi uni har 5 daqiqada o\'qiydi)', async () => {
    const store = new Map<string, number>();
    const svc = new FreeTierBudgetService(makePrisma(new Map()), makeRedis(store));

    await svc.reserve(DAY);
    const a = await svc.snapshot(DAY);
    const b = await svc.snapshot(DAY);
    expect(a.used).toBe(1);
    expect(b.used).toBe(1);
  });
});
