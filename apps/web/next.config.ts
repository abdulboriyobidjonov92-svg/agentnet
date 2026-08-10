import type { NextConfig } from "next";
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

export default nextConfig;
