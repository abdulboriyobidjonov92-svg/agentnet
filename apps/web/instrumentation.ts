import * as Sentry from "@sentry/nextjs";

/**
 * Phase 5 (P5.1) — Next.js instrumentatsiya kirish nuqtasi.
 *
 * Next runtime bo'yicha AYRIM konfiguratsiyani yuklaydi (Node va Edge
 * turli bundle'lar). Import DINAMIK: aks holda Edge bundle'iga Node
 * konfiguratsiyasi ham tushib, build yiqilardi.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

/**
 * App Router server komponentlari/route handler'laridagi xatolar.
 *
 * Sentry sozlanmagan bo'lsa bu funksiya no-op (SDK init qilinmagan) —
 * ya'ni DSN'siz muhitda hech qanday xulq o'zgarmaydi.
 */
export const onRequestError = Sentry.captureRequestError;
