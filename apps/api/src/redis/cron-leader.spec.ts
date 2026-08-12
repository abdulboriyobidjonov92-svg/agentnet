import { RedisService } from './redis.service';
import { RedisLockService } from './lock.service';
import { CronLeaderService } from './cron-leader.service';

/**
 * Phase 6 — cron dublikat-himoyasi. Unit qatlam Redis'siz, integratsiya
 * qatlami `REDIS_URL` bilan (CI'da skip).
 */
const REDIS_URL = process.env.REDIS_URL?.trim();
const describeIntegration = REDIS_URL ? describe : describe.skip;

describe('CronLeaderService — Redis YO`Q', () => {
  it('ishni BAJARADI (bitta-instansli xulq saqlanadi)', async () => {
    const redis = new RedisService({} as NodeJS.ProcessEnv);
    const leader = new CronLeaderService(new RedisLockService(redis), redis);
    const fn = jest.fn(async () => 'bajarildi');
    await expect(leader.runExclusive('job', fn)).resolves.toBe('bajarildi');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describeIntegration('INTEGRATSIYA — cron dublikati (haqiqiy Redis)', () => {
  const make = () => {
    const redis = new RedisService({ REDIS_URL } as NodeJS.ProcessEnv);
    return { redis, leader: new CronLeaderService(new RedisLockService(redis), redis) };
  };

  it('IKKI instans bir vaqtda ishga tushsa — ish FAQAT BIR MARTA bajariladi', async () => {
    const a = make();
    const b = make();
    const job = `test-dup-${Date.now()}`;
    let runs = 0;
    const work = async () => {
      runs++;
      await new Promise((r) => setTimeout(r, 300)); // ijro davom etmoqda
      return 'ok';
    };

    const [ra, rb] = await Promise.all([
      a.leader.runExclusive(job, work, 5_000),
      b.leader.runExclusive(job, work, 5_000),
    ]);

    expect(runs).toBe(1); // ASOSIY da'vo: pul yo'li ikki marta ishlamadi
    expect([ra, rb].filter((r) => r === 'ok')).toHaveLength(1);
    expect([ra, rb].filter((r) => r === undefined)).toHaveLength(1);

    await a.redis.onApplicationShutdown();
    await b.redis.onApplicationShutdown();
    // TLS qo'l siqish + 300ms ish: jest sukut bo'yicha 5s yetmaydi.
  }, 30_000);

  it('ish tugagach qulf bo`shaydi — KEYINGI ijro bloklanmaydi', async () => {
    const { redis, leader } = make();
    const job = `test-seq-${Date.now()}`;
    await expect(leader.runExclusive(job, async () => 1, 5_000)).resolves.toBe(1);
    await expect(leader.runExclusive(job, async () => 2, 5_000)).resolves.toBe(2);
    await redis.onApplicationShutdown();
  }, 30_000);
});
