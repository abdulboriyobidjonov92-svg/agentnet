import { RedisService } from './redis.service';
import { RedisLockService } from './lock.service';

/**
 * Phase 6 — Redis qatlami testlari.
 *
 * IKKI QATLAM:
 *  1. UNIT — Redis'SIZ ishlaydi (CI'da aynan shu ishlaydi). "Redis
 *     sozlanmagan" yo'lini qulflaydi: hech narsa yiqilmasligi va
 *     fallback ishlashi kerak.
 *  2. INTEGRATSIYA — faqat `REDIS_URL` berilganda ishlaydi
 *     (`describeIntegration`). CI'da Redis YO'Q, shuning uchun ular
 *     o'tkazib yuboriladi — bu ATAYLAB va yashirilmagan: skip sababi
 *     test nomida ko'rinadi.
 */
const REDIS_URL = process.env.REDIS_URL?.trim();
const describeIntegration = REDIS_URL ? describe : describe.skip;

describe('RedisService — sozlanmagan holat (Redis YO`Q)', () => {
  const svc = new RedisService({} as NodeJS.ProcessEnv);

  it('isConfigured() false', () => {
    expect(svc.isConfigured()).toBe(false);
  });

  it('getClient() null qaytaradi — YIQILMAYDI', () => {
    expect(svc.getClient()).toBeNull();
  });

  it('ping() `redis_url_unset` kodi bilan ok=false', async () => {
    await expect(svc.ping()).resolves.toEqual({ ok: false, code: 'redis_url_unset' });
  });

  it('shutdown klient bo`lmasa ham xato bermaydi', async () => {
    await expect(svc.onApplicationShutdown()).resolves.toBeUndefined();
  });
});

describe('RedisLockService — Redis YO`Q bo`lganda', () => {
  const svc = new RedisService({} as NodeJS.ProcessEnv);
  const lock = new RedisLockService(svc);

  it('acquire() null — chaqiruvchi o`zi qaror qiladi', async () => {
    await expect(lock.acquire('k', 1000)).resolves.toBeNull();
  });

  it('withLock() ishni BAJARMAYDI va undefined qaytaradi', async () => {
    const fn = jest.fn();
    await expect(lock.withLock('k', 1000, fn)).resolves.toBeUndefined();
    expect(fn).not.toHaveBeenCalled();
  });
});

describeIntegration('INTEGRATSIYA — haqiqiy Redis (REDIS_URL berilgan)', () => {
  let svc: RedisService;
  let lock: RedisLockService;

  beforeAll(() => {
    svc = new RedisService({ REDIS_URL } as NodeJS.ProcessEnv);
    lock = new RedisLockService(svc);
  });

  afterAll(async () => {
    await svc.onApplicationShutdown();
  });

  it('ping() haqiqiy PONG oladi', async () => {
    const res = await svc.ping();
    expect(res.ok).toBe(true);
    expect(typeof res.latencyMs).toBe('number');
  });

  it('qulf olinadi va IKKINCHI egaga BERILMAYDI (o`zaro istisno)', async () => {
    const key = `test:excl:${Date.now()}`;
    const first = await lock.acquire(key, 5_000);
    expect(first).not.toBeNull();

    const second = await lock.acquire(key, 5_000);
    expect(second).toBeNull(); // band

    expect(await lock.release(first!)).toBe(true);

    const third = await lock.acquire(key, 5_000); // bo'shagach — olinadi
    expect(third).not.toBeNull();
    await lock.release(third!);
  });

  it('release() BEGONA token bilan ishlamaydi (egalik himoyasi)', async () => {
    const key = `test:token:${Date.now()}`;
    const mine = await lock.acquire(key, 5_000);
    expect(mine).not.toBeNull();

    const forged = { key: mine!.key, token: 'begona-token' };
    expect(await lock.release(forged)).toBe(false); // o'chirmadi
    expect(await lock.acquire(key, 5_000)).toBeNull(); // hamon band — isbot

    await lock.release(mine!);
  });

  it('extend() faqat O`Z tokeni bilan muddatni uzaytiradi', async () => {
    const key = `test:extend:${Date.now()}`;
    const mine = await lock.acquire(key, 1_000);
    expect(mine).not.toBeNull();

    expect(await lock.extend(mine!, 10_000)).toBe(true);
    expect(await lock.extend({ key: mine!.key, token: 'begona' }, 10_000)).toBe(false);

    await lock.release(mine!);
  });

  it('withLock() ish tugagach qulfni HAR DOIM bo`shatadi (xato bo`lsa ham)', async () => {
    const key = `test:withlock:${Date.now()}`;
    await expect(
      lock.withLock(key, 5_000, async () => {
        throw new Error('ataylab xato');
      }),
    ).rejects.toThrow('ataylab xato');

    // `finally` ishlagan bo'lsa qulf bo'sh bo'ladi.
    const after = await lock.acquire(key, 5_000);
    expect(after).not.toBeNull();
    await lock.release(after!);
  });
});
