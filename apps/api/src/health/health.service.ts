import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Phase 5 (P5.5) — OPERATSION SOG'LIQ TEKSHIRUVI.
 *
 * UCH ENDPOINT, UCH XIL MAQSAD (ularni aralashtirish — klassik xato):
 *   • `/api/health/live`  — jarayon tirikmi. HECH QANDAY bog'liqlikka
 *     tegmaydi. Orkestrator buni ko'rib POD'NI QAYTA ISHGA TUSHIRADI:
 *     agar u DB'ni tekshirsa, DB uzilganda butun park cheksiz restart
 *     tsikliga tushardi (DB'ni tiklash O'RNIGA — halokat kuchaytirgichi).
 *   • `/api/health/ready` — trafik qabul qila oladimi. Faqat MAJBURIY
 *     bog'liqliklar: Postgres va kritik konfiguratsiya. Load-balancer
 *     buni ko'rib instansni rotatsiyadan chiqaradi.
 *   • `/api/health`       — diagnostik XULOSA (odam/monitoring uchun).
 *     Ixtiyoriy bog'liqliklar (engine) ham ko'rinadi, LEKIN ular
 *     statusni 503 ga TUSHIRMAYDI.
 *
 * XAVFSIZLIK CHEGARASI (P5.5 talabi, testlar bilan qulflangan):
 *   • ulanish satri, host, port, foydalanuvchi nomi — YO'Q;
 *   • token/kalit — YO'Q;
 *   • stack-trace va DB xato matni — YO'Q (xato faqat `ok|error` va
 *     ichki `code` sifatida chiqadi; to'liq matn SERVER logida qoladi).
 *
 * DDoS QARSHILIGI: tekshiruv natijasi qisqa muddat KESHLANADI
 * (`HEALTH_CACHE_MS`, default 5000ms). Ya'ni sekundiga 10 000 so'rov
 * kelsa ham DB'ga sekundiga BITTA `SELECT 1` tushadi. `/live` esa umuman
 * I/O qilmaydi.
 */

export type DependencyStatus = 'ok' | 'error' | 'timeout' | 'skipped';

export interface DependencyResult {
  status: DependencyStatus;
  /** Millisekund — faqat o'lchov, hech qanday ichki manzil emas. */
  latencyMs?: number;
  /** Qisqa MASHINA kodi (odam o'qiydigan xato matni EMAS). */
  code?: string;
}

export interface ReadinessReport {
  ready: boolean;
  checks: Record<string, DependencyResult>;
}

export interface HealthReport {
  status: 'ok' | 'degraded' | 'error';
  service: string;
  environment: string;
  version: string;
  uptimeSec: number;
  ts: string;
  checks: Record<string, DependencyResult>;
}

const DEFAULT_TIMEOUT_MS = 2000;
const DEFAULT_CACHE_MS = 5000;

function intEnv(key: string, fallback: number, env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env[key]);
  return Number.isFinite(raw) && raw >= 0 ? raw : fallback;
}

