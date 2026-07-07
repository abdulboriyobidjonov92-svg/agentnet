import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../auth/auth.service';
import { ConnectorsService } from '../connectors/connectors.service';
import { addMonths } from './agents.service';
import type { Agent, User } from '@prisma/client';

const AGENT_MONTHLY_LOCK_NS = 4773;
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
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async chargeDueAgents() {
    const due = await this.prisma.agent.findMany({
      where: { monthlyPriceTiyin: { gt: 0 }, frozen: false, nextChargeAt: { lte: new Date() } },
      include: { user: true },
    });
    this.logger.log(`Cron: ${due.length} agent oylik to'lov uchun tekshirilmoqda`);
    for (const agent of due) {
      try {
        await this.chargeOne(agent);
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
        data: { nextChargeAt: addMonths(agent.nextChargeAt ?? new Date(), 1), chargeRetries: 0, frozen: false },
      });
      return 'charged' as const;
    });

    if (result === 'charged') {
      await this.audit.record({
        actorId: agent.userId,
        action: 'agent.monthly_charge',
        resourceType: 'agent',
        resourceId: agent.id,
        metadata: { amountTiyin: amount, cycle: cycleKey },
      });
      return;
    }
    if (result === 'already_charged') return; // boshqa cron/urinish allaqachon yechgan — qayta urinmaydi

    // Balans yetarli emas — qayta urinish siyosati (muzlatish oxirgi chora)
    const retries = agent.chargeRetries + 1;
    const priceSom = Math.round(amount / 100);
    if (retries >= MAX_RETRIES) {
      await this.prisma.agent.update({ where: { id: agent.id }, data: { frozen: true, chargeRetries: retries } });
      await this.notifyUser(
        agent.user,
        `🥶 "${agent.name}" agenti muzlatildi — oylik to'lov (${priceSom.toLocaleString('ru-RU')} so'm) ${MAX_RETRIES} marta muvaffaqiyatsiz bo'ldi (balans yetarli emas). Hisobingizni to'ldirib, agentni qayta faollashtiring.`,
      );
      await this.audit.record({
        actorId: agent.userId,
        action: 'agent.frozen',
        resourceType: 'agent',
        resourceId: agent.id,
        metadata: { retries, amountTiyin: amount },
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
        metadata: { retries, amountTiyin: amount },
      });
    }
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
