import { ALERT_DEFINITIONS, type AlertEvent } from './alert.types';

/**
 * Phase 5 (P5.4) — QOIDA BAHOLASH (sof funksiyalar).
 *
 * NEGA ALOHIDA FAYL: baholash mantiqi DB'siz, cron'siz, Nest'siz
 * testlanadi. Ya'ni "chegara qachon ishlaydi" savoli 6 ta unit test
 * bilan qulflanadi va integratsiya qatlami faqat MA'LUMOT YIG'ADI.
 */

export interface Thresholds {
  paymentMinFailures: number;
  paymentFailureRatio: number;
  agentMinFailures: number;
  agentFailureRatio: number;
  serverErrorMin: number;
  authFailureMin: number;
  dbConsecutiveFailures: number;
}

function num(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const value = Number(env[key]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function resolveThresholds(env: NodeJS.ProcessEnv = process.env): Thresholds {
  return {
    // "Kamida N ta" VA "ulush R dan katta" — ikkalasi birga.
    // Faqat ulush bo'lsa: 1 dan 1 xato = 100% → har tungi yolg'on signal.
    // Faqat son bo'lsa: kunduzi 6 ta xato 600 tadan — normal shovqin.
    paymentMinFailures: num(env, 'ALERT_PAYMENT_MIN_FAILURES', 5),
    paymentFailureRatio: num(env, 'ALERT_PAYMENT_FAILURE_RATIO', 0.5),
    agentMinFailures: num(env, 'ALERT_AGENT_MIN_FAILURES', 5),
    agentFailureRatio: num(env, 'ALERT_AGENT_FAILURE_RATIO', 0.5),
    serverErrorMin: num(env, 'ALERT_SERVER_ERROR_MIN', 20),
    authFailureMin: num(env, 'ALERT_AUTH_FAILURE_MIN', 100),
    dbConsecutiveFailures: num(env, 'ALERT_DB_CONSECUTIVE_FAILURES', 2),
  };
}

export interface PaymentWindow {
  failed: number;
  total: number;
}

export function evaluatePaymentFailure(
  window: PaymentWindow,
  thresholds: Thresholds,
  bucket: string,
): AlertEvent | null {
  if (window.failed < thresholds.paymentMinFailures) return null;
  const ratio = window.total > 0 ? window.failed / window.total : 1;
  if (ratio < thresholds.paymentFailureRatio) return null;
  return {
    definition: ALERT_DEFINITIONS.payment_failure_anomaly,
    title: "To'lov xatoliklari anomaliyasi",
    facts: {
      failed: window.failed,
      total: window.total,
      ratio: ratio.toFixed(2),
      threshold_min: thresholds.paymentMinFailures,
      threshold_ratio: thresholds.paymentFailureRatio,
    },
    dedupeKey: `payment_failure_anomaly:${bucket}`,
  };
}

export interface AgentRunWindow {
  failed: number;
  total: number;
}

export function evaluateAgentFailure(
  window: AgentRunWindow,
  thresholds: Thresholds,
  bucket: string,
): AlertEvent | null {
  if (window.failed < thresholds.agentMinFailures) return null;
  const ratio = window.total > 0 ? window.failed / window.total : 1;
  if (ratio < thresholds.agentFailureRatio) return null;
  return {
    definition: ALERT_DEFINITIONS.agent_execution_failure,
    title: 'Agent ijrosi xatoliklari anomaliyasi',
    facts: {
      failed: window.failed,
      total: window.total,
      ratio: ratio.toFixed(2),
      threshold_min: thresholds.agentMinFailures,
      threshold_ratio: thresholds.agentFailureRatio,
    },
    dedupeKey: `agent_execution_failure:${bucket}`,
  };
}

export interface InfraWindow {
  /** Ketma-ket muvaffaqiyatsiz DB tekshiruvlari soni. */
  consecutiveDbFailures: number;
  /** Oynadagi 5xx javoblar soni. */
  serverErrors: number;
  /** Oxirgi DB tekshiruvining mashina-kodi (`db_timeout` / `db_unreachable`). */
  dbCode?: string;
}

export function evaluateInfrastructure(
  window: InfraWindow,
  thresholds: Thresholds,
  bucket: string,
): AlertEvent | null {
  const dbDown = window.consecutiveDbFailures >= thresholds.dbConsecutiveFailures;
  const errorSpike = window.serverErrors >= thresholds.serverErrorMin;
  if (!dbDown && !errorSpike) return null;
  return {
    definition: ALERT_DEFINITIONS.infrastructure_degraded,
    title: dbDown ? 'Postgres javob bermayapti' : "5xx javoblar keskin ko'tarildi",
    facts: {
      db_consecutive_failures: window.consecutiveDbFailures,
      db_code: window.dbCode ?? 'ok',
      server_errors: window.serverErrors,
      threshold_db: thresholds.dbConsecutiveFailures,
      threshold_5xx: thresholds.serverErrorMin,
    },
    // Dedup DB va 5xx uchun AJRATILGAN: DB uzilishi davomida 5xx
    // signali bostirilib qolmasin (ular boshqa hodisa bo'lishi mumkin).
    dedupeKey: `infrastructure_degraded:${dbDown ? 'db' : 'http5xx'}:${bucket}`,
  };
}

export interface AuthWindow {
  /** 401 + 403 javoblar soni (jarayon-ichi hisob). */
  authFailures: number;
  /** `impersonation.start.denied` audit yozuvlari soni. */
  deniedPrivilegedAttempts: number;
}

export function evaluateAuthAnomaly(
  window: AuthWindow,
  thresholds: Thresholds,
  bucket: string,
): AlertEvent | null {
  const spike = window.authFailures >= thresholds.authFailureMin;
  // Rad etilgan IMTIYOZLI urinish — bitta bo'lsa ham signal. Bu odatiy
  // "parolni unutdim" shovqini emas: kimdir admin yo'liga urinmoqda.
  const privileged = window.deniedPrivilegedAttempts > 0;
  if (!spike && !privileged) return null;
  return {
    definition: ALERT_DEFINITIONS.auth_anomaly,
    title: privileged
      ? 'Rad etilgan imtiyozli (impersonation) urinish'
      : 'Autentifikatsiya rad etishlari keskin ko‘tarildi',
    facts: {
      auth_failures: window.authFailures,
      denied_privileged: window.deniedPrivilegedAttempts,
      threshold_auth: thresholds.authFailureMin,
    },
    dedupeKey: `auth_anomaly:${privileged ? 'privileged' : 'volume'}:${bucket}`,
  };
}

export interface FreeBudgetWindow {
  /** Bugun ishlatilgan OpenRouter bepul-so'rovlar soni. */
  used: number;
  /** Buferli kunlik chegara. */
  cap: number;
  /** Ogohlantirish chegarasi (default cap'ning 80%). */
  alertAt: number;
}

/**
 * FREE TARIF BUDJETI — chegaraga YETGUNCHA ogohlantiradi.
 *
 * Spetsifikatsiya talabi (2.3): chegara yaqinlashsa yangi ro'yxatdan
 * o'tishlar TO'XTATILMAYDI — faqat signal beriladi. Sabab: registratsiyani
 * yopish o'sish voronkasini o'ldiradi, holbuki budjet tugashi vaqtinchalik
 * va o'zi-o'zidan (ertaga) tiklanadigan holat. Qaror operatorniki: kredit
 * sotib olib chegarani 1000/kunga ko'tarish yoki kutish.
 */
export function evaluateFreeTierBudget(
  window: FreeBudgetWindow,
  bucket: string,
): AlertEvent | null {
  if (window.used < window.alertAt) return null;
  const exhausted = window.used >= window.cap;
  return {
    definition: ALERT_DEFINITIONS.free_tier_budget,
    title: exhausted
      ? 'Free tarif budjeti TUGADI — bepul so’rovlar to‘xtadi'
      : 'Free tarif budjeti tugashiga yaqin',
    facts: {
      used: window.used,
      cap: window.cap,
      threshold: window.alertAt,
      percent: window.cap > 0 ? Math.round((window.used / window.cap) * 100) : 0,
    },
    // Dedup "yaqin" va "tugadi" uchun AJRATILGAN: 80% signali tugash
    // signalini bostirib qo'ymasin (ular boshqa qaror talab qiladi).
    dedupeKey: `free_tier_budget:${exhausted ? 'exhausted' : 'near'}:${bucket}`,
  };
}

/**
 * Dedup "chelagi" — oyna identifikatori.
 *
 * NEGA KERAK: `dedupeKey` faqat alert nomidan iborat bo'lsa, sovish
 * muddati o'tgach BIR XIL kalit qaytadi va bu to'g'ri. Lekin chelaksiz
 * kalit hodisalar ORASIDAGI farqni ko'rsatmaydi. Chelak = cooldown
 * uzunligidagi vaqt oynasi: shu bilan bitta hodisa bitta signal beradi,
 * yangi hodisa esa yangi kalit oladi.
 */
export function timeBucket(now: number, cooldownMinutes: number): string {
  const size = Math.max(1, cooldownMinutes) * 60_000;
  return String(Math.floor(now / size));
}
