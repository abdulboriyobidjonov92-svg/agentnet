/**
 * Phase 5 — TELEMETRIYA REDAKSIYASI (yagona manba).
 *
 * Bu fayl AGENTNET'ning "sir hech qachon kuzatuv tizimiga chiqmaydi"
 * qoidasining YAGONA ijro nuqtasi. Uni UCHTA iste'molchi ishlatadi:
 *   • `logger.config.ts` — pino redact + xabar-matni tozalash;
 *   • `sentry.ts`        — `beforeSend` / `beforeBreadcrumb`;
 *   • `alerts/*`         — signal payload'i.
 *
 * NEGA YAGONA MANBA: uch joyda uchta ro'yxat bo'lsa, yangi sir turi
 * (masalan yangi konnektor kaliti) ikkitasida unutiladi — va aynan
 * unutilgan joydan sizadi. Konstitutsiya #4 (shifrlash yagona nuqtadan)
 * bilan bir xil mantiq, faqat teskari yo'nalishda.
 *
 * IKKI QATLAM (ikkalasi ham kerak):
 *   1. NOM bo'yicha — kalit/sarlavha nomi ma'lum sir bo'lsa, qiymat
 *      qaramasdan olib tashlanadi (`authorization`, `password`, ...).
 *   2. QIYMAT bo'yicha — matn ichida sir SHAKLI (JWT, `sk-ant-...`,
 *      `postgresql://user:pass@`) yoki jarayonning HAQIQIY env sirlari
 *      uchrasa, ular ham olib tashlanadi. Bu qatlam nomga tayanmaydi:
 *      xato XABARI ichiga tushib qolgan token ham ushlanadi.
 */

export const REDACTED = '[REDACTED]';

/**
 * Qiymati HECH QACHON telemetriyaga chiqmasligi kerak bo'lgan env kalitlari.
 *
 * DIQQAT: bu ro'yxat env NOMLARI emas — ularning QIYMATLARI matn ichida
 * qidiriladi. Ya'ni `ANTHROPIC_API_KEY` haqiqiy qiymati stack-trace yoki
 * xato xabariga tushsa ham, u yerdan olib tashlanadi.
 */
export const SECRET_ENV_KEYS: readonly string[] = [
  // Kripto va auth yadrosi
  'ENCRYPTION_KEY',
  'ENCRYPTION_KEY_PREVIOUS',
  'AUTH_JWT_SECRET',
  'INTERNAL_API_TOKEN',
  // LLM provayderlari
  'ANTHROPIC_API_KEY',
  'GEMINI_API_KEY',
  'GOOGLE_API_KEY',
  // To'lov
  'PAYME_SECRET_KEY',
  'CLICK_SECRET_KEY',
  'PLAID_SECRET',
  // Kommunikatsiya
  'RESEND_API_KEY',
  'TELEGRAM_BOT_TOKEN',
  'ESKIZ_PASSWORD',
  'WHATSAPP_ACCESS_TOKEN',
  // Infratuzilma
  'DATABASE_URL',
  'REDIS_URL',
  'SENTRY_AUTH_TOKEN',
] as const;

/**
 * HTTP sarlavhalari — nomi bo'yicha butunlay olib tashlanadi.
 *
 * `cookie`/`set-cookie` ro'yxatda: sessiya tokeni (`agentnet_token`) va
 * impersonation tokeni (`agentnet_imp`) aynan shu yerda yuradi (BFF
 * httpOnly cookie). Ular Sentry'ga tushsa — hisob o'g'irlash yo'li.
 */
export const SENSITIVE_HEADERS: readonly string[] = [
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-internal-token',
  'x-companion-token',
  'x-api-key',
  'x-auth-token',
  'x-csrf-token',
] as const;

