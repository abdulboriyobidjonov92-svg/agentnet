import * as Sentry from '@sentry/node';
import type { Breadcrumb, ErrorEvent, EventHint } from '@sentry/node';
import { REDACTED, scrubHeaders, scrubText, scrubValue } from './redaction';

/**
 * Phase 5 (P5.1) — Sentry (NestJS API).
 *
 * NEGA `@sentry/node`, `@sentry/nestjs` EMAS:
 * `@sentry/nestjs` o'zining `SentryGlobalFilter`ini global `APP_FILTER`
 * sifatida qo'yishni taklif qiladi. Bizda allaqachon `AllExceptionsFilter`
 * bor va u HTTP javob shartnomasini (SEC-08 413 yo'li, `reason` kodlari,
 * 5xx yashirish) belgilaydi. Ikkinchi global filtr qo'shish yo tartib
 * ziddiyatiga, yo HAR XATONI IKKI MARTA yuborishga olib kelardi.
 * Shuning uchun: SDK'ning o'zi (`@sentry/node`) ishlatiladi, xato esa
 * MAVJUD filtrdan BIR MARTA yuboriladi. Javob shakli o'zgarmaydi.
 *
 * FAOLLASHTIRISH SHARTLARI (uchalasi ham bajarilishi kerak):
 *   1. `SENTRY_DSN` mavjud va bo'sh emas;
 *   2. `NODE_ENV !== 'test'` — test to'plami hech qachon tarmoqqa chiqmaydi;
 *   3. `SENTRY_ENABLED !== '0'` — operator uchun favqulodda o'chirgich.
 * DSN yo'q bo'lsa SDK UMUMAN init qilinmaydi: `Sentry.captureException`
 * "no-op" bo'ladi (SDK shartnomasi), ya'ni sozlanmagan Sentry ilovani
 * hech qanday yo'l bilan yiqita olmaydi.
 */

export interface SentryRuntimeConfig {
  enabled: boolean;
  dsn: string;
  environment: string;
  release?: string;
  tracesSampleRate: number;
  reason?: string;
}

const SERVICE_NAME = 'agentnet-api';

/** `SENTRY_TRACES_SAMPLE_RATE` — 0..1 oralig'idan tashqarisi 0 ga tushadi. */
function parseSampleRate(raw: string | undefined): number {
  if (!raw) return 0;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 1) return 0;
  return value;
}

export function resolveSentryConfig(env: NodeJS.ProcessEnv = process.env): SentryRuntimeConfig {
  const dsn = env.SENTRY_DSN?.trim() ?? '';
  const environment = env.SENTRY_ENVIRONMENT?.trim() || env.NODE_ENV?.trim() || 'development';
  const base = {
    dsn,
    environment,
    release: env.SENTRY_RELEASE?.trim() || undefined,
    tracesSampleRate: parseSampleRate(env.SENTRY_TRACES_SAMPLE_RATE),
  };

  if (!dsn) return { ...base, enabled: false, reason: 'dsn_missing' };
  if (env.NODE_ENV === 'test') return { ...base, enabled: false, reason: 'test_env' };
  if (env.SENTRY_ENABLED === '0') return { ...base, enabled: false, reason: 'disabled_by_env' };

  return { ...base, enabled: true };
}

/**
 * Hodisani yuborishdan OLDIN tozalaydi.
 *
 * Bu — oxirgi darvoza: SDK ushlagan har qanday xato shu funksiyadan
 * o'tadi. `null` qaytarilsa hodisa umuman yuborilmaydi.
 */
export function scrubSentryEvent(
  event: ErrorEvent,
  _hint?: EventHint,
  env: NodeJS.ProcessEnv = process.env,
): ErrorEvent | null {
  if (event.message) event.message = scrubText(event.message, env);

  if (event.request) {
    const req = event.request;
    if (req.headers) req.headers = scrubHeaders(req.headers, env) as Record<string, string>;
    // Cookie'lar — sessiya va impersonation tokeni. HECH QACHON.
    if (req.cookies) req.cookies = { [REDACTED]: REDACTED };
    if (typeof req.query_string === 'string') req.query_string = scrubText(req.query_string, env);
    if (typeof req.url === 'string') req.url = scrubText(req.url, env);
    if (req.data !== undefined) req.data = scrubValue(req.data, env);
  }

  for (const value of event.exception?.values ?? []) {
    if (value.value) value.value = scrubText(value.value, env);
    for (const frame of value.stacktrace?.frames ?? []) {
      // Lokal o'zgaruvchilar — bu yerda dekriptlangan konnektor
      // kredensiali yoki `INTERNAL_API_TOKEN` turishi MUMKIN.
      if (frame.vars) frame.vars = scrubValue(frame.vars, env) as Record<string, unknown>;
    }
  }

  if (event.extra) event.extra = scrubValue(event.extra, env) as Record<string, unknown>;
  if (event.contexts) event.contexts = scrubValue(event.contexts, env) as typeof event.contexts;

  if (event.tags) {
    for (const [key, value] of Object.entries(event.tags)) {
      if (typeof value === 'string') event.tags[key] = scrubText(value, env);
    }
  }

  /**
   * FOYDALANUVCHI IDENTIFIKATSIYASI — faqat `id`.
   *
   * Email/telefon/IP — shaxsiy ma'lumot (GDPR va mahalliy talab). `id`
   * cuid bo'lib, u qo'llab-quvvatlash uchun yetarli: operator uni admin
   * panelda ochadi. Ya'ni diagnostika kuchi yo'qolmaydi, PII esa
   * telemetriyada umuman paydo bo'lmaydi.
   */
  if (event.user) {
    event.user = event.user.id ? { id: String(event.user.id) } : {};
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((crumb) => scrubBreadcrumb(crumb, env) ?? { type: 'default' });
  }

  return event;
}

