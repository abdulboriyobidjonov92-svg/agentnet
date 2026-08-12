import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CronLeaderService } from '../redis/cron-leader.service';
import { PrismaService } from '../prisma/prisma.service';
import { tiyinToSom } from '../common/money';
import { AuditLogService } from '../auth/auth.service';
import { ConnectorsService } from '../connectors/connectors.service';
import { addMonths } from './agents.service';
import type { Agent, User } from '@prisma/client';

const AGENT_MONTHLY_LOCK_NS = 4773;
const TRIAL_END_LOCK_NS = 4775;
const MAX_RETRIES = 3;

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function monthCycleKey(agentId: string, at: Date): string {
  return `agent_monthly_${agentId}_${at.toISOString().slice(0, 7)}`; // YYYY-MM
}

/**
 * Y4: oylik avtomatik yechim. Har agent uchun bir xil oy ichida IKKI MARTA
 * yechilmasligi — CreditLedger.idempotencyKey (bitta oy = bitta kalit) +
 * pg_advisory_xact_lock (agents.service.ts'dagi assertCanCreateAgent bilan
 * bir xil naqsh) orqali kafolatlanadi. Balans yetmasa — bekor QILINMAYDI,
 * "muzlatiladi" (frozen=true), avval MAX_RETRIES marta qayta urinib ko'radi.
 */
@Injectable()
export class AgentBillingService {
  private readonly logger = new Logger(AgentBillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly connectors: ConnectorsService,
    private readonly cronLeader: CronLeaderService,
  ) {}

