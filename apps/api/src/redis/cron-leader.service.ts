import { Injectable, Logger } from '@nestjs/common';
import { RedisLockService } from './lock.service';
import { RedisService } from './redis.service';

/**
 * Phase 6 — cron dublikatini oldini olish (A24).
 *
 * MUAMMO: API bir nechta instansda ishlaganda `@Cron` HAR BIR instansda
 * ishga tushadi. `chargeDueAgents` va `checkSubscriptions` — PUL
 * yo'llari, ya'ni dublikat ijro ikki marta yechish demakdir.
 *
 * QAROR — GLOBAL "leader" EMAS, HAR JOB uchun ALOHIDA qulf.
 * Global leader (bitta instans hamma cron'ni oladi) sodda ko'rinadi,
 * lekin ikkita kamchiligi bor:
 *   1. Leader sekinlashsa/yiqilsa — TTL tugaguncha HECH BIR cron
 *      ishlamaydi (bitta nosozlik hammasini to'xtatadi);
 *   2. Leader lock bitta job'ning O'ZI bilan O'ZI ustma-ust tushishini
 *      (oldingi ijro hali tugamagan) OLDINI OLMAYDI.
 * Har-job qulfi ikkalasini ham hal qiladi.
 *
 * TTL va YANGILASH: qulf `ttlMs` bilan olinadi va ish davom etar ekan
 * `ttlMs/3` oralig'ida UZAYTIRILADI. Shu sababli TTL ni "eng uzun
 * mumkin bo'lgan ijro" ga teng qilish SHART EMAS — jarayon o'lsa qulf
 * TTL ichida O'ZI bo'shaydi (deadlock bo'lmaydi).
 */
@Injectable()
export class CronLeaderService {
  private readonly logger = new Logger(CronLeaderService.name);

  constructor(
    private readonly lock: RedisLockService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Cron ishini KLASTER BO'YICHA bitta marta bajaradi.
   *
   * Redis YO'Q bo'lsa ish BAJARILADI (bugungi bitta-instansli xulq
   * saqlanadi) — aks holda Redis'ni sozlamagan muhitda barcha cron
   * jimgina o'lardi, bu esa kutilmagan biznes zarari bo'lardi.
   *
   * @returns ish bajarilgan bo'lsa uning natijasi; boshqa instans
   *   bajarayotgan bo'lsa `undefined`.
   */
  async runExclusive<T>(jobName: string, fn: () => Promise<T>, ttlMs = 60_000): Promise<T | undefined> {
    const key = `cron:${jobName}`;
    const acquired = await this.lock.acquire(key, ttlMs);

    if (!acquired) {
      // Redis bor, lekin qulf band -> boshqa instans bajarmoqda.
      // Redis yo'q bo'lsa `acquire` ham `null` qaytaradi, shuning uchun
      // ikkalasini AJRATAMIZ.
      if (this.redis.isConfigured()) {
        this.logger.debug(`Cron '${jobName}' o'tkazib yuborildi — boshqa instans bajarmoqda`);
        return undefined;
      }
      this.logger.debug(`Cron '${jobName}' qulfsiz bajarilmoqda (REDIS_URL yo'q)`);
      return fn();
    }

    // Ish davom etar ekan qulfni uzaytirib turamiz.
    const renewMs = Math.max(1_000, Math.floor(ttlMs / 3));
    const timer = setInterval(() => {
      void this.lock.extend(acquired, ttlMs).then((ok) => {
        if (!ok) this.logger.warn(`Cron '${jobName}' qulfini uzaytirib bo'lmadi — muddati o'tgan bo'lishi mumkin`);
      });
    }, renewMs);
    timer.unref?.();

    try {
      return await fn();
    } finally {
      clearInterval(timer);
      await this.lock.release(acquired);
    }
  }
}
