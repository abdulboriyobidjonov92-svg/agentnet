import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../auth/auth.service';
import type { User } from '@prisma/client';

/**
 * S8: Marketplace — haqiqiy bozor dinamikasi (statik katalog emas).
 *   - Reyting/leaderboard: haqiqiy foydalanish + baholar asosida score
 *   - "Tasdiqlangan" (verified) belgisi: ishonchlilik chegarasidan o'tganlar
 *   - Daromad taqsimoti: har pulli o'rnatish 70/30 (kreator/platforma)
 *     CreatorLedger'da haqiqiy buxgalteriya bilan; payout stub (to'lov
 *     protsessingi ulanmagan), hisob-kitob mantig'i haqiqiy.
 */

// Sifat chegarasi — verified belgisi shartlari
const VERIFIED_MIN_USAGE = 10;
const VERIFIED_MIN_SUCCESS_RATE = 0.9;
const CREATOR_SHARE = 0.7; // 70% kreator, 30% platforma

@Injectable()
export class MarketplaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  // ---- Katalog: usage-asosidagi reyting bilan ----

  async listPublished(search?: string) {
    const agents = await this.prisma.agent.findMany({
      where: {
        isPublished: true,
        ...(search && { name: { contains: search } }),
      },
      select: {
        id: true, name: true, description: true, model: true, vertical: true,
        halalFilterEnabled: true, marketplacePrice: true, createdAt: true,
        toolsConfig: true,
        installCount: true, usageCount: true, successCount: true, failCount: true,
        ratingAvg: true, ratingCount: true, verified: true,
        user: { select: { email: true } },
      },
    });

    return agents
      .map((a) => ({ ...a, score: this.score(a) }))
      .sort((x, y) => y.score - x.score)
      .map((a, i) => ({ ...a, rank: i + 1 }));
  }

  /** Bozor balli: haqiqiy foydalanish + o'rnatishlar + baholar. */
  private score(a: { usageCount: number; installCount: number; ratingAvg: number | null; ratingCount: number; verified: boolean }) {
    return (
      a.usageCount +
      a.installCount * 5 +
      (a.ratingAvg ?? 0) * a.ratingCount * 2 +
      (a.verified ? 25 : 0)
    );
  }

  // ---- Nashr qilish ----

  async publish(agentId: string, user: User, price?: number, description?: string) {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Agent topilmadi');
    if (agent.userId !== user.id) throw new ForbiddenException();

    const updated = await this.prisma.agent.update({
      where: { id: agentId },
      data: {
        isPublished: true,
        marketplacePrice: price ?? 0,
        ...(description !== undefined && { description }),
      },
    });
    await this.audit.record({ actorId: user.id, action: 'marketplace.publish', resourceType: 'agent', resourceId: agentId });
    return updated;
  }

  async unpublish(agentId: string, user: User) {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException();
    if (agent.userId !== user.id) throw new ForbiddenException();
    return this.prisma.agent.update({ where: { id: agentId }, data: { isPublished: false } });
  }

  // ---- O'rnatish: install yozuvi + daromad taqsimoti ----

  async install(publishedAgentId: string, user: User) {
    const source = await this.prisma.agent.findUnique({ where: { id: publishedAgentId } });
    if (!source || !source.isPublished) throw new NotFoundException('Marketplace agenti topilmadi');

    const price = source.marketplacePrice ?? 0;

    const installed = await this.prisma.agent.create({
      data: {
        name: `${source.name} (o'rnatildi)`,
        systemPrompt: source.systemPrompt,
        model: source.model,
        halalFilterEnabled: source.halalFilterEnabled,
        memoryEnabled: source.memoryEnabled,
        toolsConfig: source.toolsConfig as any,
        vertical: source.vertical,
        description: source.description,
        sourceAgentId: source.id,
        userId: user.id,
        isPublished: false,
      },
    });

    const install = await this.prisma.agentInstall.create({
      data: {
        sourceAgentId: source.id,
        installedAgentId: installed.id,
        userId: user.id,
        pricePaid: price,
      },
    });

    await this.prisma.agent.update({
      where: { id: source.id },
      data: { installCount: { increment: 1 } },
    });

    // Daromad taqsimoti — haqiqiy buxgalteriya (to'lov protsessingi stub)
    if (price > 0 && source.userId !== user.id) {
      const creatorShare = Math.round(price * CREATOR_SHARE);
      await this.prisma.creatorLedger.create({
        data: {
          creatorId: source.userId,
          agentId: source.id,
          kind: 'install_revenue',
          amount: creatorShare,
          meta: {
            installId: install.id,
            grossAmount: price,
            platformShare: price - creatorShare,
            note: 'Payment processing stubbed — accounting entry is real.',
          },
        },
      });
    }

    await this.audit.record({
      actorId: user.id, action: 'marketplace.install', resourceType: 'agent', resourceId: publishedAgentId,
      metadata: { installedId: installed.id, pricePaid: price },
    });
    return installed;
  }

  // ---- Baholar (haqiqiy foydalanuvchilardan) ----

  async review(publishedAgentId: string, user: User, rating: number, comment?: string) {
    const source = await this.prisma.agent.findUnique({ where: { id: publishedAgentId } });
    if (!source || !source.isPublished) throw new NotFoundException('Marketplace agenti topilmadi');

    const r = Math.round(Number(rating));
    if (!(r >= 1 && r <= 5)) throw new BadRequestException('rating 1-5 oralig\'ida bo\'lishi kerak');

    // Faqat haqiqatan o'rnatganlar baholaydi — reyting soxtalanmasin
    const hasInstall = await this.prisma.agentInstall.findFirst({
      where: { sourceAgentId: publishedAgentId, userId: user.id },
    });
    if (!hasInstall) throw new ForbiddenException("Baholash uchun avval agentni o'rnating");

    await this.prisma.agentReview.upsert({
      where: { agentId_userId: { agentId: publishedAgentId, userId: user.id } },
      create: { agentId: publishedAgentId, userId: user.id, rating: r, comment: comment ?? null },
      update: { rating: r, comment: comment ?? null },
    });

    const agg = await this.prisma.agentReview.aggregate({
      where: { agentId: publishedAgentId },
      _avg: { rating: true },
      _count: true,
    });
    await this.prisma.agent.update({
      where: { id: publishedAgentId },
      data: { ratingAvg: agg._avg.rating, ratingCount: agg._count },
    });
    await this.recomputeVerified(publishedAgentId);

    return { rating: r, ratingAvg: agg._avg.rating, ratingCount: agg._count };
  }

  async reviews(publishedAgentId: string) {
    return this.prisma.agentReview.findMany({
      where: { agentId: publishedAgentId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { rating: true, comment: true, createdAt: true, user: { select: { email: true } } },
    });
  }

  // ---- Foydalanish hodisalari (reyting + verified uchun xom signal) ----

  /**
   * O'rnatilgan agent har ishlaganda chaqiriladi (conversations hook).
   * Muvaffaqiyat/mag'lubiyat — verified belgisining asosi.
   */
  async recordUsage(sourceAgentId: string, success: boolean) {
    const exists = await this.prisma.agent.findUnique({ where: { id: sourceAgentId }, select: { id: true } });
    if (!exists) return;
    await this.prisma.agent.update({
      where: { id: sourceAgentId },
      data: {
        usageCount: { increment: 1 },
        ...(success ? { successCount: { increment: 1 } } : { failCount: { increment: 1 } }),
      },
    });
    await this.recomputeVerified(sourceAgentId);
  }

  private async recomputeVerified(agentId: string) {
    const a = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: { usageCount: true, successCount: true, failCount: true, verified: true },
    });
    if (!a) return;
    const total = a.successCount + a.failCount;
    const successRate = total > 0 ? a.successCount / total : 0;
    const verified = a.usageCount >= VERIFIED_MIN_USAGE && successRate >= VERIFIED_MIN_SUCCESS_RATE;
    if (verified !== a.verified) {
      await this.prisma.agent.update({ where: { id: agentId }, data: { verified } });
    }
  }

  // ---- Kreator kabineti: daromad va payout ----

  async creatorDashboard(user: User) {
    const [agents, ledger] = await Promise.all([
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
    ]);

    const balance = await this.prisma.creatorLedger.aggregate({
      where: { creatorId: user.id },
      _sum: { amount: true },
    });

    return {
      agents,
      ledger,
      balance_tiyin: balance._sum.amount ?? 0,
      balance_uzs: Math.round((balance._sum.amount ?? 0) / 100),
      revenue_share: { creator: CREATOR_SHARE, platform: 1 - CREATOR_SHARE },
      payout_note: 'Payout processing is stubbed (Payme/Click merchant onboarding pending); the ledger accounting is real.',
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
