/**
 * SEC-13 — NestJS API javoblarining xavfsizlik sarlavhalari.
 *
 * ALOHIDA FAYLDA (main.ts ichida emas) — chunki siyosat testlanadigan
 * bo'lishi kerak: "prod'da HSTS bor", "CSP'da wildcard yo'q" kabi
 * da'volar `main.ts` bootstrap'ini ko'tarmasdan tekshiriladi.
 *
 * MAS'ULIYAT CHEGARASI: bu — FAQAT API (JSON) javoblari uchun. Brauzerga
 * beriladigan HTML siyosati butunlay boshqa joyda
 * (`apps/web/src/lib/security-headers.ts`). Ikkalasi bir javobga birga
 * tushmaydi, ya'ni ziddiyat yuzaga kelmaydi.
 */

/**
 * API uchun CSP.
 *
 * API HTML bermaydi va hech qanday resurs yuklamaydi — shuning uchun eng
 * qattiq siyosat: hech nima ruxsat etilmaydi. `nosniff` mavjud bo'lsa ham
 * bu qatlam kerak: javob brauzerda hujjat sifatida ochilib qolgan holatda
 * (xato sahifasi, noto'g'ri Content-Type, URL'ni to'g'ridan-to'g'ri
 * ochish) u yerda skript ishga tushishini va forma yuborilishini to'sadi.
 */
export const API_CSP =
  "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

/** Prod'da HSTS — web ilova bilan AYNAN bir xil qiymat. */
export const API_HSTS = 'max-age=15552000; includeSubDomains';

/**
 * Swagger UI (`/api/docs`) — FAQAT dev'da mavjud (main.ts). U o'z
 * skript/stilini yuklaydi, ya'ni `default-src 'none'` uni bo'sh sahifaga
 * aylantirardi. Shuning uchun CSP shu yo'lga QO'YILMAYDI; qolgan
 * sarlavhalar (nosniff, DENY, ...) o'z joyida qoladi.
 */
export function isSwaggerPath(path: string): boolean {
  const clean = path.split('?')[0].replace(/\/+$/, '');
  return clean === '/api/docs' || clean.startsWith('/api/docs/');
}

/**
 * Bitta javob uchun sarlavhalar to'plami.
 *
 * `path` — `req.originalUrl` (global prefiks bilan). Swagger yo'lida CSP
 * tushib qoladi (yuqoridagi izoh).
 */
export function apiSecurityHeaders(params: {
  isProd: boolean;
  path: string;
}): Record<string, string> {
  const headers: Record<string, string> = {
    // MIME-sniffing — JSON'ni skript sifatida talqin qilishni to'sadi.
    'X-Content-Type-Options': 'nosniff',
    // Clickjacking (CSP `frame-ancestors 'none'` bilan bir xil ma'no).
    'X-Frame-Options': 'DENY',
    // API uchun eng qattiq variant: referrer umuman yuborilmaydi.
    // (Web ilova `strict-origin-when-cross-origin` ishlatadi — u yerda
    // navigatsiya va analitika konteksti bor, bu yerda yo'q.)
    'Referrer-Policy': 'no-referrer',
    'X-DNS-Prefetch-Control': 'off',
  };

  if (!isSwaggerPath(params.path)) {
    headers['Content-Security-Policy'] = API_CSP;
  }

  if (params.isProd) {
    headers['Strict-Transport-Security'] = API_HSTS;
  }

  return headers;
}
