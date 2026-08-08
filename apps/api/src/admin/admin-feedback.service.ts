import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminQueryService } from './admin-query.service';
import type { AdminFeedbackQueryDto } from './dto/admin-list.dto';

/**
 * Phase 4 §6.4 (Feedback) — FAQAT O'QISH.
 *
 * §6.2: "feedback — mavjud modul KO'CHIRILADI". Bu yerda o'qish-yo'li
 * admin shartnomasiga (kursorli pagination + filtr) o'tkazildi.
 * `setStatus` (yozish) `FeedbackModule`da QOLADI — u xavfli amal emas va
 * uni ko'chirish shu birlik doirasidan tashqari; ikki joyda takrorlanmaydi.
 */
@Injectable()
export class AdminFeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminQuery: AdminQueryService,
  ) {}

  async list(query: AdminFeedbackQueryDto) {
    const where: Prisma.FeedbackWhereInput = {};
    if (query.status) where.status = query.status;

    // Cross-tenant o'qish — AdminQueryService orqali (SEC-06 yagona nuqta).
    const page = await this.adminQuery.paginate(
      this.prisma.feedback,
      {
        where,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          kind: true,
          status: true,
          message: true,
          page: true,
          locale: true,
          createdAt: true,
          user: { select: { email: true, name: true } },
        },
      },
      query,
    );
    const total = await this.adminQuery.count(this.prisma.feedback, { where });

    return { ...page, total };
  }
}
