import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminQueryService } from './admin-query.service';
import type { AdminUsersQueryDto } from './dto/admin-list.dto';

/**
 * Phase 4 §6.4 (Users) — FAQAT O'QISH.
 *
 * Yozish amallari (kredit berish, bloklash, rol tayinlash, GDPR o'chirish)
 * bu servisda ATAYLAB YO'Q: ular §6.5 xavfli-amal oqimini (sabab + TOTP +
 * ikkita audit yozuvi) talab qiladi, u esa SEC-11 doirasida. Bo'sh
 * "kelajak uchun" metod qoldirilmaydi (Rule #38).
 */

/**
 * Ro'yxatda ko'rsatiladigan maydonlar — SIRLAR ATAYLAB TASHQARIDA.
 *
 * `twoFactorSecret`, `twoFactorSecretPending` HECH QACHON tanlanmaydi:
 * admin ekrani ularni ko'rsatmaydi, ya'ni ular API javobiga umuman
 * chiqmasligi kerak (Konstitutsiya #7 — sir logga/javobga tushmaydi).
 * `select` ro'yxati "ruxsat etilganlar" printsipida — yangi maydon
 * qo'shilsa u AVTOMATIK oshkor bo'lmaydi.
 */
const USER_LIST_SELECT = {
  id: true,
  email: true,
  phone: true,
  name: true,
  role: true,
  plan: true,
  platformPlan: true,
  platformPlanFrozen: true,
  balanceTiyin: true,
  twoFactorEnabled: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminQuery: AdminQueryService,
  ) {}

  /**
   * Filtr + qidiruv bilan kursorli ro'yxat.
   *
   * Qidiruv indeksdan foydalanadigan shakllarda: ANIQ `id`, `email`/`phone`
   * PREFIKSI. `%...%` ATAYLAB yo'q (10k+ qatorda seq scan bo'lardi).
   */
  async list(query: AdminUsersQueryDto) {
    const where = this.buildWhere(query);

    // Cross-tenant o'qish — AdminQueryService orqali (SEC-06 yagona nuqta).
    const page = await this.adminQuery.paginate(
      this.prisma.user,
      { where, orderBy: { createdAt: 'desc' }, select: USER_LIST_SELECT },
      query,
    );
    const total = await this.adminQuery.count(this.prisma.user, { where });

    return { ...page, total };
  }

  /** Bitta foydalanuvchi + agregat sanoqlar (detal ekrani sarlavhasi). */
  async detail(id: string) {
    const user = await this.adminQuery.findUnique(this.prisma.user, {
      where: { id },
      select: {
        ...USER_LIST_SELECT,
        updatedAt: true,
        proUntil: true,
        platformPlanUntil: true,
        briefingOptIn: true,
        referralCode: true,
        referredById: true,
        orgId: true,
        isBusinessAccount: true,
        professionTitle: true,
        domain: true,
        _count: { select: { creditLedger: true } },
      },
    });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');

    // Agentlar/suhbatlar `User` da relation sifatida e'lon qilinmagan,
    // shuning uchun alohida sanaymiz (ikkalasi ham `@@index([userId])`).
    const [agentCount, conversationCount] = await Promise.all([
      this.adminQuery.count(this.prisma.agent, { where: { userId: id } }),
      this.adminQuery.count(this.prisma.conversation, { where: { userId: id } }),
    ]);

    return { ...user, agentCount, conversationCount };
  }

  private buildWhere(query: AdminUsersQueryDto): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {};
    if (query.role) where.role = query.role;
    if (query.platformPlan) where.platformPlan = query.platformPlan;

    const q = query.q?.trim();
    if (q) {
      where.OR = [
        { id: q },
        { email: { startsWith: q, mode: 'insensitive' } },
        { phone: { startsWith: q } },
      ];
    }
    return where;
  }
}
