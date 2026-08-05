import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { User } from '@prisma/client';

const ALLOWED_KINDS = ['suggestion', 'bug', 'question'] as const;
type Kind = (typeof ALLOWED_KINDS)[number];

/**
 * Foydalanuvchi fikri/shikoyati/savoli. Yordam panelidan tushadi, DB'da saqlanadi;
 * admin (OWNER) ko'rib chiqadi. Chetdan kelgan matn — hech qachon bajarilmaydi,
 * faqat saqlanadi va admin'ga ko'rsatiladi.
 */
@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async submit(
    user: User,
    dto: { kind?: string; message: string; page?: string; locale?: string },
  ) {
    const kind: Kind = (ALLOWED_KINDS as readonly string[]).includes(dto.kind ?? '')
      ? (dto.kind as Kind)
      : 'suggestion';
    const message = dto.message.trim().slice(0, 2000);
    const created = await this.prisma.feedback.create({
      data: {
        userId: user.id,
        kind,
        message,
        page: dto.page?.slice(0, 200) ?? null,
        locale: dto.locale?.slice(0, 5) ?? null,
      },
      select: { id: true, createdAt: true },
    });
    return { id: created.id, received: true };
  }

  /** Admin ro'yxati — eng yangi birinchi. Faqat OWNER chaqiradi (controller gate'i). */
  async list(limit = 100) {
    // @admin-scope: bu — SEC-05'da @Roles(UserRole.OWNER) bilan himoyalangan
    // yagona chaqiruvchi (feedback.controller.ts `list()`) — chinakam admin
    // cross-tenant o'qish, BARCHA foydalanuvchilarning fikrlarini qaytaradi.
    return this.prisma.feedback.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 500),
      include: { user: { select: { email: true, name: true } } },
    });
  }

  async setStatus(id: string, status: string) {
    // Mavjud emas id'da Prisma P2025 (500) o'rniga tushunarli 404
    const exists = await this.prisma.feedback.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Fikr topilmadi');
    const next = ['new', 'seen', 'resolved'].includes(status) ? status : 'seen';
    return this.prisma.feedback.update({
      where: { id },
      data: { status: next },
      select: { id: true, status: true },
    });
  }
}
