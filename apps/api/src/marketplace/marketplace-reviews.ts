import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { User } from '@prisma/client';

// Sifat chegarasi — verified belgisi shartlari
const VERIFIED_MIN_USAGE = 10;
const VERIFIED_MIN_SUCCESS_RATE = 0.9;

/** Baholar (haqiqiy o'rnatgan foydalanuvchilardan) va verified holatini qayta hisoblash. */
export class MarketplaceReviews {
  constructor(private readonly prisma: PrismaService) {}

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
}
