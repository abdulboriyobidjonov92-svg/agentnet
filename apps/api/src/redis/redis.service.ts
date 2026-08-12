import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import Redis, { type RedisOptions } from 'ioredis';

/**
 * Phase 6 (Runtime Decoupling) — yagona Redis ulanish nuqtasi.
 *
 * IXTIYORIY BOG'LIQLIK (ataylab): `REDIS_URL` berilmagan bo'lsa servis
 * "o'chirilgan" holatda qoladi va `getClient()` `null` qaytaradi. Sabab —
 * bugungi prod (Render, bitta instans) Redis'siz ishlab turibdi va uni
 * MAJBURIY qilish deploy'ni darhol yiqitardi. Har bir chaqiruvchi
 * (throttler, lock, queue) o'zining fallback yo'liga ega.
 *
 * NEGA `maxRetriesPerRequest: null`: BullMQ buni TALAB qiladi (blocking
 * buyruqlar `BRPOPLPUSH` cheksiz kutadi). Bir xil klient sozlamasini
 * throttler/lock uchun ham ishlatamiz — ular qisqa buyruqlar yuboradi,
 * ya'ni bu ularga zarar qilmaydi.
 *
 * TLS: Upstash va shunga o'xshash provayderlar `rediss://` beradi.
 * `ioredis` sxemadan TLS'ni O'ZI aniqlaydi — qo'lda `tls: {}` berish
 * SHART EMAS va noto'g'ri berilsa sertifikat tekshiruvini buzardi.
 */
@Injectable()
export class RedisService implements OnApplicationShutdown {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private initialised = false;
  private lastError: string | null = null;

  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  /** `REDIS_URL` berilganmi (ulanish holati emas, KONFIGURATSIYA holati). */
  isConfigured(): boolean {
    return Boolean(this.env.REDIS_URL?.trim());
  }

  /**
   * Umumiy klient. `REDIS_URL` yo'q bo'lsa `null` — chaqiruvchi fallback
   * qiladi. Klient LAZY yaratiladi: modul yuklanishida ulanmaydi, ya'ni
   * Redis o'chik bo'lsa ham ilova ko'tariladi.
   */
  getClient(): Redis | null {
    if (!this.isConfigured()) return null;
    if (!this.initialised) {
      this.initialised = true;
      this.client = this.createClient('main');
    }
    return this.client;
  }

  /**
   * Pub/sub uchun ALOHIDA klient. Redis protokolida `SUBSCRIBE` qilgan
   * ulanish boshqa buyruqlarni QABUL QILMAYDI — umumiy klientni obuna
   * qilish throttler va lock'ni ishdan chiqarardi.
   */
  createDedicatedClient(purpose: string): Redis | null {
    if (!this.isConfigured()) return null;
    return this.createClient(purpose);
  }

  private createClient(purpose: string): Redis {
    const options: RedisOptions = {
      // BullMQ talabi; qisqa buyruqlarga zarari yo'q.
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: false,
      connectionName: `agentnet-${purpose}`,
      // Eksponensial, lekin CHEGARALANGAN qayta-ulanish: cheksiz tez
      // urinish provayder tomonidan rate-limit qilinishga olib kelardi.
      retryStrategy: (times) => Math.min(times * 200, 5_000),
    };
    const client = new Redis(this.env.REDIS_URL as string, options);

    client.on('error', (err: Error) => {
      // Redis uzilishi ilovani YIQITMAYDI — faqat qayd etiladi va
      // sog'liq hisobotida ko'rinadi.
      this.lastError = err.message;
      this.logger.warn(`Redis xatosi (${purpose}): ${err.message}`);
    });
    client.on('ready', () => {
      this.lastError = null;
      this.logger.log(`Redis ulandi (${purpose})`);
    });
    return client;
  }

  /** Sog'liq uchun: `PING` + kechikish. Konfiguratsiya yo'q bo'lsa `skipped`. */
  async ping(): Promise<{ ok: boolean; latencyMs?: number; code?: string }> {
    const client = this.getClient();
    if (!client) return { ok: false, code: 'redis_url_unset' };
    const startedAt = Date.now();
    try {
      const reply = await client.ping();
      if (reply !== 'PONG') return { ok: false, code: 'redis_bad_reply' };
      return { ok: true, latencyMs: Date.now() - startedAt };
    } catch (e) {
      return { ok: false, latencyMs: Date.now() - startedAt, code: (e as Error).message };
    }
  }

  lastConnectionError(): string | null {
    return this.lastError;
  }

  /**
   * Graceful shutdown. `quit()` navbatdagi buyruqlarni tugatib uzadi
   * (`disconnect()` esa DARHOL uzardi va ish-vaqtidagi buyruqni yo'qotardi).
   */
  async onApplicationShutdown(): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.quit();
      this.logger.log('Redis ulanishi yopildi');
    } catch {
      this.client.disconnect();
    } finally {
      this.client = null;
      this.initialised = false;
    }
  }
}
