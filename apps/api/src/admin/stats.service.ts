import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface DayBucket {
  day: string;
  value: number;
}

const DAYS = 14;

@Injectable()
export class AdminStatsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Admin panel bosh sahifasi uchun agregat ko'rsatkichlar — grafiklar shu
   * yerdan to'yinadi. Hammasi haqiqiy DB agregatsiyasi (mock son yo'q).
   */
  async overview() {
    const [
      usersTotal,
      agentsTotal,
      publishedAgents,
      conversationsTotal,
      productsTotal,
      categoriesTotal,
      revenueAgg,
      usersByDay,
      revenueByDay,
      topAgents,
      agentsByCategory,
      productsByCategory,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.agent.count(),
      this.prisma.agent.count({ where: { isPublished: true } }),
      this.prisma.conversation.count(),
      this.prisma.product.count(),
      this.prisma.category.count(),
      this.prisma.creditLedger.aggregate({
        where: { kind: 'topup', amount: { gt: 0 } },
        _sum: { amount: true },
      }),
      this.usersByDay(),
      this.revenueByDay(),
      this.prisma.agent.findMany({
        orderBy: { installCount: 'desc' },
        take: 5,
        select: { id: true, name: true, installCount: true, usageCount: true, ratingAvg: true },
      }),
      this.prisma.agent.groupBy({
        by: ['categoryId'],
        _count: { _all: true },
        where: { categoryId: { not: null } },
      }),
      this.prisma.product.groupBy({
        by: ['categoryId'],
        _count: { _all: true },
        where: { categoryId: { not: null } },
      }),
    ]);

    const categoryIds = [
      ...new Set(
        [...agentsByCategory, ...productsByCategory]
          .map((r) => r.categoryId)
          .filter((id): id is string => !!id),
      ),
    ];
    const categories = categoryIds.length
      ? await this.prisma.category.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true },
        })
      : [];
    const categoryName = (id: string | null) =>
      categories.find((c) => c.id === id)?.name ?? "Kategoriyasiz";

    return {
      totals: {
        users: usersTotal,
        agents: agentsTotal,
        publishedAgents,
        conversations: conversationsTotal,
        products: productsTotal,
        categories: categoriesTotal,
        revenueTiyin: revenueAgg._sum.amount ?? 0,
      },
      usersByDay,
      revenueByDay,
      topAgents,
      agentsByCategory: agentsByCategory.map((r) => ({
        category: categoryName(r.categoryId),
        count: r._count._all,
      })),
      productsByCategory: productsByCategory.map((r) => ({
        category: categoryName(r.categoryId),
        count: r._count._all,
      })),
    };
  }

  /** So'nggi 14 kunlik ro'yxatdan o'tish soni — kunlik "bo'sh kun"lar ham 0 bilan to'ldiriladi. */
  private async usersByDay(): Promise<DayBucket[]> {
    const rows = await this.prisma.$queryRaw<{ day: Date; value: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::bigint AS value
      FROM "User"
      WHERE "createdAt" >= NOW() - (INTERVAL '1 day' * ${DAYS})
      GROUP BY 1
      ORDER BY 1 ASC
    `;
    return this.fillDays(rows);
  }

  /** So'nggi 14 kunlik haqiqiy to'lov (topup) hajmi — UZS tiyin. */
  private async revenueByDay(): Promise<DayBucket[]> {
    const rows = await this.prisma.$queryRaw<{ day: Date; value: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS day, COALESCE(SUM("amount"), 0)::bigint AS value
      FROM "CreditLedger"
      WHERE "kind" = 'topup' AND "amount" > 0 AND "createdAt" >= NOW() - (INTERVAL '1 day' * ${DAYS})
      GROUP BY 1
      ORDER BY 1 ASC
    `;
    return this.fillDays(rows);
  }

  private fillDays(rows: { day: Date; value: bigint }[]): DayBucket[] {
    const byDay = new Map(rows.map((r) => [r.day.toISOString().slice(0, 10), Number(r.value)]));
    const out: DayBucket[] = [];
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10);
      out.push({ day: key, value: byDay.get(key) ?? 0 });
    }
    return out;
  }
}
