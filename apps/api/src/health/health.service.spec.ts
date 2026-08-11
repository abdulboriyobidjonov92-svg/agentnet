import { HealthService, withTimeout } from './health.service';

/**
 * Phase 5 (P5.5) — sog'liq tekshiruvi testlari.
 *
 * Har test "nima chiqmasligi kerak" ni ham tekshiradi: sog'liq
 * endpointi eng ko'p skanerlanadigan ochiq yuza, shuning uchun undagi
 * har bir qo'shimcha maydon — razvedka ma'lumoti.
 */
function serviceWith(queryImpl: () => Promise<unknown>): HealthService {
  const prisma = { $queryRaw: jest.fn(queryImpl) } as never;
  return new HealthService(prisma);
}

const OK_ENV: NodeJS.ProcessEnv = {
  DATABASE_URL: 'postgresql://u:p@h:5432/d',
  AUTH_JWT_SECRET: 's'.repeat(32),
  ENCRYPTION_KEY: 'k'.repeat(32),
  INTERNAL_API_TOKEN: 'strong-internal-token',
};

describe('withTimeout', () => {
  it('vaqtida tugagan va’da qiymat qaytaradi', async () => {
    await expect(withTimeout(Promise.resolve(7), 1000)).resolves.toEqual({ ok: true, value: 7 });
  });

  it('osilib qolgan va’da timeout beradi (healthcheck osilmaydi)', async () => {
    const hanging = new Promise(() => undefined);
    await expect(withTimeout(hanging, 20)).resolves.toEqual({ ok: false, reason: 'timeout' });
  });
});

describe('/live — eng arzon', () => {
  it('bog‘liqliklarga TEGMAYDI va doim ok', () => {
    const query = jest.fn();
    const service = new HealthService({ $queryRaw: query } as never);
    const out = service.live();
    expect(out.status).toBe('ok');
    expect(query).not.toHaveBeenCalled();
  });

  it('javobda sir/konfiguratsiya yo‘q', () => {
    const service = serviceWith(async () => [1]);
    expect(Object.keys(service.live()).sort()).toEqual(['service', 'status', 'ts', 'uptimeSec']);
  });
});

describe('DB tekshiruvi', () => {
  it('sog‘lom DB — ok + latency', async () => {
    const service = serviceWith(async () => [{ '?column?': 1 }]);
    const result = await service.checkDatabase(OK_ENV);
    expect(result.status).toBe('ok');
    expect(typeof result.latencyMs).toBe('number');
  });

  it('DB yiqilgan — error, LEKIN xato matni/ulanish satri CHIQMAYDI', async () => {
    const service = serviceWith(async () => {
      throw new Error('connect ECONNREFUSED 10.0.0.5:5432 user=agentnet password=secret');
    });
    const result = await service.checkDatabase(OK_ENV);
    expect(result.status).toBe('error');
    expect(result.code).toBe('db_unreachable');
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('ECONNREFUSED');
    expect(serialized).not.toContain('10.0.0.5');
    expect(serialized).not.toContain('password');
  });

  it('DB osilib qolgan — timeout (osilib qolmaydi)', async () => {
    const service = serviceWith(() => new Promise(() => undefined));
    const result = await service.checkDatabase({ ...OK_ENV, HEALTH_DB_TIMEOUT_MS: '20' });
    expect(result.status).toBe('timeout');
    expect(result.code).toBe('db_timeout');
  });
});

describe('konfiguratsiya tekshiruvi', () => {
  it('hammasi joyida — ok', () => {
    const service = serviceWith(async () => [1]);
    expect(service.checkConfig(OK_ENV).status).toBe('ok');
  });

  it("buzuq konfiguratsiya — error, LEKIN qaysi kalit yo'qligi OSHKOR QILINMAYDI", () => {
    const service = serviceWith(async () => [1]);
    const result = service.checkConfig({ DATABASE_URL: 'x' });
    expect(result.status).toBe('error');
    expect(result.code).toBe('config_missing_3');
    expect(JSON.stringify(result)).not.toContain('ENCRYPTION_KEY');
    expect(JSON.stringify(result)).not.toContain('AUTH_JWT_SECRET');
  });
});

