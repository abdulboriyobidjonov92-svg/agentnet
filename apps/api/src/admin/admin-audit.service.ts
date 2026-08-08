import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../auth/auth.service';
import { AdminQueryService } from './admin-query.service';
import type { AdminAuditQueryDto } from './dto/admin-list.dto';

/**
 * Phase 4 §6.4 (Audit) — FAQAT O'QISH.
 *
 * Audit jurnali `@Roles(OWNER, ADMIN, SUPPORT)` bilan ochiladi (§6.1
 * matritsasi: uchala rol ham audit ko'ra oladi).
 *
 * §6.4 "zanjir holati" ustuni A17'dagi `verifyChain(actorId)` orqali
 * beriladi — u SAQLANGAN qiymatlardan hash'ni qayta hisoblaydi. Zanjir
 * PER-ACTOR bo'lgani uchun tekshiruv ham aktor bo'yicha so'raladi.
 */
@Injectable()
export class AdminAuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminQuery: AdminQueryService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(query: AdminAuditQueryDto) {
    const where: Prisma.AuditLogWhereInput = {};
    if (query.actorId) where.actorId = query.actorId;
    if (query.action) where.action = query.action;
    if (query.resourceType) where.resourceType = query.resourceType;

    // Cross-tenant o'qish — AdminQueryService orqali (SEC-06 yagona nuqta).
    const page = await this.adminQuery.paginate(
      this.prisma.auditLog,
      {
        where,
        // `seq` — monotonik (`@unique @default(autoincrement())`), ya'ni
        // millisekund-teng yozuvlarda ham aniq tartib beradi.
        orderBy: { seq: 'desc' },
        select: {
          id: true,
          seq: true,
          actorId: true,
          action: true,
          resourceType: true,
          resourceId: true,
          metadata: true,
          createdAt: true,
          actor: { select: { email: true, name: true } },
        },
      },
      query,
    );
    const total = await this.adminQuery.count(this.prisma.auditLog, { where });

    return { ...page, total };
  }

  /**
   * §6.4: "zanjir yaxlitligini tekshirish (`verifyChain(actorId)`)".
   * A17 implementatsiyasini QAYTA YOZMAYDI — mavjud servisga o'tkazadi.
   */
  verifyChain(actorId: string) {
    return this.auditLog.verifyChain(actorId);
  }
}
