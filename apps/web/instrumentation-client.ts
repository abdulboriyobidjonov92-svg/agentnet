import * as Sentry from "@sentry/nextjs";
import {
  clientSentryDsn,
  scrubSentryEvent,
  sentryEnabled,
  sentryEnvironment,
} from "@/lib/observability/scrub";

/**
 * Phase 5 (P5.1) — BRAUZER tomonidagi Sentry.
 *
 * "WHERE APPROPRIATE" (P5.1 talabi) NIMANI ANGLATADI BU YERDA:
 *   • klient DSN'i ALOHIDA env (`NEXT_PUBLIC_SENTRY_DSN`) — server
 *     DSN'i (`SENTRY_DSN`) brauzer bundle'iga HECH QACHON tushmaydi;
 *   • DSN sozlanmasa SDK umuman ishga tushmaydi — bu SUKUT BO'YICHA
 *     holat, ya'ni hech kim yoqmaguncha brauzerdan hech narsa ketmaydi;
 *   • `sendDefaultPii: false` — Sentry foydalanuvchi IP'sini yubormaydi;
 *   • `Replay`/`Session Replay` integratsiyasi ATAYLAB QO'SHILMAGAN:
 *     u sahifa DOM'ini yozib oladi, ya'ni chat matni, balans, telefon
 *     raqami va halal-filtr natijalari uchinchi tomonga chiqardi.
 *
 * CSP: `connect-src` ga Sentry ingest origin'i FAQAT DSN sozlanganda
 * qo'shiladi (`src/lib/security-headers.ts` -> `browserApiOrigins()`).
 */
const dsn = clientSentryDsn();

if (sentryEnabled(dsn)) {
  Sentry.init({
    dsn,
    environment: sentryEnvironment(),
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE?.trim() || undefined,
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0) || 0,
    sendDefaultPii: false,
    maxBreadcrumbs: 20,
    // Session Replay ATAYLAB YO'Q — yuqoridagi izohga qarang.
    integrations: [],
    beforeSend: (event) => scrubSentryEvent(event),
  });
}

/** App Router navigatsiya kuzatuvi (SDK sozlanmagan bo'lsa no-op). */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
