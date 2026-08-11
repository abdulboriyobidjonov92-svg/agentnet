/**
 * SEC-13 — brauzer xavfsizlik chegarasi (CSP + qolgan sarlavhalar).
 *
 * YAGONA MANBA: bu fayl AGENTNET brauzer siyosatining butun matnini
 * saqlaydi. `middleware.ts` uni har so'rovda (nonce bilan) qo'llaydi,
 * `next.config.ts` esa nonce TALAB QILMAYDIGAN statik sarlavhalarni
 * barcha yo'llarga (jumladan `_next/static`) qo'yadi.
 *
 * MAS'ULIYAT CHEGARASI (takrorlanmasin):
 *   • CSP — FAQAT middleware (nonce har javobda yangi bo'lishi shart);
 *   • qolgan sarlavhalar — FAQAT `next.config.ts`;
 *   • NestJS API o'z javoblariga o'z (ancha qattiqroq) to'plamini qo'yadi
 *     (`apps/api/src/main.ts`) — u HTML bermaydi.
 * Bitta sarlavha ikki joyda o'rnatilmaydi.
 */

/** `script-src` uchun nonce — har JAVOB uchun yangi, taxmin qilib bo'lmaydi. */
export function generateNonce(): string {
  // Edge runtime'da `crypto` global (Node `crypto` moduli emas).
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // base64 — CSP `'nonce-...'` grammatikasi shuni kutadi.
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Brauzer HAQIQATAN murojaat qiladigan tashqi origin bormi?
 *
 * Bazaviy javob — YO'Q: barcha API chaqiruvlari same-origin BFF orqali
 * o'tadi (`/api/backend/*` proxy va `/api/*` route handler'lari). Shu
 * sabab `connect-src 'self'` — Engineering Contract SEC-13 AC ayni shuni
 * talab qiladi va bu A4/Konstitutsiya #2 ("brauzer NestJS'ga
 * to'g'ridan-to'g'ri bormaydi") bilan bir xil gap.
 *
 * PHASE 5 (P5.1) — YAGONA istisno: brauzer Sentry'si YOQILGAN bo'lsa,
 * u hodisani Sentry ingest origin'iga `fetch` bilan yuboradi va CSP
 * usiz uni BLOKLARDI (xato hisoboti jimgina yo'qolardi).
 *
 * FAIL-CLOSED: origin FAQAT `NEXT_PUBLIC_SENTRY_DSN` sozlanganda va
 * DSN yaroqli URL bo'lganda qo'shiladi. DSN yo'q — siyosat AVVALGIDEK
 * qat'iy (`'self'` yolg'iz). Direktivaga qo'lda satr yopishtirilmaydi:
 * origin DSN'ning O'ZIDAN olinadi, ya'ni noto'g'ri manzil kiritib
 * bo'lmaydi.
 */
export function browserApiOrigins(): string[] {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  if (!dsn) return [];
  try {
    return [new URL(dsn).origin];
  } catch {
    return [];
  }
}

export interface CspOptions {
  nonce: string;
  isProd: boolean;
}

/**
 * CSP direktivalari — obyekt sifatida (satr emas), chunki testlar va
 * tekshiruvlar direktivani NOM bo'yicha o'qishi kerak, katta satrni
 * taqqoslash emas.
 */
export function cspDirectives({ nonce, isProd }: CspOptions): Record<string, string[]> {
  const directives: Record<string, string[]> = {
    // Qolgan hamma narsa uchun zaxira — o'z origin.
    'default-src': ["'self'"],

    // XSS'ga qarshi ASOSIY qatlam.
    //
    // `'nonce-...'` — Next.js App Router SSR/hydration uchun inline
    // `<script>` chiqaradi (RSC oqimi `self.__next_f.push(...)`). Ularni
    // hash bilan qamrab bo'lmaydi (har javobda o'zgaradi), `'unsafe-inline'`
    // esa CSP'ning ma'nosini yo'qotardi. Next imzolangan nonce'ni
    // SO'ROV sarlavhasidan o'qib, o'z teglariga o'zi qo'yadi.
    //
    // `'strict-dynamic'` — nonce'li bootstrap yuklagan chunk'lar ishonchni
    // meros qiladi. Uni qo'llab-quvvatlaydigan brauzer `'self'` ni
    // E'TIBORSIZ qoldiradi; `'self'` eski brauzerlar uchun zaxira sifatida
    // qoladi (ikkisi ziddiyat emas — spetsifikatsiya shunday ishlaydi).
    'script-src': ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"],

    // `'unsafe-inline'` — ATAYLAB va HUJJATLASHTIRILGAN istisno.
    // Sabab: kod-bazada 56 ta `style={{...}}` (React ularni SSR'da
    // `style="..."` ATRIBUTI sifatida chiqaradi) va `next/font` head'ga
    // inline `<style>` qo'yadi. Nonce bu yerda yordam bermaydi: atribut
    // nonce ololmaydi.
    // Kelajakdagi tozalash yo'li — `style-src-attr`ga bo'lish; hozir
    // QILINMADI, chunki Firefox `style-src-attr`ni qo'llab-quvvatlamaydi
    // va `style-src`ga qaytadi — ya'ni Firefox'da butun UI buzilardi.
    'style-src': ["'self'", "'unsafe-inline'"],

    // `data:` — brauzer-agent skrinshotlari SSE orqali
    // `data:image/jpeg;base64,...` sifatida keladi
    // (`apps/api/src/automation/browser-bridge.ts`). Tashqi rasm hosti YO'Q.
    'img-src': ["'self'", 'data:'],

    // Shriftlar `next/font` bilan O'Z-O'ZIDAN hosting qilinadi (Geist) —
    // hech qanday CDN kerak emas.
    'font-src': ["'self'"],

    // Brauzer faqat o'z origin'iga murojaat qiladi (BFF). Yuqoridagi
    // `browserApiOrigins()` izohiga qarang.
    'connect-src': ["'self'", ...browserApiOrigins()],

    // Ilova hech qayerda `<iframe>` ishlatmaydi va hech qayerga
    // joylashtirilmaydi (clickjacking himoyasi).
    'frame-src': ["'none'"],
    'frame-ancestors': ["'none'"],

    // Plagin kontenti umuman yo'q.
    'object-src': ["'none'"],

    // `<base href>` in'ektsiyasi orqali nisbiy URL'larni o'g'irlashni to'sadi.
    'base-uri': ["'self'"],

    // Formalar faqat o'z origin'iga yuboriladi. To'lov oqimi forma
    // yubormaydi — u `window.open` bilan yangi varaqda ochiladi (navigatsiya,
    // `form-action` ostida emas).
    'form-action': ["'self'"],
  };

  if (isProd) {
    // Faqat prod: dev HTTP'da bu har so'rovni HTTPS'ga majburlab,
    // lokal ishlab chiqishni buzardi.
    directives['upgrade-insecure-requests'] = [];
  } else {
    // Next.js dev serveri HMR uchun `eval` ishlatadi (webpack
    // `eval-source-map`). BU FAQAT DEV — prod policy'da `'unsafe-eval'`
    // YO'Q va u yerga tushmasligi testda qulflangan.
    directives['script-src'] = [...directives['script-src'], "'unsafe-eval'"];
  }

  return directives;
}