/**
 * Obyekt kalitlari — nomi shu ro'yxatdagi biror so'zni O'Z ICHIGA OLSA
 * (registrga bog'liq emas), qiymat olib tashlanadi.
 *
 * `storagestate` — brauzer-agent sessiya cookie'lari (BOSQICH 0, shifrlangan
 * saqlanadi). `encrypted`/`ciphertext` — CryptoService chiqishi: u shifrlangan
 * bo'lsa ham telemetriyada turishi kerak emas (kalit rotatsiyasi buzilsa
 * arxivlangan log dekriptlash materialiga aylanadi).
 */
export const SENSITIVE_KEY_PARTS: readonly string[] = [
  'password',
  'passwd',
  'secret',
  'token',
  'apikey',
  'api_key',
  'authorization',
  'cookie',
  'credential',
  'privatekey',
  'private_key',
  'encryptionkey',
  'encryption_key',
  'encrypted',
  'ciphertext',
  'storagestate',
  'storage_state',
  'otp',
  'totp',
  'twofactorsecret',
  'sessionkey',
  'session_key',
] as const;

/**
 * Kalit nomida uchrasa ham redaksiya QILINMAYDIGAN istisnolar.
 *
 * NEGA KERAK: `tokensIn`/`tokensOut` (billing — LLM token SONI) va
 * `tokenVersion` (ADR-001 revocation hisoblagichi) nomida "token" bor,
 * lekin ular SIR EMAS — ular diagnostikada ENG kerakli maydonlar. Ularni
 * ham o'chirish redaksiyani "hammasini o'chir" ga aylantirardi, ya'ni
 * kuzatuvni foydasiz qilardi.
 */
const KEY_ALLOWLIST: readonly string[] = [
  'tokensin',
  'tokensout',
  'tokencount',
  'tokenversion',
  'tokenusage',
  'maxtokens',
  'inputtokens',
  'outputtokens',
] as const;

/**
 * Matn ichida sir SHAKLI. Har naqsh — repo'da haqiqatan uchraydigan
 * formatga bog'langan (umumiy "har qanday uzun satr" naqshi ATAYLAB yo'q:
 * u cuid identifikatorlarini ham o'chirib, diagnostikani buzardi).
 */
const SECRET_PATTERNS: ReadonlyArray<{ name: string; re: RegExp }> = [
  // HS256 JWT (ADR-001 sessiya tokeni, impersonation tokeni).
  { name: 'jwt', re: /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}/g },
  // `Authorization: Bearer <...>` xato xabari ichida ko'chirilgan holat.
  { name: 'bearer', re: /\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi },
  // Anthropic / OpenAI uslubidagi kalitlar.
  { name: 'sk-key', re: /\bsk-(?:ant-)?[A-Za-z0-9_-]{12,}/g },
  // Resend.
  { name: 're-key', re: /\bre_[A-Za-z0-9_-]{16,}/g },
  // Telegram bot tokeni (`123456789:AA...`).
  { name: 'telegram', re: /\b\d{6,12}:[A-Za-z0-9_-]{30,}\b/g },
  // Kredensial bilan ulanish satri (DATABASE_URL, REDIS_URL, AMQP...).
  {
    name: 'conn-url',
    re: /\b(postgres(?:ql)?|redis(?:s)?|mongodb(?:\+srv)?|amqps?|mysql):\/\/[^\s'"<>]*@[^\s'"<>]*/gi,
  },
  // Sentry DSN'ning O'ZI ham sir (unga hodisa yuborish mumkin).
  { name: 'sentry-dsn', re: /\bhttps?:\/\/[a-f0-9]{8,}@[^\s'"<>]*sentry[^\s'"<>]*/gi },
];

/**
 * Env'dagi HAQIQIY sir qiymatlari — bir marta hisoblanadi (har log
 * yozuvida `process.env` ni skanerlash qimmat bo'lardi).
 */
let cachedSecretValues: string[] | null = null;

/** Testlar va env qayta o'qilgan holat uchun keshni bo'shatadi. */
export function resetSecretValueCache(): void {
  cachedSecretValues = null;
}

function secretValues(env: NodeJS.ProcessEnv = process.env): string[] {
  if (cachedSecretValues) return cachedSecretValues;
  const values = new Set<string>();
  for (const key of SECRET_ENV_KEYS) {
    const raw = env[key]?.trim();
    // 8 belgidan qisqa qiymat qidirilmaydi: qisqa satr ("dev", "test")
    // butun logni yolg'on-musbat redaksiyaga ko'mardi.
    if (raw && raw.length >= 8) values.add(raw);
  }
  cachedSecretValues = [...values].sort((a, b) => b.length - a.length);
  return cachedSecretValues;
}

/**
 * Matndan sirlarni olib tashlaydi (xato xabari, stack, log matni).
 *
 * Tartib MUHIM: avval env'dagi HAQIQIY qiymatlar (ular naqshga tushmasligi
 * mumkin — masalan `ENCRYPTION_KEY` oddiy hex satr), keyin shakl-naqshlari.
 */
export function scrubText(input: string, env: NodeJS.ProcessEnv = process.env): string {
  if (!input) return input;
  let out = input;

  for (const value of secretValues(env)) {
    if (out.includes(value)) {
      out = out.split(value).join(REDACTED);
    }
  }

  for (const { re } of SECRET_PATTERNS) {
    // `re` global — `lastIndex` holatini tashib yurmasligi uchun har
    // chaqiruvda yangi RegExp yaratilmaydi, `replace` o'zi nolga qaytaradi.
    out = out.replace(re, REDACTED);
  }

  return out;
}

/** Kalit nomi sir-nomimi? (registrga bog'liq emas, qisman moslik) */
export function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (KEY_ALLOWLIST.some((allowed) => normalized === allowed)) return false;
  return SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part.replace(/[^a-z0-9_]/g, '')));
}

