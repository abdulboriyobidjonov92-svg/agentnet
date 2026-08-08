import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { AdminUsersService } from './admin-users.service';
import { AdminAuditService } from './admin-audit.service';
import { AdminFeedbackService } from './admin-feedback.service';
import {
  AdminAuditQueryDto,
  AdminFeedbackQueryDto,
  AdminUsersQueryDto,
} from './dto/admin-list.dto';

/**
 * Phase 4 §6.2 — admin o'qish yuzasi.
 *
 * AVTORIZATSIYA: har route `@Roles(...)` bilan ANIQ belgilangan (Konstitutsiya
 * #1). §6.1 matritsasi bo'yicha uchala admin roli ham RO'YXAT/DETAL/AUDIT
 * ni o'qiy oladi, shuning uchun bu yerda `OWNER, ADMIN, SUPPORT`.
 * Global `RolesGuard` bundan tashqari OWNER/ADMIN uchun 2FA ni ham talab
 * qiladi (SEC-11).
 *
 * SUPPORT QAT'IY FAQAT O'QISH: bu controller'da bironta ham `@Post`/
 * `@Patch`/`@Delete` YO'Q — ya'ni read-only xususiyat "unutilgan tekshiruv"
 * bilan emas, YUZANING O'ZI bilan kafolatlanadi. Yozish amallari SEC-11
 * (xavfli-amal oqimi) bilan birga keladi.
 *
 * Prisma bu yerda CHAQIRILMAYDI (Rule #22) — barcha so'rovlar servislar va
 * ular orqali `AdminQueryService` dan o'tadi.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.SUPPORT)
export class AdminController {
  constructor(
    private readonly users: AdminUsersService,
    private readonly audit: AdminAuditService,
    private readonly feedback: AdminFeedbackService,
  ) {}

  /** §6.4 Users — kursorli ro'yxat, rol/tarif filtri, id/email/telefon qidiruvi. */
  @Get('users')
  listUsers(@Query() query: AdminUsersQueryDto) {
    return this.users.list(query);
  }

  /** §6.4 Users — detal (balans, tariflar, agent/suhbat sanoqlari). */
  @Get('users/:id')
  userDetail(@Param('id') id: string) {
    return this.users.detail(id);
  }

  /** §6.4 Audit — kursorli jurnal, aktor/amal/resurs filtri. */
  @Get('audit')
  listAudit(@Query() query: AdminAuditQueryDto) {
    return this.audit.list(query);
  }

  /** §6.4 Audit — bitta aktor zanjirining yaxlitligi (A17 `verifyChain`). */
  @Get('audit/verify/:actorId')
  verifyChain(@Param('actorId') actorId: string) {
    return this.audit.verifyChain(actorId);
  }

  /** §6.4 Feedback — kursorli ro'yxat, holat filtri. */
  @Get('feedback')
  listFeedback(@Query() query: AdminFeedbackQueryDto) {
    return this.feedback.list(query);
  }
}
