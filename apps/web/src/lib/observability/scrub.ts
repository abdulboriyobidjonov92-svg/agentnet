/**
 * Phase 5 (P5.1) — BFF/klient tomonidagi telemetriya redaksiyasi.
 *
 * NEGA API'DAGI `redaction.ts` QAYTA ISHLATILMAYDI: `apps/api` va
 * `apps/web` alohida paketlar; API moduli Node'ga bog'langan
 * (`process.env` bo'yicha skan, `AsyncLocalStorage` bilan bir faylda) va
 * u Edge/brauzer bundle'ida ishlamaydi. Umumiy paket yaratish esa
 * Contract A32 ni (`packages/shared-types` — REMOVE) buzardi.
 *
 * Shu sababli bu yerda ATAYLAB KICHIK, muhitdan mustaqil nusxa turadi:
 * u faqat SHAKL bo'yicha ishlaydi (brauzerda env sirlari umuman yo'q,
 * server tomonda esa haqiqiy sirlar `serverSecretValues()` orqali
 * qo'shiladi). Ikkala fayl ham `docs/status/phase5-observability-audit.md`
 * da yagona ro'yxat sifatida hujjatlashtirilgan.
 */

export const REDACTED = "[REDACTED]";

const SECRET_PATTERNS: RegExp[] = [
  // HS256 sessiya/impersonation tokeni (httpOnly cookie ichida yuradi).
  /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}/g,
  /\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi,
  /\bsk-(?:ant-)?[A-Za-z0-9_-]{12,}/g,
  /\bre_[A-Za-z0-9_-]{16,}/g,
  /\b\d{6,12}:[A-Za-z0-9_-]{30,}\b/g,
  /\b(postgres(?:ql)?|redis(?:s)?|mongodb(?:\+srv)?|mysql):\/\/[^\s'"<>]*@[^\s'"<>]*/gi,
  // Sessiya cookie'lari nom bilan (`agentnet_token=...`).
  /\bagentnet_(?:token|imp)=[^;\s]+/gi,
];

const SENSITIVE_KEY_PARTS = [
  "password",
  "secret",
  "token",
  "apikey",
  "api_key",
  "authorization",
  "cookie",
  "credential",
  "encrypted",
  "otp",
];

/** `tokensIn` kabi billing hisoblagichlari sir EMAS (API bilan bir xil qoida). */
const KEY_ALLOWLIST = ["tokensin", "tokensout", "tokenversion", "maxtokens"];

/**
 * SERVER tomonda mavjud haqiqiy sirlar. Brauzer bundle'ida
 * `process.env` deyarli bo'sh — shuning uchun bu funksiya u yerda
 * bo'sh ro'yxat qaytaradi va hech narsa buzilmaydi.
 */
function serverSecretValues(): string[] {
  const keys = [
    "AUTH_JWT_SECRET",
    "INTERNAL_API_TOKEN",
    "ENCRYPTION_KEY",
    "DATABASE_URL",
    "SENTRY_AUTH_TOKEN",
  ];
  const values: string[] = [];
  for (const key of keys) {
    const value = typeof process !== "undefined" ? process.env?.[key]?.trim() : undefined;
    if (value && value.length >= 8) values.push(value);
  }
  return values.sort((a, b) => b.length - a.length);
}

export function scrubText(input: string): string {
  if (!input) return input;
  let out = input;
  for (const value of serverSecretValues()) {
    if (out.includes(value)) out = out.split(value).join(REDACTED);
  }
  for (const pattern of SECRET_PATTERNS) out = out.replace(pattern, REDACTED);
  return out;
}

export function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (KEY_ALLOWLIST.includes(normalized)) return false;
  return SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part));
}

const MAX_DEPTH = 5;

export function scrubValue(value: unknown, depth = 0): unknown {
  if (value == null) return value;
  if (depth > MAX_DEPTH) return "[Depth limit]";
  if (typeof value === "string") return scrubText(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => scrubValue(item, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = isSensitiveKey(key) ? REDACTED : scrubValue(item, depth + 1);
    }
    return out;
  }
  return undefined;
}

interface ScrubbableEvent {
  message?: string;
  request?: {
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
    data?: unknown;
    url?: string;
    query_string?: unknown;
  };
  exception?: { values?: Array<{ value?: string }> };
  extra?: Record<string, unknown>;
  user?: { id?: unknown; email?: unknown; ip_address?: unknown; username?: unknown };
  breadcrumbs?: Array<{ message?: string; data?: Record<string, unknown> }>;
}

/**
 * Sentry `beforeSend` uchun yagona tozalash — server, edge va klient
 * konfiguratsiyalari AYNAN SHUNI chaqiradi (uchta nusxa qoida bo'lmasin).
 */
export function scrubSentryEvent<T extends ScrubbableEvent>(event: T): T {
  if (event.message) event.message = scrubText(event.message);

  if (event.request) {
    if (event.request.headers) {
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(event.request.headers)) {
        headers[key] = isSensitiveKey(key) ? REDACTED : scrubText(String(value));
      }
      event.request.headers = headers;
    }
    // Sessiya va impersonation tokeni — HECH QACHON.
    if (event.request.cookies) event.request.cookies = { [REDACTED]: REDACTED };
    if (typeof event.request.url === "string") event.request.url = scrubText(event.request.url);
    if (typeof event.request.query_string === "string") {
      event.request.query_string = scrubText(event.request.query_string);
    }
    if (event.request.data !== undefined) event.request.data = scrubValue(event.request.data);
  }

  for (const value of event.exception?.values ?? []) {
    if (value.value) value.value = scrubText(value.value);
  }

  if (event.extra) event.extra = scrubValue(event.extra) as Record<string, unknown>;

  // Foydalanuvchi — faqat `id` (email/telefon/IP telemetriyaga chiqmaydi).
  if (event.user) event.user = event.user.id ? { id: String(event.user.id) } : {};

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((crumb) => ({
      ...crumb,
      message: crumb.message ? scrubText(crumb.message) : crumb.message,
      data: crumb.data ? (scrubValue(crumb.data) as Record<string, unknown>) : crumb.data,
    }));
  }

  return event;
}

/**
 * Sentry yoqilganmi. `NEXT_PUBLIC_SENTRY_DSN` (klient) va `SENTRY_DSN`
 * (server) alohida: klient DSN'i bundle'ga tushadi — bu Sentry uchun
 * normal, LEKIN server DSN'i hech qachon klientga chiqmasligi kerak.
 */
export function serverSentryDsn(): string {
  return process.env.SENTRY_DSN?.trim() ?? "";
}

export function clientSentryDsn(): string {
  return process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() ?? "";
}

export function sentryEnabled(dsn: string): boolean {
  if (!dsn) return false;
  if (process.env.NODE_ENV === "test") return false;
  if (process.env.NEXT_PUBLIC_SENTRY_ENABLED === "0" || process.env.SENTRY_ENABLED === "0") return false;
  return true;
}

export function sentryEnvironment(): string {
  return (
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT?.trim() ||
    process.env.SENTRY_ENVIRONMENT?.trim() ||
    process.env.NODE_ENV ||
    "development"
  );
}

/**
 * DSN'dan ingest origin'ini ajratadi — CSP `connect-src` uchun.
 * DSN yaroqsiz bo'lsa bo'sh satr (CSP kengaymaydi — fail-closed).
 */
export function sentryIngestOrigin(dsn: string): string {
  if (!dsn) return "";
  try {
    return new URL(dsn).origin;
  } catch {
    return "";
  }
}
