/**
 * Phase 5 (P5.4) — ALERT SHARTNOMASI.
 *
 * To'rtta signal. Har biri REAL, BUGUN O'LCHANADIGAN ma'lumotdan
 * oziqlanadi (Contract talabi: "soxta metrika o'ylab topilmaydi"):
 *
 * | Kalit                     | Manba (haqiqiy)                                    |
 * |---------------------------|----------------------------------------------------|
 * | payment_failure_anomaly   | `PaymeTransaction.state` / `ClickTransaction.state` |
 * | agent_execution_failure   | `AutomationRun.status`                              |
 * | infrastructure_degraded   | `HealthService` (Postgres) + 5xx hisoblagichi        |
 * | auth_anomaly              | 401/403 hisoblagichi + `AuditLog` rad etishlari      |
 *
 * Har alert MAJBURIY tarzda quyidagilarni e'lon qiladi (P5.4 talabi):
 * signal · chegara · oyna · jiddiylik · manzil · dedup · sovish · runbook.
 */

export type AlertSeverity = 'critical' | 'high' | 'warning';

export type AlertKey =
  | 'payment_failure_anomaly'
  | 'agent_execution_failure'
  | 'infrastructure_degraded'
  | 'auth_anomaly'
  | 'free_tier_budget';

export interface AlertDefinition {
  key: AlertKey;
  /** O'lchanadigan signalning bir gapli ta'rifi (hujjat va test uchun). */
  signal: string;
  /** Baholash oynasi (daqiqa). */
  windowMinutes: number;
  /** Bir xil kalit uchun qayta signal berilmaydigan muddat (daqiqa). */
  cooldownMinutes: number;
  severity: AlertSeverity;
  /** `docs/runbooks/incident-response.md` ichidagi anchor. */
  runbook: string;
}

/**
 * Chegaralar env orqali sozlanadi — ular BIZNES qarori (qancha xato
 * "anomaliya"), muhandislik konstantasi emas. Default qiymatlar
 * bugungi hajmga (kunlik yuzlab so'rov) mos: ular "shovqin emas, lekin
 * kech ham emas" nuqtasida.
 */
export const ALERT_DEFINITIONS: Record<AlertKey, AlertDefinition> = {
  payment_failure_anomaly: {
    key: 'payment_failure_anomaly',
    signal:
      "Oynada bekor qilingan Payme/Click tranzaksiyalari (state < 0) soni va ulushi — pul yo'li uzilganini bildiradi",
    windowMinutes: 15,
    cooldownMinutes: 60,
    severity: 'critical',
    runbook: 'docs/runbooks/incident-response.md#5-tolov-xatoligi',
  },
  agent_execution_failure: {
    key: 'agent_execution_failure',
    signal: "Oynada `failed` holatidagi AutomationRun soni va ulushi — agent ijrosi buzilgan",
    windowMinutes: 15,
    cooldownMinutes: 60,
    severity: 'high',
    runbook: 'docs/runbooks/incident-response.md#9-abnormal-agent-ijrosi',
  },
  infrastructure_degraded: {
    key: 'infrastructure_degraded',
    signal:
      'Postgres tekshiruvi ketma-ket ikki marta muvaffaqiyatsiz YOKI oynada 5xx javoblar chegaradan oshdi',
    windowMinutes: 5,
    cooldownMinutes: 30,
    severity: 'critical',
    runbook: 'docs/runbooks/incident-response.md#2-database-uzilishi',
  },
  auth_anomaly: {
    key: 'auth_anomaly',
    signal:
      "Oynada 401/403 javoblar soni chegaradan oshdi YOKI rad etilgan impersonation urinishlari bor (AuditLog)",
    windowMinutes: 15,
    cooldownMinutes: 60,
    severity: 'high',
    runbook: 'docs/runbooks/incident-response.md#6-autentifikatsiya-xavfsizlik-hodisasi',
  },
  free_tier_budget: {
    key: 'free_tier_budget',
    signal:
      "Bugungi OpenRouter bepul-model budjeti ogohlantirish chegarasidan (default 80%) o'tdi — free tarif to'xtashiga yaqin",
    // Budjet KUNLIK, shuning uchun oyna ham kunlik: 5 daqiqalik oyna
    // "bugun qancha ishlatildi" savoliga javob bermaydi.
    windowMinutes: 1440,
    // Kuniga ko'pi bilan bitta signal — 80% dan 100% gacha har 5 daqiqada
    // qayta-qayta yozish shovqin bo'lardi.
    cooldownMinutes: 720,
    severity: 'warning',
    runbook: 'docs/runbooks/incident-response.md#14-free-tarif-budjeti',
  },
};

/**
 * Yuboriladigan signal.
 *
 * `facts` — FAQAT sonlar va qisqa kodlar. Foydalanuvchi ID'si, email,
 * telefon, IP, to'lov ma'lumoti bu yerga TUSHMAYDI: alert kanali
 * (Telegram guruhi) audit qatlamidan ancha kengroq ko'riladi.
 */
export interface AlertEvent {
  definition: AlertDefinition;
  /** Qisqa, odam o'qiydigan sarlavha (sirsiz). */
  title: string;
  /** Faqat raqamli/kodli faktlar. */
  facts: Record<string, string | number>;
  /** Dedup kaliti — bir xil bo'lsa sovish (cooldown) ichida takrorlanmaydi. */
  dedupeKey: string;
}
