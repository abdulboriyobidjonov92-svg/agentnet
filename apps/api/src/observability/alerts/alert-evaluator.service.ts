import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { HealthService } from '../../health/health.service';
import { FreeTierBudgetService } from '../../usage/free-tier-budget.service';
import { AlertService } from './alert.service';
import { drainCounters } from './alert-counters';
import {
  evaluateAgentFailure,
  evaluateAuthAnomaly,
  evaluateFreeTierBudget,
  evaluateInfrastructure,
  evaluatePaymentFailure,
  resolveThresholds,
  timeBucket,
  type AgentRunWindow,
  type AuthWindow,
  type PaymentWindow,
} from './alert-rules';
import { ALERT_DEFINITIONS } from './alert.types';

/**
 * Phase 5 (P5.4) — BAHOLOVCHI (cron).
 *
 * HAR 5 DAQIQADA bir marta ishlaydi va TO'RTALA qoidani baholaydi.
 *
 * NEGA BITTA CRON: hisoblagichlar (401/403, 5xx) jarayon ichida yashaydi
 * va o'qilganda NOLLANADI (tumbling oyna). Ikkita cron ularni ikki marta
 * "drain" qilsa, ma'lumot yo'qolardi. Shuning uchun yagona nuqta:
 * bir marta drain → halqa-buferga qo'yish → 5 daq (infra) va 15 daq
 * (auth) oynalarini SHU buferdan hisoblash.
 *
 * MA'LUM CHEKLOV (halol yozilgan, yashirilmagan):
 *   • Cron LEADER-LOCK'siz (Contract A24 — Phase 6 ishi). Ko'p instansda
 *     har biri o'z hisobini baholaydi → bir hodisa uchun bir nechta
 *     signal kelishi mumkin. Bugun API bitta instansda (`render.yaml`
 *     `plan: free`), shuning uchun amalda bu yuz bermaydi.
 *   • DB'ga tayanadigan ikki qoida (to'lov, agent) BARCHA instanslarda
 *     bir xil natija beradi — ular uchun ko'p instans muammosi faqat
 *     takroriy signal, noto'g'ri signal emas.
 */
