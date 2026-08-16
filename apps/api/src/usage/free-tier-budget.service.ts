import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

/**
 * FREE TARIF UCHUN GLOBAL KUNLIK BUDJET (OpenRouter bepul modellari).
 *
 * NEGA KERAK — bu limit BIZNIKI emas, OPENROUTER'niki va u HISOB darajasida
 * ishlaydi, foydalanuvchi darajasida emas `[FROM-RESEARCH]`:
 *   • 20 so'rov/daqiqa — har doim;
 *   • 50 so'rov/kun   — hisobda umr bo'yi $10 kredit sotib olinmagan bo'lsa;
 *   • 1000 so'rov/kun — bir marta $10 kredit sotib olingach (doimiy).
 * Butun mahsulotda BITTA `OPENROUTER_API_KEY` bor, ya'ni barcha free
 * foydalanuvchilar shu yagona idishdan ichadi. Server tomonda hisoblamasak,
 * chegara OpenRouter tomonida uriladi va foydalanuvchi xom `429` ko'radi.
 *
 * BUFER: default 45 (haqiqiy 50 dan ~10% past). Bufer shuning uchun kerakki,
 * bizning hisobimiz va OpenRouter'niki hech qachon aynan bir xil bo'lmaydi —
 * qayta urinishlar, boshqa modullardan ketgan chaqiruvlar (`llm_json`) va
 * soat mintaqasi farqi hisobni siljitadi. Kredit sotib olingach
 * `OPENROUTER_FREE_DAILY_CAP=900` qilinadi (1000 dan 10% past).
 *
 * SAQLASH: Redis (`INCR` — atomik, ko'p instansda to'g'ri). `REDIS_URL`
 * yo'q bo'lsa `UsageCounter` jadvaliga tushadi — bugungi prod bitta
 * instansda ishlaydi va Redis ixtiyoriy (RedisService izohiga qarang),
 * shuning uchun fallback ATAYLAB "ishlaydigan", "o'chirilgan" emas.
 */

/** Redis kaliti — kunlik (UTC). */
export function freeBudgetRedisKey(day: string): string {
  return `agentnet:openrouter:free:${day}`;
}

/** Prisma fallback'da `UsageCounter.userId` sifatida ishlatiladigan sintetik id. */
export const FREE_BUDGET_COUNTER_USER = '_global';
export const FREE_BUDGET_COUNTER_KIND = 'openrouter_free';

/** Kalit 48 soatdan keyin o'zi o'chadi (kunlik kalitlar to'planib qolmasin). */
const KEY_TTL_SECONDS = 172_800;

function intEnv(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

export interface FreeBudgetSnapshot {
  used: number;
  cap: number;
  alertAt: number;
  /** Hisob qayerdan o'qildi — diagnostika va sog'liq hisoboti uchun. */
  source: 'redis' | 'postgres';
}

@Injectable()
export class FreeTierBudgetService {
  private readonly logger = new Logger(FreeTierBudgetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Buferli kunlik chegara. */
  get cap(): number {
    return intEnv('OPENROUTER_FREE_DAILY_CAP', 45);
  }

  /** Ogohlantirish chegarasi (default 80%). */
  get alertAt(): number {
    return intEnv('OPENROUTER_FREE_DAILY_ALERT', Math.floor(this.cap * 0.8));
  }

  today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * Bitta slot band qiladi. `ok:false` — bugungi budjet tugagan (LLM'ga
   * chiqilmaydi). Oshirish ATOMIK: parallel so'rovlar chegaradan oshib
   * keta olmaydi (`UsageService.consumeChat` bilan bir xil naqsh).
   */
  async reserve(day = this.today()): Promise<FreeBudgetSnapshot & { ok: boolean }> {
    const cap = this.cap;
    const { used, source } = await this.bump(day);

    if (used > cap) {
      await this.release(day); // slotni qaytaramiz — bu so'rov o'tmadi
      this.logger.error(
        `OpenRouter free budjeti tugadi: ${cap}/${cap} (${day}) — free tarif so'rovlari to'xtatildi`,
      );
      return { ok: false, used: cap, cap, alertAt: this.alertAt, source };
    }

    if (used >= this.alertAt) {
      this.logger.warn(
        `OpenRouter free budjeti ${used}/${cap} (${day}) — ogohlantirish chegarasidan o'tdi`,
      );
    }
    return { ok: true, used, cap, alertAt: this.alertAt, source };
  }

  /** Kompensatsiya — band qilingan slotni qaytaradi. */
  async release(day = this.today()): Promise<void> {
    const client = this.redis.getClient();
    if (client) {
      try {
        await client.decr(freeBudgetRedisKey(day));
        return;
      } catch (e) {
        this.logger.warn(`Redis decr xatosi, Postgres'ga o'tildi: ${(e as Error).message}`);
      }
    }
    await this.prisma.usageCounter.updateMany({
      where: { userId: FREE_BUDGET_COUNTER_USER, day, kind: FREE_BUDGET_COUNTER_KIND },
      data: { count: { decrement: 1 } },
    });
  }

  /** O'qish (oshirmaydi) — alert baholovchisi va sog'liq uchun. */
  async snapshot(day = this.today()): Promise<FreeBudgetSnapshot> {
    const cap = this.cap;
    const client = this.redis.getClient();
    if (client) {
      try {
        const raw = await client.get(freeBudgetRedisKey(day));
        return { used: Number(raw ?? 0), cap, alertAt: this.alertAt, source: 'redis' };
      } catch (e) {
        this.logger.warn(`Redis get xatosi, Postgres'ga o'tildi: ${(e as Error).message}`);
      }
    }
    const row = await this.prisma.usageCounter.findUnique({
      where: {
        userId_day_kind: {
          userId: FREE_BUDGET_COUNTER_USER,
          day,
          kind: FREE_BUDGET_COUNTER_KIND,
        },
      },
    });
    return { used: row?.count ?? 0, cap, alertAt: this.alertAt, source: 'postgres' };
  }

  /** Atomik +1; oshirilgandan KEYINGI qiymatni qaytaradi. */
  private async bump(day: string): Promise<{ used: number; source: 'redis' | 'postgres' }> {
    const client = this.redis.getClient();
    if (client) {
      try {
        const key = freeBudgetRedisKey(day);
        const used = await client.incr(key);
        // TTL faqat birinchi oshirishda — keyingilarida qayta qo'yish
        // muddatni cheksiz cho'zib yuborardi.
        if (used === 1) await client.expire(key, KEY_TTL_SECONDS);
        return { used, source: 'redis' };
      } catch (e) {
        this.logger.warn(`Redis incr xatosi, Postgres'ga o'tildi: ${(e as Error).message}`);
      }
    }
    const row = await this.prisma.usageCounter.upsert({
      where: {
        userId_day_kind: {
          userId: FREE_BUDGET_COUNTER_USER,
          day,
          kind: FREE_BUDGET_COUNTER_KIND,
        },
      },
      create: { userId: FREE_BUDGET_COUNTER_USER, day, kind: FREE_BUDGET_COUNTER_KIND, count: 1 },
      update: { count: { increment: 1 } },
    });
    return { used: row.count, source: 'postgres' };
  }
}
