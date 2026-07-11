import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../auth/auth.service';
import { ConnectorsService } from '../connectors/connectors.service';
import type { Prisma, User } from '@prisma/client';

/**
 * Platforma obunasi (Pro/Max/Enterprise) — PER-AGENT narxlashdan (agent-pricing.ts)
 * BUTUNLAY ALOHIDA tizim. Faqat umumiy platforma-intellekt modullariga (Twin,
 * Fusion, Supermode, Ethics, Knowledge — vertical-shablon BO'LMAGAN hamma narsaga)
 * kirish huquqini beradi. Vertikal agentlar (do'kon, avtoservis...) bunga
 * bog'liq emas — ular hech qanday obunasiz ham to'liq ishlaydi.
 *
 * To'lov — wallet-balansdan EMAS, alohida oylik "kvitansiya" (Payme/Click,
 * xuddi hozirgi per-agent bilan bir xil naqsh): eslatma + muddatida
 * to'lanmasa muzlash. Karta-token orqali SUKUT AVTO-YECHIM (Netflix-uslubi,
 * foydalanuvchi harakatisiz) — KEYINGI BOSQICH (bu MVP'da yo'q).
 */

// Self-serve tariflar: pro (arzon, mahalliy) | max ($100) | max200 ($200, og'ir/premium).
// enterprise = kelishuv asosida, o'z-o'zidan sotib olinmaydi. Team = jamoa-billing (2D-b).
export const PLATFORM_PLANS = ['pro', 'max', 'max200'] as const;
export type SelfServePlatformPlan = (typeof PLATFORM_PLANS)[number];

const SUBSCRIPTION_DAYS = 30;
const REMINDER_DAYS_BEFORE = 3;