/** Direktivalar obyektini CSP sarlavha qiymatiga aylantiradi. */
export function serializeCsp(directives: Record<string, string[]>): string {
  return Object.entries(directives)
    .map(([name, values]) => (values.length ? `${name} ${values.join(' ')}` : name))
    .join('; ');
}

/**
 * Nonce TALAB QILMAYDIGAN sarlavhalar — `next.config.ts` orqali BARCHA
 * yo'llarga (jumladan `_next/static` chunk'lari va shriftlarga) qo'yiladi.
 * Middleware ularni TAKRORLAMAYDI.
 */
export function staticSecurityHeaders(isProd: boolean): { key: string; value: string }[] {
  const headers = [
    // MIME-sniffing — JSON/matnni skript sifatida talqin qilishni to'sadi.
    { key: 'X-Content-Type-Options', value: 'nosniff' },

    // Clickjacking: CSP `frame-ancestors 'none'` bilan BIR XIL ma'no
    // (ziddiyat yo'q) — bu eski brauzerlar uchun zaxira qatlam.
    { key: 'X-Frame-Options', value: 'DENY' },

    // SaaS uchun maqbul: o'z origin'ida to'liq yo'l, tashqariga faqat
    // origin, HTTPS->HTTP da umuman yubormaydi.
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },

    // FAQAT haqiqatan ishlatiladigan imkoniyat ochiq qoladi:
    // `clipboard-write` — `navigator.clipboard.writeText` (havola nusxalash).
    //
    // Kamera RTSP orqali SERVER tomonda ulanadi (`/retail/camera/connect`),
    // brauzer `getUserMedia` ishlatilmaydi — shuning uchun `camera=()`.
    // Kelajakdagi ovoz/multimodal reja BUGUNGI siyosatni bo'shashtirmaydi.
    //
    // `web-share` ATAYLAB RO'YXATDA YO'Q: `navigator.share` ishlatiladi
    // (`share-button.tsx`), lekin Chrome bu nomni Permissions-Policy
    // xususiyati sifatida tanimaydi va har sahifada
    // "Unrecognized feature: 'web-share'" ogohlantirishini beradi.
    // Ro'yxatdan chiqarilganda amaldagi siyosat O'ZGARMAYDI — sanab
    // o'tilmagan xususiyat uchun default allowlist allaqachon `self`.
    // Ya'ni: bir xil himoya, konsolda shovqin yo'q.
    {
      key: 'Permissions-Policy',
      value: [
        'accelerometer=()',
        'autoplay=()',
        'camera=()',
        'clipboard-write=(self)',
        'display-capture=()',
        'geolocation=()',
        'gyroscope=()',
        'magnetometer=()',
        'microphone=()',
        'payment=()',
        'usb=()',
      ].join(', '),
    },

    // Popup'lar (Payme/Click to'lov varaqlari, t.me ulashish) `opener`
    // aloqasini ISHLATMAYDI — kod-bazada `window.opener` yo'q. Shuning
    // uchun `same-origin` xavfsiz va tabnabbing'ni to'sadi.
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },

    // X-Powered-By Next tomonidan `poweredByHeader: false` bilan olinadi.
    { key: 'X-DNS-Prefetch-Control', value: 'off' },
  ];

  if (isProd) {
    // 180 kun + subdomenlar (API bilan AYNAN bir xil qiymat —
    // `apps/api/src/main.ts`). `preload` ATAYLAB YO'Q: preload ro'yxatiga
    // kirish tashkilot darajasidagi qaytarib bo'lmaydigan majburiyat
    // (barcha subdomenlar abadiy HTTPS) — uni kod emas, egasi qabul qiladi.
    headers.push({
      key: 'Strict-Transport-Security',
      value: 'max-age=15552000; includeSubDomains',
    });
  }

  return headers;
}
