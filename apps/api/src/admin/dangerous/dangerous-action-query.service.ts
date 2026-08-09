import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminQueryService } from '../admin-query.service';
import type { PageQuery } from '../../common/pagination/paginate';

/**
 * SEC-11 — xavfli amallar tarixi (faqat o'qish).
 *
 * Cross-tenant o'qish bo'lgani uchun `AdminQueryService` orqali o'tadi
 * (SEC-06 yagona nuqta) — Phase 4a bilan bir xil naqsh.
 */
@Injectable()
export class DangerousActionQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminQuery: AdminQueryService,
  ) {}

  async list(page: PageQuery) {
    return this.adminQuery.paginate(
      this.prisma.dangerousAction,
      {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          kind: true,
          status: true,
          reason: true,
          payload: true,
          executableAfter: true,
          expiresAt: true,
          executedAt: true,
          cancelledAt: true,
          createdAt: true,
          actor: { select: { email: true } },
          targetUser: { select: { id: true, email: true, role: true } },
        },
      },
      page,
    );
  }
}