/**
 * Va'daga qat'iy muddat qo'yadi.
 *
 * NEGA MAJBURIY: `SELECT 1` osilib qolsa (masalan pool to'lgan yoki
 * tarmoq qora tuynugi), healthcheck ham osilib qolardi — va orkestrator
 * "javob yo'q" deb butun instansni o'ldirardi. Timeout bilan biz aniq
 * "DB javob bermayapti" DEB AYTAMIZ, bu boshqa hodisa.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<{ ok: true; value: T } | { ok: false; reason: 'timeout' }> {
  let timer: NodeJS.Timeout | undefined;
  try {
    const timeout = new Promise<{ ok: false; reason: 'timeout' }>((resolve) => {
      timer = setTimeout(() => resolve({ ok: false, reason: 'timeout' }), timeoutMs);
      // Node jarayonini bu taymer tirik ushlab turmasin.
      timer.unref?.();
    });
    const result = await Promise.race([promise.then((value) => ({ ok: true as const, value })), timeout]);
    return result;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly startedAt = Date.now();
  private cache: { at: number; report: HealthReport } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /** Jarayon tirik — I/O YO'Q, doim arzon. */
  live(): { status: 'ok'; service: string; uptimeSec: number; ts: string } {
    return {
      status: 'ok',
      service: 'api',
      uptimeSec: Math.round((Date.now() - this.startedAt) / 1000),
      ts: new Date().toISOString(),
    };
  }

  /** Postgres — MAJBURIY bog'liqlik (Konstitutsiya: yagona haqiqat manbai). */
  async checkDatabase(env: NodeJS.ProcessEnv = process.env): Promise<DependencyResult> {
    const timeoutMs = intEnv('HEALTH_DB_TIMEOUT_MS', DEFAULT_TIMEOUT_MS, env);
    const startedAt = Date.now();
    try {
      // ATAYLAB eng arzon so'rov. Jadval sanash/`count()` kabi so'rovlar
      // healthcheck'ni DB yukiga aylantirardi (P5.5: "qimmat so'rov yo'q").
      const result = await withTimeout(this.prisma.$queryRaw`SELECT 1`, timeoutMs);
      if (!result.ok) return { status: 'timeout', latencyMs: Date.now() - startedAt, code: 'db_timeout' };
      return { status: 'ok', latencyMs: Date.now() - startedAt };
    } catch (e) {
      // To'liq xato SERVER logida (u yerda ulanish satri bo'lishi mumkin —
      // shuning uchun HTTP javobiga CHIQMAYDI).
      this.logger.error(`Health: DB tekshiruvi muvaffaqiyatsiz: ${(e as Error).message}`);
      return { status: 'error', latencyMs: Date.now() - startedAt, code: 'db_unreachable' };
    }
  }

  /**
   * Kritik konfiguratsiya joyidami.
   *
   * `validateEnv()` buni BOOT'da tekshiradi va prod'da jarayonni
   * to'xtatadi — bu tekshiruv esa ISHLAB TURGAN jarayon uchun: env
   * guruhi deploy'dan keyin o'zgartirilsa (Render env-group), instans
   * eski qiymat bilan qolishi mumkin. Kalit NOMLARI qaytariladi,
   * QIYMATLARI hech qachon.
   */
  checkConfig(env: NodeJS.ProcessEnv = process.env): DependencyResult {
    const required = ['DATABASE_URL', 'AUTH_JWT_SECRET', 'ENCRYPTION_KEY', 'INTERNAL_API_TOKEN'];
    const missing = required.filter((key) => !env[key]?.trim());
    if (missing.length) {
      // `code` da faqat SONI — qaysi kalit yo'qligi ham razvedka
      // ma'lumoti (hujumchi qaysi himoya o'chiqligini bilardi).
      return { status: 'error', code: `config_missing_${missing.length}` };
    }
    return { status: 'ok' };
  }

  /**
   * Engine — IXTIYORIY bog'liqlik `ready` uchun.
   *
   * NEGA IXTIYORIY: engine yiqilsa AI javoblari ishlamaydi, LEKIN
   * balans, to'lov, admin, auth va boshqa hamma narsa ishlayveradi.
   * Uni `ready` ga majburiy qilish — engine uzilganda BUTUN platformani
   * trafikdan chiqarish demak, ya'ni kichik uzilishni to'liq uzilishga
   * aylantirish.
   */
  async checkEngine(env: NodeJS.ProcessEnv = process.env): Promise<DependencyResult> {
    const url = env.AGENT_ENGINE_URL?.trim();
    if (!url) return { status: 'skipped', code: 'engine_url_unset' };
    const timeoutMs = intEnv('HEALTH_ENGINE_TIMEOUT_MS', DEFAULT_TIMEOUT_MS, env);
    const startedAt = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      timer.unref?.();
      try {
        // Engine `/health` — ichki tokensiz ochiq (engine `_OPEN_PATHS`).
        const res = await fetch(`${url.replace(/\/+$/, '')}/health`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          return { status: 'error', latencyMs: Date.now() - startedAt, code: `engine_http_${res.status}` };
        }
        return { status: 'ok', latencyMs: Date.now() - startedAt };
      } finally {
        clearTimeout(timer);
      }
    } catch (e) {
      const aborted = (e as Error).name === 'AbortError';
      return {
        status: aborted ? 'timeout' : 'error',
        latencyMs: Date.now() - startedAt,
        code: aborted ? 'engine_timeout' : 'engine_unreachable',
      };
    }
  }

  /** `/api/health/ready` — faqat MAJBURIY bog'liqliklar. */
  async readiness(env: NodeJS.ProcessEnv = process.env): Promise<ReadinessReport> {
    const [database, config] = [await this.checkDatabase(env), this.checkConfig(env)];
    const ready = database.status === 'ok' && config.status === 'ok';
    return { ready, checks: { database, config } };
  }

  /**
   * `/api/health` — to'liq diagnostik xulosa (keshlangan).
   *
   * `degraded`: majburiy bog'liqliklar joyida, lekin ixtiyoriysi (engine)
   * yo'q. Bu HOLAT 200 qaytaradi — Render `healthCheckPath` shu yerga
   * qaragan bo'lsa, engine uzilishi API deploy'ini yiqitmasin.
   */
  async report(env: NodeJS.ProcessEnv = process.env): Promise<HealthReport> {
    const cacheMs = intEnv('HEALTH_CACHE_MS', DEFAULT_CACHE_MS, env);
    const now = Date.now();
    if (this.cache && now - this.cache.at < cacheMs) return this.cache.report;

    const [database, engine] = await Promise.all([this.checkDatabase(env), this.checkEngine(env)]);
    const config = this.checkConfig(env);

    const required = [database, config];
    const status: HealthReport['status'] = required.some((c) => c.status !== 'ok')
      ? 'error'
      : engine.status === 'ok' || engine.status === 'skipped'
        ? 'ok'
        : 'degraded';

    const report: HealthReport = {
      status,
      service: 'api',
      environment: env.SENTRY_ENVIRONMENT?.trim() || env.NODE_ENV?.trim() || 'development',
      // Versiya — Render `RENDER_GIT_COMMIT` yoki qo'lda qo'yilgan
      // `SENTRY_RELEASE`. Sir emas, lekin bo'lmasa "unknown".
      version: (env.SENTRY_RELEASE || env.RENDER_GIT_COMMIT || 'unknown').slice(0, 40),
      uptimeSec: Math.round((now - this.startedAt) / 1000),
      ts: new Date(now).toISOString(),
      checks: { database, config, engine },
    };

    this.cache = { at: now, report };
    return report;
  }

  /** Testlar uchun — keshni bo'shatadi. */
  clearCache(): void {
    this.cache = null;
  }
}
