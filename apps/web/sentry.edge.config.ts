import * as Sentry from "@sentry/nextjs";
import {
  scrubSentryEvent,
  sentryEnabled,
  sentryEnvironment,
  serverSentryDsn,
} from "@/lib/observability/scrub";

/**
 * Phase 5 (P5.1) — Next.js EDGE runtime Sentry konfiguratsiyasi.
 *
 * NEGA ALOHIDA FAYL: `middleware.ts` (BFF proxy) Edge runtime'da
 * ishlaydi — u Node runtime'idan butunlay boshqa jarayon/bundle.
 * Server konfiguratsiyasi u yerga UMUMAN yetib bormaydi, ya'ni
 * BFF'dagi xatolar bu fayl bo'lmasa KO'RINMAY qolardi.
 *
 * Aynan shu joyda ehtiyot ENG YUQORI: middleware har so'rovga sessiya
 * tokenini `Authorization` sarlavhasi sifatida qo'shadi. `sendDefaultPii:
 * false` + `beforeSend` tozalash — ikkala qatlam ham majburiy.
 */
const dsn = serverSentryDsn();

if (sentryEnabled(dsn)) {
  Sentry.init({
    dsn,
    environment: sentryEnvironment(),
    release: process.env.SENTRY_RELEASE?.trim() || undefined,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0) || 0,
    sendDefaultPii: false,
    maxBreadcrumbs: 20,
    beforeSend: (event) => scrubSentryEvent(event),
    initialScope: { tags: { service: "agentnet-web-edge" } },
  });
}
