import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import { staticSecurityHeaders } from "./src/lib/security-headers";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  transpilePackages: ["@agentnet/shared-types"],
  serverExternalPackages: [],

  // SEC-13: server texnologiyasini oshkor qilmaslik (API'dagi
  // `disable('x-powered-by')` bilan bir xil qaror).
  poweredByHeader: false,

  /**
   * SEC-13 — nonce TALAB QILMAYDIGAN xavfsizlik sarlavhalari.
   *
   * NEGA MIDDLEWARE EMAS: middleware `config.matcher` `_next/*` va statik
   * fayl kengaytmalarini CHIQARIB TASHLAYDI, ya'ni JS chunk'lari va
   * shriftlar u yerdan sarlavha OLMAYDI. `headers()` esa har bir yo'lga
   * qo'llanadi. CSP aksincha — faqat middleware'da (har javobda yangi
   * nonce kerak). Ya'ni har sarlavhaning YAGONA manbasi bor.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: staticSecurityHeaders(isProd),
      },
    ];
  },
};

/**
 * Phase 5 (P5.1) — SOURCE MAP SIYOSATI (prod uchun xavfsiz).
 *
 * MUAMMO: source map'lar Sentry'da stack-trace'ni o'qiladigan qiladi,
 * LEKIN ular ommaviy serverda qolsa, butun server/klient manba kodi
 * (biznes mantiq, halal filtr qoidalari, ichki yo'llar) yuklab olinadi.
 *
 * QAROR:
 *   • `sourcemaps.deleteSourcemapsAfterUpload: true` — map fayllari
 *     Sentry'ga yuklanadi va build chiqishidan O'CHIRILADI, ya'ni ular
 *     hech qachon ommaviy URL'da turmaydi;
 *   • yuklash FAQAT `SENTRY_AUTH_TOKEN` mavjud bo'lganda ishlaydi;
 *     token yo'q bo'lsa plagin butunlay O'CHIRILADI (`sourcemaps.disable`),
 *     aks holda `@sentry/cli` ni chaqirib build'ni yiqitardi.
 *     DIQQAT: bu repoda `@sentry/cli` postinstall skripti `allowScripts`
 *     ro'yxatiga ATAYLAB qo'shilmagan (ta'minot zanjiri qarori), shuning
 *     uchun token'siz muhitda CLI ikkilik fayli umuman yo'q — plaginni
 *     o'chirish shart, ixtiyoriy emas;
 *   • `widenClientFileUpload: false` — kerak bo'lmagan fayllar yuklanmaydi;
 *   • `disableLogger: true` — Sentry'ning debug loglari prod bundle'idan
 *     olib tashlanadi (bundle hajmi va shovqin).
 */
const sourceMapUploadEnabled = Boolean(process.env.SENTRY_AUTH_TOKEN?.trim());

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // CI/build loglarida ortiqcha shovqin bo'lmasin.
  silent: !process.env.CI,
  widenClientFileUpload: false,
  disableLogger: true,
  sourcemaps: {
    disable: !sourceMapUploadEnabled,
    deleteSourcemapsAfterUpload: true,
  },
  /**
   * Tunnel ATAYLAB YOQILMAGAN (`tunnelRoute`). U brauzer hodisalarini
   * o'z domenimiz orqali o'tkazadi (ad-blocker'ni chetlab o'tish uchun),
   * lekin bu bizning serverimizda AUTENTIFIKATSIYASIZ, tashqi manzilga
   * uzatuvchi ochiq proxy yaratadi — SSRF yuzasi. Ko'rinmagan bir necha
   * foiz xato hisobotidan ko'ra bu xavf qimmatroq.
   */
  automaticVercelMonitors: false,
});
