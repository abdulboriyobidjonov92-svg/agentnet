/**
 * Phase 5 (P5.3) — BFF tomonidagi request-id.
 *
 * `apps/api/src/observability/request-id.ts` bilan AYNI shartnoma:
 * bir xil sarlavha nomi, bir xil format, bir xil siyosat. Ikkalasi
 * ham `docs/status/phase5-observability-audit.md` da yagona jadval
 * sifatida yozilgan; format o'zgarsa IKKALASI ham o'zgaradi.
 *
 * NEGA NUSXA: middleware Edge runtime'da ishlaydi va u yerdan
 * `apps/api` moduli import qilib bo'lmaydi (boshqa paket, Node API'lari).
 */

export const REQUEST_ID_HEADER = "x-request-id";
export const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export function isValidRequestId(value: string | null | undefined): value is string {
  return typeof value === "string" && REQUEST_ID_PATTERN.test(value);
}

/** Edge runtime'da `crypto` global (Node moduli emas) — CSP nonce bilan bir xil naqsh. */
export function generateRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Kiruvchi (BRAUZER bergan) qiymatni siyosat bo'yicha hal qiladi.
 *
 * SUKUT BO'YICHA BRAUZERGA ISHONILMAYDI (`TRUST_CLIENT_REQUEST_ID=1`
 * bilan yoqiladi). Bu API'dagi siyosatdan QAT'IYROQ va ataylab shunday:
 * API uchun "yuqori oqim" — bizning O'Z BFF'imiz, BFF uchun esa yuqori
 * oqim — ANONIM BRAUZER. Ikkalasiga bir xil ishonish mantiqsiz bo'lardi.
 *
 * Yaroqsiz yoki ishonilmagan qiymat HECH QAYERGA (log, sarlavha, javob)
 * o'tmaydi — u shu funksiyada o'ladi.
 */
export function resolveIncomingRequestId(
  incoming: string | null | undefined,
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): string {
  if (env.TRUST_CLIENT_REQUEST_ID !== "1") return generateRequestId();
  return isValidRequestId(incoming) ? incoming : generateRequestId();
}
