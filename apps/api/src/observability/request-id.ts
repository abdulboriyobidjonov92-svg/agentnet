import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

/**
 * Phase 5 (P5.3) — SO'ROV IDENTIFIKATORI: yagona shartnoma.
 *
 * OQIM: Brauzer → Next BFF → NestJS API → Agent Engine.
 * Har uchala servis AYNAN shu sarlavhani (`x-request-id`) va AYNAN shu
 * formatni ishlatadi; ID zanjir bo'ylab O'ZGARMAYDI — bitta foydalanuvchi
 * harakati uch servis logida bitta qiymat bilan qidiriladi.
 *
 * ILGARI NIMA BOR EDI (audit): `main.ts` da 3 qatorlik blok bor edi —
 * `req.headers['x-request-id'] || randomUUID()`. U ISHLARDI, lekin:
 *   • kiruvchi qiymatni HECH TEKSHIRMAS edi (uzunlik, alifbo) — mijoz
 *     100 KB'lik yoki `\n` bilan to'la sarlavha yuborib, log satrini
 *     bo'lib tashlashi (log-injection) mumkin edi;
 *   • BFF va engine'da umuman yo'q edi — zanjir uzilardi.
 * Shuning uchun bu modul o'sha blokni ALMASHTIRADI (takrorlamaydi).
 *
 * ISHONCH SIYOSATI (ataylab sodda va hujjatlashtirilgan):
 * request-id — AVTORIZATSIYA VOSITASI EMAS, u korrelyatsiya yorlig'i.
 * Uni "soxtalashtirish" hech qanday imtiyoz bermaydi (hech bir qaror
 * unga tayanmaydi). Yagona real xavf — log/telemetriya IFLOSLANISHI, va
 * u to'liq QAT'IY FORMAT bilan yopiladi. Shu sababli:
 *   • kiruvchi qiymat FORMATGA mos bo'lsa — qabul qilinadi (propagatsiya);
 *   • mos bo'lmasa (uzun, bo'sh, taqiqlangan belgi) — JIMGINA YANGISI
 *     yaratiladi va yaroqsiz qiymat HECH QAYERGA yozilmaydi;
 *   • operator umuman ishonmasa — `TRUST_INCOMING_REQUEST_ID=0` bilan
 *     qabul qilish butunlay o'chadi (har so'rovga server ID beradi).
 */

/** Yagona sarlavha nomi — uchala servisda bir xil. */
export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Qat'iy format: URL-xavfsiz alifbo, 8..64 belgi.
 *
 * Nima BLOKLANADI: bo'shliq, `\r`/`\n` (log-injection), `<`/`>` (telemetriya
 * UI'da HTML), 64 dan uzun qiymat (log hajmi va indeks kardinalligi).
 * UUIDv4 (36 belgi, defis bilan) shu qolipga tushadi.
 */
export const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export const REQUEST_ID_MAX_LENGTH = 64;

export function isValidRequestId(value: unknown): value is string {
  return typeof value === 'string' && REQUEST_ID_PATTERN.test(value);
}

/** Yangi ID — UUIDv4 (36 belgi, formatga mos). */
export function generateRequestId(): string {
  return randomUUID();
}

/**
 * Kiruvchi sarlavhadan yakuniy request-id ni hal qiladi.
 *
 * `header` — xom sarlavha qiymati. Express bir xil sarlavha ikki marta
 * kelganda MASSIV beradi; bunday holat (mijoz aralashuvi belgisi)
 * ATAYLAB rad etiladi va yangi ID yaratiladi.
 */
export function resolveRequestId(
  header: string | string[] | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const trustIncoming = env.TRUST_INCOMING_REQUEST_ID !== '0';
  if (!trustIncoming) return generateRequestId();
  if (Array.isArray(header)) return generateRequestId();
  if (!isValidRequestId(header)) return generateRequestId();
  return header;
}

/**
 * So'rov konteksti — ALS (AsyncLocalStorage).
 *
 * NEGA ALS: `x-request-id` ni engine chaqiruvlariga qo'shish kerak, lekin
 * chaqiruv joyi (`OperationsService.callEngine`, `AgentsService`, ... 13+
 * nuqta) `Request` obyektini KO'RMAYDI. Har servisga `req` uzatish 13 ta
 * imzoni o'zgartirardi (biznes kodiga observability uchun tegish —
 * taqiqlangan). ALS bilan mavjud yagona axios interceptor kontekstni
 * o'zi oladi va HECH BIR biznes fayli o'zgarmaydi.
 */
export interface RequestContext {
  requestId: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function currentRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}

/** Faqat testlar uchun — ALS holatini bevosita o'qish. */
export function currentRequestContext(): RequestContext | undefined {
  return storage.getStore();
}
