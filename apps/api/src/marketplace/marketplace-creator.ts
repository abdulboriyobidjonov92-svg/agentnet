import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../auth/auth.service';
import { CREATOR_SHARE } from './marketplace-install';
import type { User } from '@prisma/client';

const CREATOR_BONUS_SHARE = 0.5; // creation_price'ning yarmi — bir martalik bonus

/** Kreator kabineti: daromad, yaratuvchi bonusi va payout so'rovi. */
export class MarketplaceCreator {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async creatorDashboard(user: User) {
    const [agents, ledger, bonusPayouts] = await Promise.all([
      this.prisma.agent.findMany({
        where: { userId: user.id, isPublished: true },
        select: {
          id: true, name: true, marketplacePrice: true,
          installCount: true, usageCount: true, ratingAvg: true, ratingCount: true, verified: true,
        },
      }),
      this.prisma.creatorLedger.findMany({
        where: { creatorId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      // Y5: yaratuvchi bonusi — CreatorLedger'dan ALOHIDA, HAQIQIY balansga
      // tushgan bir martalik bonuslar (har xaridor uchun ko'pi bilan bitta).
      this.prisma.payout.findMany({
        where: { originalCreatorId: user.id },
        orderBy: { paidAt: 'desc' },
        take: 50,
      }),
    ]);

    const balance = await this.prisma.creatorLedger.aggregate({
      where: { creatorId: user.id },
      _sum: { amount: true },
    });
    const bonusTotal = await this.prisma.payout.aggregate({
      where: { originalCreatorId: user.id },
      _sum: { bonusAmountTiyin: true },
    });

    return {
      agents,
      ledger,
      balance_tiyin: balance._sum.amount ?? 0,
      balance_uzs: Math.round((balance._sum.amount ?? 0) / 100),
      revenue_share: { creator: CREATOR_SHARE, platform: 1 - CREATOR_SHARE },
      payout_note: 'Payout processing is stubbed (Payme/Click merchant onboarding pending); the ledger accounting is real.',
      creatorBonus: {
        totalTiyin: bonusTotal._sum.bonusAmountTiyin ?? 0,
        totalSom: Math.round((bonusTotal._sum.bonusAmountTiyin ?? 0) / 100),
        payouts: bonusPayouts,
        share: CREATOR_BONUS_SHARE,
        note: "Har yangi xaridorning BIRINCHI to'lovida creation_price'ning yarmi — HAQIQIY balansga, bir martalik.",
      },
    };
  }

  /** Payout — balansni yopadigan manfiy yozuv (protsessing stub). */
  async requestPayout(user: User) {
    const balance = await this.prisma.creatorLedger.aggregate({
      where: { creatorId: user.id },
      _sum: { amount: true },
    });
    const amount = balance._sum.amount ?? 0;
    if (amount <= 0) throw new BadRequestException("Yechib olinadigan balans yo'q");

    const entry = await this.prisma.creatorLedger.create({
      data: {
        creatorId: user.id,
        kind: 'payout',
        amount: -amount,
        meta: { status: 'stub_pending', note: 'Payment rails not connected yet — request recorded, accounting closed.' },
      },
    });
    await this.audit.record({
      actorId: user.id, action: 'marketplace.payout_request', resourceType: 'creator_ledger', resourceId: entry.id,
      metadata: { amount_tiyin: amount },
    });
    return { requested_tiyin: amount, requested_uzs: Math.round(amount / 100), status: 'stub_pending', entryId: entry.id };
  }
}