describe('engine tekshiruvi (ixtiyoriy bog‘liqlik)', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("AGENT_ENGINE_URL yo'q — skipped (xato EMAS)", async () => {
    const service = serviceWith(async () => [1]);
    const result = await service.checkEngine(OK_ENV);
    expect(result.status).toBe('skipped');
  });

  it('engine 200 — ok', async () => {
    global.fetch = jest.fn(async () => ({ ok: true, status: 200 })) as never;
    const service = serviceWith(async () => [1]);
    const result = await service.checkEngine({ ...OK_ENV, AGENT_ENGINE_URL: 'http://engine:8000' });
    expect(result.status).toBe('ok');
  });

  it('engine 500 — error, ichki manzil javobga chiqmaydi', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 500 })) as never;
    const service = serviceWith(async () => [1]);
    const result = await service.checkEngine({
      ...OK_ENV,
      AGENT_ENGINE_URL: 'http://engine.internal.private:8000',
    });
    expect(result.status).toBe('error');
    expect(result.code).toBe('engine_http_500');
    expect(JSON.stringify(result)).not.toContain('engine.internal.private');
  });

  it('engine erishib bo‘lmaydi — error', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('fetch failed');
    }) as never;
    const service = serviceWith(async () => [1]);
    const result = await service.checkEngine({ ...OK_ENV, AGENT_ENGINE_URL: 'http://engine:8000' });
    expect(result.status).toBe('error');
    expect(result.code).toBe('engine_unreachable');
  });
});

describe('/ready — faqat MAJBURIY bog‘liqliklar', () => {
  it('hammasi sog‘lom — ready', async () => {
    const service = serviceWith(async () => [1]);
    const report = await service.readiness(OK_ENV);
    expect(report.ready).toBe(true);
  });

  it('DB yiqilgan — ready EMAS', async () => {
    const service = serviceWith(async () => {
      throw new Error('down');
    });
    const report = await service.readiness(OK_ENV);
    expect(report.ready).toBe(false);
    expect(report.checks.database.status).toBe('error');
  });

  it('konfiguratsiya buzuq — ready EMAS', async () => {
    const service = serviceWith(async () => [1]);
    const report = await service.readiness({ DATABASE_URL: 'x' });
    expect(report.ready).toBe(false);
  });

  it('engine yiqilgan bo‘lsa ham READY (ixtiyoriy bog‘liqlik)', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('engine down');
    }) as never;
    const service = serviceWith(async () => [1]);
    const report = await service.readiness({ ...OK_ENV, AGENT_ENGINE_URL: 'http://engine:8000' });
    expect(report.ready).toBe(true);
    // `ready` engine'ni umuman TEKSHIRMAYDI — u ro'yxatda ham yo'q.
    expect(Object.keys(report.checks).sort()).toEqual(['config', 'database']);
  });
});

describe('/api/health — diagnostik xulosa', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("mavjud shartnoma saqlanadi (status/service/ts) — render healthcheck buzilmaydi", async () => {
    const service = serviceWith(async () => [1]);
    const report = await service.report(OK_ENV);
    expect(report.status).toBe('ok');
    expect(report.service).toBe('api');
    expect(typeof report.ts).toBe('string');
  });

  it('engine yiqilgan — degraded (error EMAS, ya’ni 200)', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('down');
    }) as never;
    const service = serviceWith(async () => [1]);
    const report = await service.report({ ...OK_ENV, AGENT_ENGINE_URL: 'http://engine:8000' });
    expect(report.status).toBe('degraded');
  });

  it('DB yiqilgan — error', async () => {
    const service = serviceWith(async () => {
      throw new Error('down');
    });
    const report = await service.report(OK_ENV);
    expect(report.status).toBe('error');
  });

  it('natija KESHLANADI — DDoS vektoriga aylanmaydi', async () => {
    const query = jest.fn(async () => [1]);
    const service = new HealthService({ $queryRaw: query } as never);
    for (let i = 0; i < 50; i += 1) await service.report(OK_ENV);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('kesh muddati o‘tgach qayta tekshiriladi', async () => {
    const query = jest.fn(async () => [1]);
    const service = new HealthService({ $queryRaw: query } as never);
    await service.report({ ...OK_ENV, HEALTH_CACHE_MS: '0' });
    await service.report({ ...OK_ENV, HEALTH_CACHE_MS: '0' });
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('javobda SIR, ulanish satri va stack YO‘Q', async () => {
    const service = serviceWith(async () => {
      throw new Error('postgresql://agentnet:hunter2@db:5432/agentnet unreachable');
    });
    const report = await service.report({ ...OK_ENV, HEALTH_CACHE_MS: '0' });
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain('hunter2');
    expect(serialized).not.toContain('postgresql://');
    expect(serialized).not.toContain(OK_ENV.ENCRYPTION_KEY as string);
    expect(serialized).not.toContain(OK_ENV.INTERNAL_API_TOKEN as string);
    expect(serialized).not.toContain('at Object.');
  });
});
