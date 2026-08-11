/**
 * Phase 5 (P5.4) — jarayon ichidagi HISOBLAGICHLAR.
 *
 * NIMA UCHUN BOR: ikkita alert (5xx ko'tarilishi va auth-anomaliyasi)
 * DB'da izi qolmaydigan hodisalarga tayanadi — 401/403/500 javoblar
 * hech qanday jadvalga yozilmaydi (va yozilishi ham kerak emas: har
 * rad etilgan so'rovni DB'ga yozish DoS vektori bo'lardi).
 *
 * NIMA QILMAYDI (halol chegara):
 *   • Bu SOF JARAYON-ICHI hisob. Bir nechta instansda har biri O'Z
 *     hisobini yuritadi va o'z chegarasini alohida tekshiradi. Ya'ni
 *     ko'p-instansli holatda chegara AMALDA instans soniga bo'linadi.
 *     Umumiy (taqsimlangan) hisob Redis talab qiladi — u Phase 6 ishi
 *     (ADR-006), shu sababli BU YERDA SOXTA "global" hisob YASAMAYMIZ.
 *     Alert hujjati (`docs/runbooks/incident-response.md`) bu cheklovni
 *     aniq yozadi.
 *   • Jarayon qayta ishga tushsa hisob nolga qaytadi — bu ataylab:
 *     eski oyna qayta ishga tushgan jarayonga taalluqli emas.
 *
 * NEGA "sun'iy metrika emas": bu hisoblagichlar HAQIQIY HTTP javob
 * kodlaridan (global xato-filtridan) oziqlanadi — ular allaqachon
 * mavjud, kuzatuv uchun yangi biznes-kod yozilmadi.
 */

export interface CounterSnapshot {
  /** 5xx javoblar soni (joriy oynada). */
  serverErrors: number;
  /** 401 + 403 javoblar soni (joriy oynada). */
  authFailures: number;
  /** Oyna boshlangan vaqt (ms). */
  windowStartedAt: number;
}

interface MutableCounters {
  serverErrors: number;
  authFailures: number;
  windowStartedAt: number;
}

const counters: MutableCounters = {
  serverErrors: 0,
  authFailures: 0,
  windowStartedAt: Date.now(),
};

/** Global xato-filtridan chaqiriladi. Hech qachon tashlamaydi. */
export function recordHttpFailure(statusCode: number): void {
  if (statusCode >= 500) {
    counters.serverErrors += 1;
    return;
  }
  if (statusCode === 401 || statusCode === 403) {
    counters.authFailures += 1;
  }
}

/** O'qish (oynani YOPMAYDI) — diagnostika/`/api/health` uchun. */
export function snapshotCounters(): CounterSnapshot {
  return {
    serverErrors: counters.serverErrors,
    authFailures: counters.authFailures,
    windowStartedAt: counters.windowStartedAt,
  };
}

/**
 * Oynani yopadi: joriy qiymatlarni qaytaradi va nolga tushiradi.
 *
 * "Oqib turuvchi" (rolling) oyna emas, TUMBLING oyna — alert baholovchi
 * har N daqiqada bir marta chaqiradi. Sodda va aniq: bir hodisa ikki
 * marta hisoblanmaydi (dublikat signal manbai shu bo'lardi).
 */
export function drainCounters(now: number = Date.now()): CounterSnapshot & { windowMs: number } {
  const snapshot: CounterSnapshot & { windowMs: number } = {
    serverErrors: counters.serverErrors,
    authFailures: counters.authFailures,
    windowStartedAt: counters.windowStartedAt,
    windowMs: Math.max(0, now - counters.windowStartedAt),
  };
  counters.serverErrors = 0;
  counters.authFailures = 0;
  counters.windowStartedAt = now;
  return snapshot;
}

/** Testlar uchun — holatni to'liq tiklaydi. */
export function resetCounters(now: number = Date.now()): void {
  counters.serverErrors = 0;
  counters.authFailures = 0;
  counters.windowStartedAt = now;
}