/** Sarlavha nomi sir-sarlavhami? */
export function isSensitiveHeader(name: string): boolean {
  return SENSITIVE_HEADERS.includes(name.toLowerCase());
}

/**
 * HTTP sarlavhalarini tozalaydi — sir sarlavhalar `[REDACTED]` ga
 * aylanadi (O'CHIRILMAYDI: "authorization bor edimi?" savoli
 * diagnostikada muhim, qiymat esa kerak emas).
 */
export function scrubHeaders(
  headers: Record<string, unknown> | undefined,
  env: NodeJS.ProcessEnv = process.env,
): Record<string, unknown> {
  if (!headers) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (isSensitiveHeader(key)) {
      out[key] = REDACTED;
      continue;
    }
    out[key] = typeof value === 'string' ? scrubText(value, env) : value;
  }
  return out;
}

const MAX_DEPTH = 6;

/**
 * Obyekt daraxtini tozalaydi (nom + qiymat qatlamlari birga).
 *
 * Chuqurlik cheklangan: telemetriya payload'i cheksiz chuqur bo'lsa,
 * redaksiyaning O'ZI DoS vektoriga aylanardi. Chegaradan chuqur qism
 * `[Depth limit]` bilan almashtiriladi — jimgina TOZALANMAY o'tib
 * ketmaydi (bu farq xavfsizlik uchun hal qiluvchi).
 */
export function scrubValue(value: unknown, env: NodeJS.ProcessEnv = process.env, depth = 0): unknown {
  if (value == null) return value;
  if (depth > MAX_DEPTH) return '[Depth limit]';

  if (typeof value === 'string') return scrubText(value, env);
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return value;

  if (value instanceof Error) {
    return {
      name: value.name,
      message: scrubText(value.message, env),
      stack: value.stack ? scrubText(value.stack, env) : undefined,
    };
  }

  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => scrubValue(item, env, depth + 1));
  }

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = isSensitiveKey(key) ? REDACTED : scrubValue(item, env, depth + 1);
    }
    return out;
  }

  // function / symbol — telemetriyada o'rni yo'q.
  return undefined;
}