@Injectable()
export class AlertEvaluatorService {
  private readonly logger = new Logger(AlertEvaluatorService.name);
  /** Oxirgi 3 ta 5-daqiqalik oyna = 15 daqiqa (auth oynasi). */
  private readonly counterHistory: Array<{ serverErrors: number; authFailures: number }> = [];
  private consecutiveDbFailures = 0;
  private lastDbCode: string | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly health: HealthService,
    private readonly alerts: AlertService,
    private readonly freeBudget: FreeTierBudgetService,
  ) {}

  private get enabled(): boolean {
    // Testda va aniq o'chirilganda ishlamaydi (tarmoqqa chiqmaydi).
    if (process.env.NODE_ENV === 'test') return false;
    return process.env.ALERTS_ENABLED !== '0';
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async runScheduled(): Promise<void> {
    if (!this.enabled) return;
    try {
      await this.evaluateAll();
    } catch (e) {
      // Baholovchi hech qachon jarayonni yiqitmaydi.
      this.logger.error(`Alert baholash xatosi: ${(e as Error).message}`);
    }
  }

  /** Testlar va `/api/health` diagnostikasi uchun — ochiq metod. */
  async evaluateAll(now: number = Date.now()): Promise<number> {
    const thresholds = resolveThresholds();
    let sent = 0;

    // --- Hisoblagichlar (bir marta drain) ---
    const drained = drainCounters(now);
    this.counterHistory.push({ serverErrors: drained.serverErrors, authFailures: drained.authFailures });
    while (this.counterHistory.length > 3) this.counterHistory.shift();

    // --- Infratuzilma (DB + 5xx), 5 daqiqalik oyna ---
    const db = await this.health.checkDatabase();
    if (db.status === 'ok') {
      this.consecutiveDbFailures = 0;
      this.lastDbCode = undefined;
    } else {
      this.consecutiveDbFailures += 1;
      this.lastDbCode = db.code;
    }

    const infra = evaluateInfrastructure(
      {
        consecutiveDbFailures: this.consecutiveDbFailures,
        serverErrors: drained.serverErrors,
        dbCode: this.lastDbCode,
      },
      thresholds,
      timeBucket(now, ALERT_DEFINITIONS.infrastructure_degraded.cooldownMinutes),
    );
    if (infra && (await this.alerts.send(infra, now)).delivered) sent += 1;

    /**
     * DB yiqilgan bo'lsa, DB'ga tayanadigan qoidalarni BAHOLAMAYMIZ.
     * Aks holda ular ham xato berib, bitta hodisa uchun uchta turli
     * signal chiqarardi (operatorni chalg'itadi).
     */
    if (db.status !== 'ok') return sent;

    // --- Auth anomaliyasi, 15 daqiqalik oyna ---
    const authFailures = this.counterHistory.reduce((sum, w) => sum + w.authFailures, 0);
    const auth = evaluateAuthAnomaly(
      { authFailures, deniedPrivilegedAttempts: await this.countDeniedPrivileged(now) },
      thresholds,
      timeBucket(now, ALERT_DEFINITIONS.auth_anomaly.cooldownMinutes),
    );
    if (auth && (await this.alerts.send(auth, now)).delivered) sent += 1;

    // --- To'lov, 15 daqiqalik oyna ---
    const payment = evaluatePaymentFailure(
      await this.collectPaymentWindow(now),
      thresholds,
      timeBucket(now, ALERT_DEFINITIONS.payment_failure_anomaly.cooldownMinutes),
    );
    if (payment && (await this.alerts.send(payment, now)).delivered) sent += 1;

    // --- Agent ijrosi, 15 daqiqalik oyna ---
    const agent = evaluateAgentFailure(
      await this.collectAgentWindow(now),
      thresholds,
      timeBucket(now, ALERT_DEFINITIONS.agent_execution_failure.cooldownMinutes),
    );
    if (agent && (await this.alerts.send(agent, now)).delivered) sent += 1;

    // --- Free tarif budjeti (OpenRouter), KUNLIK oyna ---
    // Bu qoida DB/5xx hisoblagichlariga tayanmaydi — u joriy holatni
    // (bugun qancha ishlatilgan) o'qiydi, shuning uchun oyna yig'ish shart emas.
    const budget = evaluateFreeTierBudget(
      await this.freeBudget.snapshot(),
      timeBucket(now, ALERT_DEFINITIONS.free_tier_budget.cooldownMinutes),
    );
    if (budget && (await this.alerts.send(budget, now)).delivered) sent += 1;

    return sent;
  }

  private since(now: number, minutes: number): Date {
    return new Date(now - minutes * 60_000);
  }

  /**
   * To'lov oynasi — Payme va Click BIRGA.
   *
   * `state < 0` ikkala provayderda ham "bekor qilingan" degani
   * (`schema.prisma` izohlari: Payme -1/-2, Click -1/-2). Bu HAQIQIY
   * ustun, hisoblab chiqarilgan metrika emas.
   */
  private async collectPaymentWindow(now: number): Promise<PaymentWindow> {
    const gte = this.since(now, ALERT_DEFINITIONS.payment_failure_anomaly.windowMinutes);
    // @system-scope — platforma bo'ylab operatsion signal, bitta
    // foydalanuvchiga tegishli emas (cron, so'rov konteksti yo'q).
    const [paymeFailed, paymeTotal, clickFailed, clickTotal] = await Promise.all([
      this.prisma.paymeTransaction.count({ where: { createdAt: { gte }, state: { lt: 0 } } }),
      this.prisma.paymeTransaction.count({ where: { createdAt: { gte } } }),
      this.prisma.clickTransaction.count({ where: { createdAt: { gte }, state: { lt: 0 } } }),
      this.prisma.clickTransaction.count({ where: { createdAt: { gte } } }),
    ]);
    return { failed: paymeFailed + clickFailed, total: paymeTotal + clickTotal };
  }

  /** Agent ijrosi — `AutomationRun.status` haqiqiy ustuni. */
  private async collectAgentWindow(now: number): Promise<AgentRunWindow> {
    const gte = this.since(now, ALERT_DEFINITIONS.agent_execution_failure.windowMinutes);
    // @system-scope — yuqoridagi bilan bir xil sabab.
    const [failed, total] = await Promise.all([
      this.prisma.automationRun.count({ where: { createdAt: { gte }, status: 'failed' } }),
      this.prisma.automationRun.count({ where: { createdAt: { gte } } }),
    ]);
    return { failed, total };
  }

  /** Rad etilgan impersonation urinishlari (SEC-12 audit yozuvi). */
  private async countDeniedPrivileged(now: number): Promise<AuthWindow['deniedPrivilegedAttempts']> {
    const gte = this.since(now, ALERT_DEFINITIONS.auth_anomaly.windowMinutes);
    // @system-scope — xavfsizlik signali butun platforma bo'yicha.
    return this.prisma.auditLog.count({
      where: { createdAt: { gte }, action: 'impersonation.start.denied' },
    });
  }
}