/**
 * Breadcrumb — Sentry avtomatik yig'adigan "oxirgi 100 hodisa" izi.
 *
 * Bu — eng jim sizish yo'li: HTTP breadcrumb'lari URL'ni (query bilan),
 * console breadcrumb'lari esa `console.log` argumentlarini olib yuradi.
 * Shuning uchun matn ham, `data` ham tozalanadi.
 */
export function scrubBreadcrumb(
  crumb: Breadcrumb,
  env: NodeJS.ProcessEnv = process.env,
): Breadcrumb | null {
  const out: Breadcrumb = { ...crumb };
  if (out.message) out.message = scrubText(out.message, env);
  if (out.data) out.data = scrubValue(out.data, env) as Record<string, unknown>;
  return out;
}

let initialized = false;

/** Testlar uchun — modul holatini qayta tiklaydi. */
export function resetSentryInitState(): void {
  initialized = false;
}

export function isSentryInitialized(): boolean {
  return initialized;
}

/**
 * SDK'ni ishga tushiradi. `main.ts` da NestFactory'dan OLDIN chaqiriladi
 * (boot paytidagi xatolar ham qamrab olinsin).
 *
 * @returns faollashtirildimi (test/hujjat uchun)
 */
export function initSentry(env: NodeJS.ProcessEnv = process.env): boolean {
  if (initialized) return true;
  const config = resolveSentryConfig(env);
  if (!config.enabled) return false;

  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    release: config.release,
    tracesSampleRate: config.tracesSampleRate,
    /**
     * `sendDefaultPii: false` — SDK IP manzil, cookie va so'rov tanasini
     * O'ZI qo'shmaydi. Bu `beforeSend` tozalashiga QO'SHIMCHA qatlam:
     * biror maydon ro'yxatimizdan chetda qolsa ham, u umuman yig'ilmaydi.
     */
    sendDefaultPii: false,
    /**
     * Lokal o'zgaruvchilar stack-frame'ga qo'shilmaydi. Ular
     * `beforeSend`da tozalanadi, LEKIN eng xavfsiz yo'l — umuman
     * yig'maslik (dekriptlangan konnektor kredensiali aynan shu yerda
     * ko'rinardi).
     */
    includeLocalVariables: false,
    maxBreadcrumbs: 30,
    beforeSend: (event, hint) => scrubSentryEvent(event, hint, env),
    beforeBreadcrumb: (crumb) => scrubBreadcrumb(crumb, env),
    initialScope: { tags: { service: SERVICE_NAME } },
  });

  initialized = true;
  return true;
}

/**
 * Xatoni Sentry'ga yuboradi — SOZLANMAGAN bo'lsa jimgina hech narsa
 * qilmaydi va HECH QACHON tashlamaydi.
 *
 * NEGA `try/catch`: bu funksiya global xato-filtridan chaqiriladi. Agar
 * u tashlasa, xato ishlov berish YO'LINING O'ZI qulardi va foydalanuvchi
 * javob olmasdi. Kuzatuv tizimi hech qachon ilovani yiqitmaydi.
 */
export function captureException(
  error: unknown,
  context?: { requestId?: string; route?: string; method?: string; statusCode?: number; userId?: string },
): void {
  if (!initialized) return;
  try {
    Sentry.withScope((scope) => {
      if (context?.requestId) scope.setTag('request_id', context.requestId);
      if (context?.route) scope.setTag('route', context.route);
      if (context?.method) scope.setTag('http_method', context.method);
      if (typeof context?.statusCode === 'number') scope.setTag('status_code', String(context.statusCode));
      if (context?.userId) scope.setUser({ id: context.userId });
      Sentry.captureException(error);
    });
  } catch {
    // Ataylab jim: telemetriya nosozligi so'rovga ta'sir qilmaydi.
  }
}

/** Operatsion signal (alert) uchun — xato emas, xabar sifatida. */
export function captureMessage(message: string, level: 'warning' | 'error' = 'warning'): void {
  if (!initialized) return;
  try {
    Sentry.captureMessage(scrubText(message), level);
  } catch {
    // Ataylab jim.
  }
}
