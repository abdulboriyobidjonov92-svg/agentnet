import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TelegramModule } from '../telegram/telegram.module';
import { AdminController } from './admin.controller';
import { AdminQueryService } from './admin-query.service';
import { AdminUsersService } from './admin-users.service';
import { AdminAuditService } from './admin-audit.service';
import { AdminFeedbackService } from './admin-feedback.service';
import { DangerousActionController } from './dangerous/dangerous-action.controller';
import { DangerousActionService } from './dangerous/dangerous-action.service';
import { DangerousActionQueryService } from './dangerous/dangerous-action-query.service';
import { AdminAlertService } from './dangerous/admin-alert.service';

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
  imports: [AuthModule, TelegramModule],
  controllers: [AdminController, DangerousActionController],
  providers: [
    AdminQueryService,
    AdminUsersService,
    AdminAuditService,
    AdminFeedbackService,
    // SEC-11 §6.5 — xavfli amallar frameworki
    DangerousActionService,
    DangerousActionQueryService,
    AdminAlertService,
  ],
})
export class AdminModule {}
