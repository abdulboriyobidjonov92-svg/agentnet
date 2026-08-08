import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminController } from './admin.controller';
import { AdminQueryService } from './admin-query.service';
import { AdminUsersService } from './admin-users.service';
import { AdminAuditService } from './admin-audit.service';
import { AdminFeedbackService } from './admin-feedback.service';

/**
 * Phase 4 §6.2 — Admin Panel backend moduli.
 *
 * IZOLYATSIYA TALABI (Contract Sprint 6 Rollback): bu modul butunlay olib
 * tashlansa boshqa hech narsaga ta'sir qilmasligi SHART. Shuning uchun u
 * hech qanday mavjud modulga import qilinmaydi va o'z servislarini
 * tashqariga eksport QILMAYDI — bog'liqlik faqat bir tomonlama
 * (`AppModule` -> `AdminModule`).
 *
 * `PrismaModule` va `CryptoModule` — `@Global`, shuning uchun bu yerda
 * qayta e'lon qilinmaydi. `AuthModule` — `AuditLogService` uchun
 * (A17 `verifyChain`).
 */
@Module({
  imports: [AuthModule],
  controllers: [AdminController],
  providers: [AdminQueryService, AdminUsersService, AdminAuditService, AdminFeedbackService],
})
export class AdminModule {}
