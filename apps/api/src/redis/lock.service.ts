import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RedisService } from './redis.service';

export interface AcquiredLock {
  key: string;
  /** Egalik tokeni — `release`/`extend` faqat SHU token bilan ishlaydi. */
  token: string;
}

/**
 * Phase 6 — taqsimlangan qulf (`SET key token NX PX ttl`).
 *
 * NEGA TOKEN KERAK: tokensiz `DEL key` HAR QANDAY egani o'chirardi.
 * Ssenariy: A qulfni oladi, ishi TTL'dan uzun cho'ziladi, qulf muddati
 * tugaydi, B oladi — keyin A tugab `release()` chaqiradi va B NING
 * qulfini o'chiradi. Shu sababli release/extend **Lua skripti** bilan
 * atomik: "token mos kelsa — o'zgartir, aks holda tegma".
 *
 * CHEKLOV (halol): bu bitta Redis instansiga tayanadi (Redlock EMAS).
 * Redis yo'qolsa qulf ham yo'qoladi. Bizning ishlatish holatimiz — cron
 * dublikatini oldini olish, ya'ni "ikki marta ishlash" narxi past
 * (idempotent joblar). Pul yo'llari uchun bu YETARLI EMAS — u yerda
 * `pg_advisory_xact_lock` ishlatiladi (Contract §11).
 */
@Injectable()
export class RedisLockService {
  private readonly logger = new Logger(RedisLockService.name);

  // Faqat token mos kelganda o'chiradi. `redis.call` xatosi bo'lmasligi
  // uchun `pcall` emas — kalit yo'q bo'lsa `get` `false` qaytaradi.
  private static readonly RELEASE_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end`;

  private static readonly EXTEND_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("pexpire", KEYS[1], ARGV[2])
else
  return 0
end`;

  constructor(private readonly redis: RedisService) {}

  /**
   * Qulfni olishga urinadi. Muvaffaqiyatsiz bo'lsa `null` (istisno EMAS —
   * "qulfni ololmadim" oddiy, kutilgan holat).
   *
   * @param ttlMs qulf AVTOMAT bo'shaydigan vaqt. Ish shundan uzun
   *   cho'zilsa `extend()` chaqirilishi SHART.
   * @param retries necha marta qayta urinish (0 = bir marta).
   */
  async acquire(key: string, ttlMs: number, retries = 0, retryDelayMs = 100): Promise<AcquiredLock | null> {
    const client = this.redis.getClient();
    if (!client) return null; // Redis yo'q — chaqiruvchi o'zi qaror qiladi.

    const token = randomUUID();
    const fullKey = `agentnet:lock:${key}`;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await client.set(fullKey, token, 'PX', ttlMs, 'NX');
        if (res === 'OK') return { key: fullKey, token };
      } catch (e) {
        this.logger.warn(`Qulf olishda xato (${key}): ${(e as Error).message}`);
        return null;
      }
      if (attempt < retries) await new Promise((r) => setTimeout(r, retryDelayMs));
    }
    return null;
  }

  /** Faqat O'Z qulfini bo'shatadi. `true` — bo'shatildi. */
  async release(lock: AcquiredLock): Promise<boolean> {
    const client = this.redis.getClient();
    if (!client) return false;
    try {
      const res = await client.eval(RedisLockService.RELEASE_LUA, 1, lock.key, lock.token);
      return res === 1;
    } catch (e) {
      this.logger.warn(`Qulf bo'shatishda xato (${lock.key}): ${(e as Error).message}`);
      return false;
    }
  }

  /** Faqat O'Z qulfining muddatini uzaytiradi. `true` — uzaytirildi. */
  async extend(lock: AcquiredLock, ttlMs: number): Promise<boolean> {
    const client = this.redis.getClient();
    if (!client) return false;
    try {
      const res = await client.eval(RedisLockService.EXTEND_LUA, 1, lock.key, lock.token, String(ttlMs));
      return res === 1;
    } catch (e) {
      this.logger.warn(`Qulf uzaytirishda xato (${lock.key}): ${(e as Error).message}`);
      return false;
    }
  }

  /**
   * Qulf ostida bajarish. Qulf olinmasa `undefined` qaytaradi va ishni
   * BAJARMAYDI — bu cron dublikatini oldini olishning asosiy naqshi.
   * Qulf ish tugagach HAR DOIM bo'shatiladi (`finally`).
   */
  async withLock<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T | undefined> {
    const lock = await this.acquire(key, ttlMs);
    if (!lock) return undefined;
    try {
      return await fn();
    } finally {
      await this.release(lock);
    }
  }
}
