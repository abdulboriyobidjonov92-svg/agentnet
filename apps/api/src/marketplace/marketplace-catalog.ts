import { PrismaService } from '../prisma/prisma.service';

/** Katalog: usage-asosidagi reyting bilan ro'yxat. */
export class MarketplaceCatalog {
  constructor(private readonly prisma: PrismaService) {}

  async listPublished(search?: string) {
    const agents = await this.prisma.agent.findMany({
      where: {
        isPublished: true,
        ...(search && { name: { contains: search, mode: 'insensitive' } }),
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
}
