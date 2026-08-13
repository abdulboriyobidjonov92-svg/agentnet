/**
 * `NEXT_PUBLIC_API_URL` ni YAGONA joyda hal qiladi.
 *
 * NEGA BU FAYL BOR (haqiqiy insident, 2026-08-12): butun login oqimi
 * prod'da "Application Error" berardi. Sabab kodda emas edi — olti
 * faylda bir xil naqsh takrorlanardi:
 *
 *     process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"
 *
 * Vercel'da bu o'zgaruvchi qo'yilmagan bo'lsa, `?? localhost` JIMGINA
 * ishga tushardi va middleware BARCHA `/api/backend/*` chaqiruvlarini
 * (OTP so'rash, OTP tasdiqlash, 2FA) mavjud bo'lmagan `localhost:3001`
 * ga rewrite qilardi. Natija — 500, brauzerda "Application Error".
 * Ya'ni noto'g'ri konfiguratsiya XATO sifatida KO'RINMASDI, u ishlayotgan
 * kod kabi ko'rinardi. Aynan shuni tuzatamiz.
 *
 * QOIDA: `localhost` fallback — FAQAT development uchun. Production'da
 * u yo'q bo'lsa yoki localhost'ga qarasa, bu KONFIGURATSIYA XATOSI va
 * u ANIQ aytilishi kerak.
 */
export interface ApiUrlResolution {
  url: string;
  /** Prod'da noto'g'ri sozlangan (yo'q yoki localhost). */
  misconfigured: boolean;
  reason?: string;
}

const DEV_FALLBACK = 'http://localhost:3001';

export function resolveApiUrl(env: NodeJS.ProcessEnv = process.env): ApiUrlResolution {
  const raw = env.NEXT_PUBLIC_API_URL?.trim();
  // `NODE_ENV` Next build'da 'production' bo'ladi (Vercel ham shunday).
  const isProd = env.NODE_ENV === 'production';

  if (!raw) {
    return isProd
      ? { url: DEV_FALLBACK, misconfigured: true, reason: 'NEXT_PUBLIC_API_URL_unset' }
      : { url: DEV_FALLBACK, misconfigured: false };
  }

  // Prod'da localhost'ga qarash — deyarli har doim "env qo'yishni unutdik"
  // belgisi. Buni ham xato deb hisoblaymiz, aks holda deploy jimgina
  // singan holda qolaveradi.
  if (isProd && /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(raw)) {
    return { url: raw, misconfigured: true, reason: 'NEXT_PUBLIC_API_URL_points_to_localhost' };
  }

  // SHAKL tekshiruvi (2026-08-13 insidenti): operator qiymatni `https://`
  // SIZ kiritgan edi (`agentnet-api-xxxx.onrender.com`). U yuqoridagi
  // tekshiruvlardan O'TIB KETARDI, keyin esa middleware'dagi
  // `new URL(...)` `ERR_INVALID_URL` tashlab, butun so'rovni **500** ga
  // aylantirardi — ya'ni yana "Application Error", yana sababsiz.
  // Endi bu ham ANIQ, tushunarli konfiguratsiya xatosi.
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { url: DEV_FALLBACK, misconfigured: true, reason: 'NEXT_PUBLIC_API_URL_invalid_url_missing_protocol' };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { url: DEV_FALLBACK, misconfigured: true, reason: 'NEXT_PUBLIC_API_URL_bad_protocol' };
  }

  // Oxiridagi `/` olib tashlanadi — aks holda yo'l `//api/...` bo'lib
  // qo'shaloq slash bilan ketardi (ba'zi proxy'lar buni 404 qiladi).
  return { url: raw.replace(/\/+$/, ''), misconfigured: false };
}

/**
 * DIQQAT — `NEXT_PUBLIC_*` build vaqtida INLINE qilinadi. Ya'ni Vercel'da
 * o'zgaruvchini qo'shish YETARLI EMAS: qayta deploy (rebuild) SHART,
 * aks holda eski build ichidagi eski qiymat qolaveradi.
 */
export const API_URL_BUILD_TIME_NOTE =
  'NEXT_PUBLIC_* build vaqtida inline qilinadi — o`zgartirgandan keyin QAYTA DEPLOY shart.';
