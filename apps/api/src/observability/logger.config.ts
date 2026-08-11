import type { IncomingMessage, ServerResponse } from 'http';
import { REDACTED, isSensitiveKey, scrubText, scrubValue } from './redaction';
import { REQUEST_ID_HEADER, generateRequestId, resolveRequestId } from './request-id';

/**
 * Phase 5 (P5.2) — STRUKTURAVIY LOG (pino), ADR-014 ijrosi.
 *
 * UCH TOIFA LOGNI ARALASHTIRMAYMIZ (Contract talabi):
 *   • OPERATSION log        — shu modul (HTTP so'rov, xato, davomiylik);
 *   • XAVFSIZLIK/AUDIT log  — `AuditLog` JADVALI (hash-zanjir, ADR-008).
 *                             U DB'da yashaydi va bu yerda O'ZGARMAYDI;
 *   • BIZNES hodisalari     — mavjud `Logger` chaqiruvlari servislarda.
 * `nestjs-pino` mavjud `new Logger(...)` chaqiruvlarini ALMASHTIRMAYDI —
 * u faqat ularning CHIQISH FORMATINI JSON'ga o'tkazadi. Ya'ni hech bir
 * biznes/audit logi o'chirilmadi va qayta yozilmadi.
 *
 * MAJBURIY MAYDONLAR (ADR-014 + P5.2): `level, time, service, env, reqId,
 * method, url, statusCode, responseTime, err.type, err.code`.
 */

const SERVICE_NAME = 'agentnet-api';

/**
 * `redact` — pino'ning O'Z qatlami (tez, yo'l bo'yicha).
 *
 * Bu YETARLI EMAS (u faqat aniq yo'llarni biladi), shuning uchun pastda
 * `hooks.logMethod` da CHUQUR tozalash ham bor. Ikkalasi birga:
 * ro'yxatdagi yo'l — arzon va aniq; qolgan hamma narsa — chuqur skan.
 */
export const REDACT_PATHS: string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-internal-token"]',
  'req.headers["x-companion-token"]',
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',
  'headers.authorization',
  'headers.cookie',
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'apiKey',
  'secret',
  'authorization',
  '*.password',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.apiKey',
  '*.secret',
  '*.authorization',
  '*.encryptedValue',
  '*.storageState',
];

/** Health yo'llari — Render/uptime har necha soniyada ping qiladi. */
export function isHealthPath(url: string | undefined): boolean {
  if (!url) return false;
  const path = url.split('?')[0];
  return path === '/api/health' || path.startsWith('/api/health/');
}

const MAX_URL_LENGTH = 512;

/**
 * So'rovni logga tayyorlaydi.
 *
 * SARLAVHALAR UMUMAN CHIQMAYDI (ro'yxat bo'yicha emas, BUTUNLAY): kerakli
 * yagona sarlavha — request-id, u alohida maydonda. Sarlavhani "tozalab"
 * chiqarish har yangi sir-sarlavha turida ro'yxatni yangilashni talab
 * qilardi; chiqarmaslik — nol-eslab-qolish yechimi.
 *
 * IP MANZIL YO'Q: ADR-014 "PII hech qachon logga tushmaydi" deydi va IP
 * shaxsiy ma'lumot hisoblanadi. Xavfsizlik tergovi uchun IP `AuditLog`
 * metadata'sida (huquqiy asosli, cheklangan kirishli joyda) qoladi.
 */
export function serializeRequest(req: IncomingMessage & { id?: unknown; url?: string; method?: string }) {
  const rawUrl = typeof req.url === 'string' ? req.url : '';
  const url = scrubText(rawUrl).slice(0, MAX_URL_LENGTH);
  return {
    id: typeof req.id === 'string' ? req.id : undefined,
    method: req.method,
    url,
  };
}

export function serializeResponse(res: ServerResponse) {
  return { statusCode: res.statusCode };
}

/**
 * Xato serializatsiyasi — `err.type` (sinf nomi) va `err.code` (mavjud
 * bo'lsa) MAJBURIY maydonlar (P5.2 talabi), stack esa tozalanadi.
 */
export function serializeError(err: unknown) {
  if (!(err instanceof Error)) {
    return { type: typeof err, message: scrubText(String(err)) };
  }
  const withCode = err as Error & { code?: unknown; status?: unknown; statusCode?: unknown };
  return {
    type: err.name,
    message: scrubText(err.message),
    stack: err.stack ? scrubText(err.stack) : undefined,
    code:
      typeof withCode.code === 'string' || typeof withCode.code === 'number' ? withCode.code : undefined,
    statusCode:
      typeof withCode.status === 'number'
        ? withCode.status
        : typeof withCode.statusCode === 'number'
          ? withCode.statusCode
          : undefined,
  };
}

