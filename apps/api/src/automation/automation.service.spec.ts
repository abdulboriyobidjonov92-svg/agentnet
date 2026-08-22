/**
 * SEC-07 — AutomationService ulanishi (P0-3 §14).
 *
 * Bu yerda tekshiriladigan yagona narsa: allowlist qaroriga KIM va QANDAY
 * kirish beradi, va blok hodisasi `DeviceActionLog`ga TO'G'RI yoziladimi
 * (Contract SEC-07 AC ning to'rtinchi bandi).
 *
 * NEGA PRIVATE METODLAR TO'G'RIDAN-TO'G'RI: yagona ommaviy yo'l (`run`/
 * `runStreaming`) haqiqiy Chromium ishga tushiradi va engine'ga HTTP qiladi —
 * uni to'liq mock qilish bu testni ijro-loop testiga aylantirardi, holbuki
 * bu yerdagi savol tor: konfiguratsiya va audit yozuvi. Ijro yo'lining o'zi
 * `browser-bridge.spec.ts` da qoplangan.
 */

import { AutomationService } from './automation.service';
import type { DomainBlockEvent } from './browser-bridge';

interface MockPrisma {
  _logs: Record<string, unknown>[];
  deviceActionLog: { create: jest.Mock };
}

function makeMockPrisma(createImpl?: () => Promise<unknown>): MockPrisma {
  const logs: Record<string, unknown>[] = [];
  return {
    _logs: logs,
    deviceActionLog: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if (createImpl) return createImpl();
        logs.push(data);
        return { id: `l${logs.length}`, ...data };
      }),
    },
  };
}

function makeService(prisma: MockPrisma) {
  return new AutomationService(
    prisma as never,
    { post: jest.fn() } as never, // HttpService — bu testda ishlatilmaydi
    { record: jest.fn() } as never, // AuditLogService
    { decryptJson: jest.fn() } as never, // CryptoService
  );
}