function intEnv(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/**
 * Amaldagi platforma-tarifi — muzlatilgan BO'LSA yoki muddati o'tgan bo'lsa
 * (cron hali ulgurmagan bo'lsa ham himoya sifatida) 'none'ga qaytadi.
 * Boshqa modullar (masalan UsageService) shu FUNKSIYAdan foydalanadi —
 * PlatformBillingService klassiga to'liq DI bog'liqligi kerak emas.
 */
export function effectivePlatformPlan(
  user: Pick<User, 'platformPlan' | 'platformPlanUntil' | 'platformPlanFrozen'>,
): string {
  if (user.platformPlanFrozen) return 'none';
  if (user.platformPlan !== 'none' && user.platformPlanUntil && user.platformPlanUntil.getTime() < Date.now()) {
    return 'none';
  }
  return user.platformPlan;
}

@Injectable()
export class PlatformBillingService {
  private readonly logger = new Logger(PlatformBillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly connectors: ConnectorsService,
  ) {}

  /** 30 kunlik obuna narxi (UZS tiyin). */
  priceForPlan(plan: SelfServePlatformPlan): number {
    if (plan === 'max200') return intEnv('PLATFORM_MAX200_PRICE_TIYIN', 252_000_000); // ~2 520 000 so'm (~$200)
    if (plan === 'max') return intEnv('PLATFORM_MAX_PRICE_TIYIN', 126_000_000); // ~1 260 000 so'm (~$100)
    // Pro — mahalliy bozorga moslangan (avvalgi ~$20 activation'ni bo'g'ardi)
    return intEnv('PLATFORM_PRO_PRICE_TIYIN', 14_900_000); // ~149 000 so'm (~$12)
  }

  /** Narxlar sahifasi uchun katalog — env'dagi haqiqiy narxlar. */
  plansCatalog() {
    return {
      pro: { priceSom: Math.round(this.priceForPlan('pro') / 100) },
      max: { priceSom: Math.round(this.priceForPlan('max') / 100) },
      max200: { priceSom: Math.round(this.priceForPlan('max200') / 100) },
      enterprise: { priceSom: null }, // kelishuv asosida — o'z-o'zidan sotib olinmaydi
    };
  }

  status(user: User) {
    return {
      plan: effectivePlatformPlan(user),
      rawPlan: user.platformPlan,
      until: user.platformPlanUntil,
      frozen: user.platformPlanFrozen,
    };
  }

  /**
   * Payme/Click webhook to'lovni tasdiqlagach chaqiriladi (wallet'ga EMAS,
   * to'g'ridan-to'g'ri platforma-obunasiga). Agar hali amal qilayotgan bo'lsa
   * (erta yangilash) muddat DAVOMIDAN qo'shiladi, aks holda hozirgidan boshlanadi.
   */
  async activateFromPayment(
    userId: string,
    plan: SelfServePlatformPlan,
    client: Prisma.TransactionClient = this.prisma,
  ) {
    const user = await client.user.findUniqueOrThrow({ where: { id: userId } });
    const now = new Date();
    const stillActive =
      user.platformPlan === plan && !user.platformPlanFrozen && user.platformPlanUntil && user.platformPlanUntil > now;
    const base = stillActive ? user.platformPlanUntil! : now;
    const until = addDays(base, SUBSCRIPTION_DAYS);

    const updated = await client.user.update({
      where: { id: userId },
      data: { platformPlan: plan, platformPlanUntil: until, platformPlanFrozen: false, platformReminderSentAt: null },
    });
    await this.audit.record({
      actorId: userId,
      action: 'platform.subscription_activated',
      resourceType: 'user',
      resourceId: userId,
      metadata: { plan, until: until.toISOString() },
    });
    return updated;
  }

  /**
   * To'lov BEKOR qilinganda (Payme/Click chargeback) obunani darhol muzlatadi —
   * `effectivePlatformPlan` shu zahoti 'none' qaytaradi (kirish to'xtaydi).
   * Qayta ochish faqat yangi to'lov (activateFromPayment) orqali. Wallet-balansga
   * tegilmaydi (obuna to'lovi hech qachon wallet'ga tushmagan).
   */
  async revokeSubscription(userId: string, client: Prisma.TransactionClient = this.prisma) {
    await client.user.update({
      where: { id: userId },
      data: { platformPlanFrozen: true },
    });
    await this.audit.record({
      actorId: userId,
      action: 'platform.subscription_revoked',
      resourceType: 'user',
      resourceId: userId,
      metadata: { reason: 'payment_cancelled' },
    });
  }

  /**
   * Kunlik tekshiruv — ikki mustaqil qadam:
   *  1) Muddati ${REMINDER_DAYS_BEFORE} kundan kam qolgan obunalarga BIR MARTA
   *     eslatma ("muddati yaqinlashmoqda, yangilang").
   *  2) Muddati O'TGAN va yangilanmagan obunalarni MUZLATISH (kirish to'xtatiladi,
   *     lekin qaysi tarifda bo'lgani eslab qolinadi — reaktivatsiya shu orqali).
   * Wallet-auto-charge YO'Q (qo'lda to'lov) — shuning uchun bu yerda faqat
   * bildirishnoma+holat, hech qanday balans amaliga tegilmaydi.
   */
  @Cron(CronExpression.EVERY_DAY_AT_10AM)
  async checkSubscriptions() {
    const now = new Date();

    const soon = await this.prisma.user.findMany({
      where: {
        platformPlan: { not: 'none' },
        platformPlanFrozen: false,
        platformPlanUntil: { lte: addDays(now, REMINDER_DAYS_BEFORE), gt: now },
        platformReminderSentAt: null,
      },
    });
    for (const user of soon) {
      const daysLeft = Math.max(0, Math.ceil((user.platformPlanUntil!.getTime() - now.getTime()) / 86_400_000));
      await this.notifyUser(
        user,
        `⏰ Platforma obunangiz (${user.platformPlan}) ${daysLeft} kundan keyin tugaydi. Uzluksiz foydalanish uchun yangilang.`,
      );
      await this.prisma.user.update({ where: { id: user.id }, data: { platformReminderSentAt: now } });
    }

    const overdue = await this.prisma.user.findMany({
      where: { platformPlan: { not: 'none' }, platformPlanFrozen: false, platformPlanUntil: { lte: now } },
    });
    for (const user of overdue) {
      await this.prisma.user.update({ where: { id: user.id }, data: { platformPlanFrozen: true } });
      await this.notifyUser(
        user,
        `🥶 Platforma obunangiz (${user.platformPlan}) muddati tugadi — Twin/Fusion/Supermode kabi platforma funksiyalariga kirish to'xtatildi. Yangilash uchun to'lov qiling.`,
      );
      await this.audit.record({
        actorId: user.id,
        action: 'platform.subscription_frozen',
        resourceType: 'user',
        resourceId: user.id,
        metadata: { plan: user.platformPlan },
      });
    }
    if (soon.length || overdue.length) {
      this.logger.log(`Platforma obunasi: ${soon.length} eslatma, ${overdue.length} muzlatildi`);
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