  /**
   * Phase 6 (A24): PUL yo'li — ko'p instansda bu cron HAR BIR instansda
   * ishga tushardi, ya'ni bir agentdan IKKI MARTA yechilishi mumkin edi.
   * Endi klaster bo'yicha bitta ijro kafolatlanadi (Redis qulfi).
   * Redis yo'q bo'lsa — bugungi bitta-instansli xulq saqlanadi.
   *
   * TTL 10 daqiqa: ijro undan uzun cho'zilsa qulf AVTOMAT uzaytiriladi.
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async chargeDueAgents() {
    return this.cronLeader.runExclusive('agent-billing.chargeDueAgents', () => this.chargeDueAgentsInner(), 600_000);
  }

  private async chargeDueAgentsInner() {
    // @system-scope: kunlik cron — bitta HTTP so'rovga yoki foydalanuvchiga
    // bog'liq emas, tizimning o'zi BARCHA foydalanuvchilarning to'lov
    // muddati kelgan agentlarini tekshiradi (bu — uning butun vazifasi).
    const due = await this.prisma.agent.findMany({
      where: { monthlyPriceTiyin: { gt: 0n }, frozen: false, nextChargeAt: { lte: new Date() } },
      include: { user: true },
    });
    this.logger.log(`Cron: ${due.length} agent oylik to'lov uchun tekshirilmoqda`);
    for (const agent of due) {
      try {
        // Sinov agentlari uchun 3-kunlik chegara ham shu cron orqali keladi
        // (nextChargeAt yaratishda +3kunga o'rnatilgan) — lekin ODDIY oylik
        // 3-marta-qayta-urinish siyosati EMAS: sinov tugagach DARHOL hal
        // qilinadi (charge-yoki-frozen), chunki sinov davrining o'zi allaqachon
        // imtiyoz muddati edi.
        if (agent.isTrialAgent) {
          await this.resolveTrialEnd(agent, agent.user);
        } else {
          await this.chargeOne(agent);
        }
      } catch (e: any) {
        this.logger.warn(`Oylik yechim xatosi (agent ${agent.id}): ${e.message}`);
      }
    }
  }

  async chargeOne(agent: Agent & { user: User }) {
    const cycleKey = monthCycleKey(agent.id, agent.nextChargeAt ?? new Date());
    const amount = agent.monthlyPriceTiyin;

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${AGENT_MONTHLY_LOCK_NS}::int, hashtext(${agent.id}))`;

      const already = await tx.creditLedger.findUnique({ where: { idempotencyKey: cycleKey } });
      if (already) return 'already_charged' as const;

      const updated = await tx.user.updateMany({
        where: { id: agent.userId, balanceTiyin: { gte: amount } },
        data: { balanceTiyin: { decrement: amount } },
      });
      if (updated.count === 0) return 'insufficient' as const;

      const fresh = await tx.user.findUniqueOrThrow({ where: { id: agent.userId }, select: { balanceTiyin: true } });
      await tx.creditLedger.create({
        data: {
          userId: agent.userId,
          kind: 'agent_monthly',
          amount: -amount,
          balanceAfter: fresh.balanceTiyin,
          meta: { agentId: agent.id, cycle: cycleKey },
          idempotencyKey: cycleKey,
        },
      });
      await tx.agent.update({
        where: { id: agent.id },
        // isTrialAgent/frozenReason ham shu yerda tozalanadi — chargeOne qaysi
        // yo'ldan chaqirilsa ham (cron, reactivate() yoki resolveTrialEnd()
        // ichidan emas — o'zi alohida), muvaffaqiyatli to'lov sinovni yopadi.
        data: {
          nextChargeAt: addMonths(agent.nextChargeAt ?? new Date(), 1),
          chargeRetries: 0,
          frozen: false,
          frozenReason: null,
          isTrialAgent: false,
        },
      });
      return 'charged' as const;
    });

    if (result === 'charged') {
      await this.audit.record({
        actorId: agent.userId,
        action: 'agent.monthly_charge',
        resourceType: 'agent',
        resourceId: agent.id,
        // A13: `metadata` — Json ustun; BigInt JSON'da xom holda yashamaydi
        // va audit hash'i uni kanoniklashtira olmaydi. Aniq satrga o'giramiz.
        metadata: { amountTiyin: amount.toString(), cycle: cycleKey },
      });
      return;
    }
    if (result === 'already_charged') return; // boshqa cron/urinish allaqachon yechgan — qayta urinmaydi

    // Balans yetarli emas — qayta urinish siyosati (muzlatish oxirgi chora)
    const retries = agent.chargeRetries + 1;
    const priceSom = tiyinToSom(amount);
    if (retries >= MAX_RETRIES) {
      await this.prisma.agent.update({
        where: { id: agent.id },
        data: { frozen: true, frozenReason: 'monthly_payment_failed', chargeRetries: retries },
      });
      await this.notifyUser(
        agent.user,
        `🥶 "${agent.name}" agenti muzlatildi — oylik to'lov (${priceSom.toLocaleString('ru-RU')} so'm) ${MAX_RETRIES} marta muvaffaqiyatsiz bo'ldi (balans yetarli emas). Hisobingizni to'ldirib, agentni qayta faollashtiring.`,
      );
      await this.audit.record({
        actorId: agent.userId,
        action: 'agent.frozen',
        resourceType: 'agent',
        resourceId: agent.id,
        metadata: { retries, amountTiyin: amount.toString() },
      });
    } else {
      await this.prisma.agent.update({
        where: { id: agent.id },
        data: { chargeRetries: retries, nextChargeAt: addDays(new Date(), 1) },
      });
      await this.notifyUser(
        agent.user,
        `⚠️ "${agent.name}" agenti uchun oylik to'lov (${priceSom.toLocaleString('ru-RU')} so'm) amalga oshmadi — balans yetarli emas. Ertaga qayta urinib ko'ramiz (${MAX_RETRIES - retries} urinish qoldi). Hisobingizni to'ldiring.`,
      );
      await this.audit.record({
        actorId: agent.userId,
        action: 'agent.charge_retry',
        resourceType: 'agent',
        resourceId: agent.id,
        metadata: { retries, amountTiyin: amount.toString() },
      });
    }
  }

  /**
   * Sinov tugashi (vaqt — 3-kunlik cron orqali, YOKI xabar-soni — agents.service.ts
   * run() orqali) chaqiradi. chargeOne'dagi 3-kunlik qayta-urinish siyosati BU YERDA
   * YO'Q — sinov davrining o'zi allaqachon imtiyoz muddati bo'lgani uchun, muvaffaqiyatsiz
   * bo'lsa DARHOL muzlatiladi (kutish yo'q). Balans yetsa jim to'lanadi va agent
   * ODDIY oylik rejimga o'tadi (isTrialAgent:false, nextChargeAt +1 oy).
   */
  async resolveTrialEnd(agent: Agent, user: User): Promise<Agent> {
    const amount = agent.monthlyPriceTiyin;

    const { agent: result, action } = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${TRIAL_END_LOCK_NS}::int, hashtext(${agent.id}))`;

      const fresh = await tx.agent.findUniqueOrThrow({ where: { id: agent.id } });
      if (!fresh.isTrialAgent || fresh.frozen) {
        return { agent: fresh, action: 'noop' as const }; // boshqa yo'l (cron/xabar) allaqachon hal qilgan
      }

      if (amount > 0) {
        const updatedUser = await tx.user.updateMany({
          where: { id: user.id, balanceTiyin: { gte: amount } },
          data: { balanceTiyin: { decrement: amount } },
        });
        if (updatedUser.count > 0) {
          const freshUser = await tx.user.findUniqueOrThrow({ where: { id: user.id }, select: { balanceTiyin: true } });
          await tx.creditLedger.create({
            data: {
              userId: user.id,
              kind: 'agent_monthly',
              amount: -amount,
              balanceAfter: freshUser.balanceTiyin,
              meta: { agentId: fresh.id, trialConverted: true },
            },
          });
          const converted = await tx.agent.update({
            where: { id: fresh.id },
            data: {
              isTrialAgent: false,
              frozen: false,
              frozenReason: null,
              nextChargeAt: addMonths(new Date(), 1),
            },
          });
          return { agent: converted, action: 'converted' as const };
        }
      }

      const frozenAgent = await tx.agent.update({
        where: { id: fresh.id },
        data: { frozen: true, frozenReason: 'trial_expired', isTrialAgent: false },
      });
      return { agent: frozenAgent, action: 'frozen' as const };
    });

    if (action === 'frozen') {
      await this.notifyUser(
        user,
        `⏳ "${agent.name}" agentining SINOV muddati tugadi. Davom etish uchun oylik to'lovni (${tiyinToSom(amount).toLocaleString('ru-RU')} so'm) amalga oshiring va agentni qayta faollashtiring.`,
      );
      await this.audit.record({
        actorId: user.id,
        action: 'agent.trial_expired',
        resourceType: 'agent',
        resourceId: agent.id,
        metadata: { amountTiyin: amount.toString() },
      });
    } else if (action === 'converted') {
      await this.audit.record({
        actorId: user.id,
        action: 'agent.trial_converted',
        resourceType: 'agent',
        resourceId: agent.id,
        metadata: { amountTiyin: amount.toString() },
      });
    }
    return result;
  }

  private async notifyUser(user: User, text: string) {
    if (!user.telegramChatId) return;
    try {
      await this.connectors.sendViaChannel(user, 'telegram', user.telegramChatId, text);
    } catch {
      // Best-effort — yetkazib bo'lmasa ham audit/in-app holat saqlanadi
    }
  }
}
