import * as Sentry from "@sentry/nextjs";
import {
  scrubSentryEvent,
  sentryEnabled,
  sentryEnvironment,
  serverSentryDsn,
} from "@/lib/observability/scrub";

/**
 * Phase 5 (P5.1) — Next.js SERVER runtime (Node) Sentry konfiguratsiyasi.
 *
 * DSN `SENTRY_DSN` env'idan olinadi — HECH QACHON kodda yozilmaydi
 * (Konstitutsiya #7 va SEC-14 gitleaks gate'i).
 *
 * DSN sozlanmagan bo'lsa `Sentry.init` UMUMAN chaqirilmaydi: SDK
 * "o'chirilgan" holatda qoladi va barcha `capture*` chaqiruvlari no-op
 * bo'ladi. Ya'ni Sentry'siz web ilova hech qanday xulq farqisiz ishlaydi.
 */
const dsn = serverSentryDsn();

if (sentryEnabled(dsn)) {
  Sentry.init({
    dsn,
    environment: sentryEnvironment(),
    release: process.env.SENTRY_RELEASE?.trim() || undefined,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0) || 0,
    /**
     * SDK IP, cookie va so'rov tanasini O'ZI qo'shmaydi. Bu — BFF uchun
     * hal qiluvchi: `middleware.ts` har so'rovga `Authorization: Bearer
     * <sessiya tokeni>` qo'yadi, ya'ni PII yoqilsa token telemetriyaga
     * to'g'ridan-to'g'ri tushardi.
     */
    sendDefaultPii: false,
    maxBreadcrumbs: 30,
    beforeSend: (event) => scrubSentryEvent(event),
    beforeBreadcrumb: (crumb) => {
      const [scrubbed] = scrubSentryEvent({ breadcrumbs: [crumb] }).breadcrumbs ?? [];
      return { ...crumb, ...scrubbed };
    },
    initialScope: { tags: { service: "agentnet-web" } },
  });
}