/**
 * Log darajasi javob statusiga qarab.
 * 5xx → error, 4xx → warn, qolgani → info. Health → silent (autoLogging
 * `ignore` bilan birga ikkinchi to'siq).
 */
export type HttpLogLevel = 'silent' | 'error' | 'warn' | 'info';

export function resolveLogLevel(
  req: { url?: string },
  res: { statusCode: number },
  err?: unknown,
): HttpLogLevel {
  if (isHealthPath(req.url)) return 'silent';
  if (err) return 'error';
  if (res.statusCode >= 500) return 'error';
  if (res.statusCode >= 400) return 'warn';
  return 'info';
}

/**
 * Har log chaqiruvining argumentlarini CHUQUR tozalaydi.
 *
 * NEGA `redact` yetarli emas: `redact` faqat OLDINDAN AYTILGAN yo'llarni
 * biladi. Biror servis `logger.error(\`... ${token} ...\`)` deb yozsa yoki
 * kutilmagan shakldagi obyekt bersa, `redact` uni KO'RMAYDI. Bu hook esa
 * har argumentni (satr — naqsh bo'yicha, obyekt — nom+qiymat bo'yicha)
 * o'tkazadi.
 *
 * `Error` instansi ATAYLAB o'zgartirilmaydi — u `serializeError` ga
 * tushadi va o'sha yerda tozalanadi (shakl saqlanadi).
 */
export function scrubLogArguments(args: unknown[]): unknown[] {
  return args.map((arg) => {
    if (typeof arg === 'string') return scrubText(arg);
    if (arg instanceof Error) return arg;
    if (arg && typeof arg === 'object') return scrubValue(arg);
    return arg;
  });
}

export interface PinoOptionsInput {
  env?: NodeJS.ProcessEnv;
}

/**
 * `nestjs-pino` uchun `pinoHttp` konfiguratsiyasi.
 *
 * PROD — bitta qatorli JSON (log agregatori o'qishi uchun).
 * DEV  — `pino-pretty` (odam o'qishi uchun). Pretty transport prod'da
 * ATAYLAB yoqilmaydi: u qo'shimcha jarayon (worker thread) ochadi va
 * strukturani yo'qotadi.
 */
export function buildPinoHttpOptions(input: PinoOptionsInput = {}) {
  const env = input.env ?? process.env;
  const isProd = env.NODE_ENV === 'production';
  const isTest = env.NODE_ENV === 'test';
  const level = env.LOG_LEVEL?.trim() || (isTest ? 'silent' : isProd ? 'info' : 'debug');

  return {
    level,
    /**
     * Bitta manba: request-id `resolveRequestId` orqali hal qilinadi
     * (P5.3 siyosati) — pino o'zining ketma-ket raqamini ISHLATMAYDI.
     */
    genReqId: (req: IncomingMessage, res: ServerResponse): string => {
      const existing = req.headers[REQUEST_ID_HEADER];
      const id = resolveRequestId(existing, env);
      req.headers[REQUEST_ID_HEADER] = id;
      if (!res.headersSent) res.setHeader('X-Request-Id', id);
      return id;
    },
    autoLogging: {
      ignore: (req: IncomingMessage) => isHealthPath(req.url),
    },
    customLogLevel: resolveLogLevel,
    customProps: (req: IncomingMessage & { id?: unknown }) => ({
      reqId: typeof req.id === 'string' ? req.id : undefined,
    }),
    serializers: {
      req: serializeRequest,
      res: serializeResponse,
      err: serializeError,
    },
    redact: { paths: REDACT_PATHS, censor: REDACTED },
    /** MAJBURIY maydonlar har yozuvda (P5.2). */
    base: {
      service: SERVICE_NAME,
      env: env.SENTRY_ENVIRONMENT?.trim() || env.NODE_ENV?.trim() || 'development',
    },
    /** ISO-8601 vaqt — epoch millisekund emas (odam va Loki/Grafana o'qiydi). */
    timestamp: () => `,"time":"${new Date().toISOString()}"`,
    formatters: {
      // `level: "info"` — raqam (30) emas. Log agregatorida filtr shu nom bo'yicha.
      level: (label: string) => ({ level: label }),
    },
    hooks: {
      logMethod(this: unknown, args: unknown[], method: (...a: unknown[]) => void) {
        return method.apply(this, scrubLogArguments(args));
      },
    },
    ...(isProd || isTest
      ? {}
      : {
          transport: {
            target: 'pino-pretty',
            options: { singleLine: true, translateTime: 'HH:MM:ss.l', ignore: 'pid,hostname' },
          },
        }),
  };
}

/** `redaction.ts` bilan bir xil qoidani obyekt kalitiga qo'llash (testlar uchun). */
export { isSensitiveKey, generateRequestId };