/** Fire-and-forget yozuvning mikrotask navbatini bo'shatadi. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

const ENV_KEYS = ['AGENT_DOMAIN_ALLOWLIST', 'AGENT_DOMAIN_ALLOWLIST_ENFORCE'] as const;
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key] as string;
  }
});

describe('resolveRunAllowlist — env manbai', () => {
  function resolve(svc: AutomationService) {
    return (svc as unknown as {
      resolveRunAllowlist(): { domains: string[]; enforced: boolean };
    }).resolveRunAllowlist();
  }

  it('env dagi ro‘yxatni kanonik shaklda qaytaradi', () => {
    process.env.AGENT_DOMAIN_ALLOWLIST = 'https://Example.COM/, shop.uz';
    delete process.env.AGENT_DOMAIN_ALLOWLIST_ENFORCE;

    const result = resolve(makeService(makeMockPrisma()));

    expect(result.domains).toEqual(['example.com', 'shop.uz']);
    expect(result.enforced).toBe(true);
  });

  it('⚠️ env BO‘SH bo‘lsa bo‘sh ro‘yxat + enforced=true (FAIL-CLOSED)', () => {
    process.env.AGENT_DOMAIN_ALLOWLIST = '';

    const result = resolve(makeService(makeMockPrisma()));

    // Bo'sh ro'yxat + majburlash = hech qayerga navigatsiya yo'q.
    expect(result.domains).toEqual([]);
    expect(result.enforced).toBe(true);
  });

  it('env umuman sozlanmagan bo‘lsa ham fail-closed', () => {
    delete process.env.AGENT_DOMAIN_ALLOWLIST;
    const result = resolve(makeService(makeMockPrisma()));
    expect(result.domains).toEqual([]);
    expect(result.enforced).toBe(true);
  });

  it('5 tadan oshsa kesadi (Contract SEC-07 AC)', () => {
    process.env.AGENT_DOMAIN_ALLOWLIST = 'a.com,b.com,c.com,d.com,e.com,f.com';
    const result = resolve(makeService(makeMockPrisma()));
    expect(result.domains).toHaveLength(5);
    expect(result.domains).not.toContain('f.com');
  });

  it('yaroqsiz yozuv butun ro‘yxatni yiqitmaydi', () => {
    process.env.AGENT_DOMAIN_ALLOWLIST = 'example.com, not a domain, shop.uz';
    const result = resolve(makeService(makeMockPrisma()));
    expect(result.domains).toEqual(['example.com', 'shop.uz']);
  });

  it('ENFORCE=false — majburlash o‘chadi (enforced=false), bu BO‘SH ro‘yxatdan FARQ qiladi', () => {
    process.env.AGENT_DOMAIN_ALLOWLIST = 'example.com';
    process.env.AGENT_DOMAIN_ALLOWLIST_ENFORCE = 'false';

    const result = resolve(makeService(makeMockPrisma()));

    // `enforced=false` => BrowserBridge tekshiruvni butunlay o'tkazib yuboradi.
    // Bu "hech narsaga ruxsat yo'q" (domains=[]) HOLATI EMAS.
    expect(result.enforced).toBe(false);
  });

  it('ENFORCE ning boshqa qiymatlari majburlashni O‘CHIRMAYDI', () => {
    process.env.AGENT_DOMAIN_ALLOWLIST = 'example.com';
    for (const value of ['true', '0', 'no', 'FALSE']) {
      process.env.AGENT_DOMAIN_ALLOWLIST_ENFORCE = value;
      expect(resolve(makeService(makeMockPrisma())).enforced).toBe(true);
    }
  });
});

describe('recordDomainBlock — DeviceActionLog yozuvi (SEC-07 AC)', () => {
  function record(svc: AutomationService, userId: string, event: DomainBlockEvent) {
    (svc as unknown as {
      recordDomainBlock(userId: string, event: DomainBlockEvent): void;
    }).recordDomainBlock(userId, event);
  }

  const event: DomainBlockEvent = {
    host: 'evil.com',
    reason: 'domain not in allowlist (allowed: example.com)',
    source: 'navigate',
  };

  it('status="blocked" bilan bitta yozuv yaratadi', async () => {
    const prisma = makeMockPrisma();
    record(makeService(prisma), 'u1', event);
    await flush();

    expect(prisma._logs).toHaveLength(1);
    expect(prisma._logs[0]).toMatchObject({
      userId: 'u1',
      deviceType: 'browser',
      category: 'browser',
      status: 'blocked',
    });
  });

  it('amal nomi blok manbasini ajratadi (navigate / route)', async () => {
    const prisma = makeMockPrisma();
    record(makeService(prisma), 'u1', event);
    record(makeService(prisma), 'u1', { ...event, source: 'route' });
    await flush();

    expect(prisma._logs.map((l) => l.action)).toEqual([
      'sec07.domain_blocked.navigate',
      'sec07.domain_blocked.route',
    ]);
  });

  it('detail host va sababni saqlaydi', async () => {
    const prisma = makeMockPrisma();
    record(makeService(prisma), 'u1', event);
    await flush();

    expect(prisma._logs[0].detail).toContain('evil.com');
    expect(prisma._logs[0].detail).toContain('not in allowlist');
  });

  it('⚠️ detail 500 belgidan oshmaydi (uzun sabab ustunni to‘ldirmasin)', async () => {
    const prisma = makeMockPrisma();
    record(makeService(prisma), 'u1', { ...event, reason: 'x'.repeat(900) });
    await flush();

    expect(String(prisma._logs[0].detail).length).toBeLessThanOrEqual(500);
  });

  it('⚠️ audit DB yiqilsa ijro TO‘XTAMAYDI (fire-and-forget)', async () => {
    const prisma = makeMockPrisma(() => Promise.reject(new Error('DB down')));
    const svc = makeService(prisma);
    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);

    try {
      // Sinxron throw bo'lmaydi...
      expect(() => record(svc, 'u1', event)).not.toThrow();
      await flush();
      await flush();
      // ...va rad etish `catch` bilan yutilgani uchun unhandled ham qolmaydi.
      expect(unhandled).not.toHaveBeenCalled();
      expect(prisma.deviceActionLog.create).toHaveBeenCalledTimes(1);
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('yozuv foydalanuvchiga bog‘langan (tenant-scope)', async () => {
    const prisma = makeMockPrisma();
    record(makeService(prisma), 'u-owner', event);
    await flush();
    expect(prisma._logs[0].userId).toBe('u-owner');
  });
});
