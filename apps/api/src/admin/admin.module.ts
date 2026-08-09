import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TelegramModule } from '../telegram/telegram.module';
import { BillingModule } from '../billing/billing.module';
import { ConnectorsModule } from '../connectors/connectors.module';
import { AdminController } from './admin.controller';
import { AdminQueryService } from './admin-query.service';
import { AdminUsersService } from './admin-users.service';
import { AdminAuditService } from './admin-audit.service';
import { AdminFeedbackService } from './admin-feedback.service';
import { DangerousActionController } from './dangerous/dangerous-action.controller';
import { DangerousActionService } from './dangerous/dangerous-action.service';
import { DangerousActionQueryService } from './dangerous/dangerous-action-query.service';
import { AdminAlertService } from './dangerous/admin-alert.service';
import { ImpersonationController } from './impersonation/impersonation.controller';
import { ImpersonationAdminService } from './impersonation/impersonation-admin.service';
import { ImpersonationNotifierService } from './impersonation/impersonation-notifier.service';

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
 * qayta e'lon qilinmaydi. `AuthModule` — `AuditLogService`, `TwoFactorService`
 * va (SEC-12) `ImpersonationService` uchun.
 *
 * SEC-12 qo'shgan import'lar — ikkalasi ham MAVJUD infratuzilmani qayta
 * ishlatish uchun, yangi tizim yaratmaslik uchun:
 *   • `BillingModule` -> `WalletCreditService` (qo'lda kredit MAVJUD atomik
 *     pul yo'lidan o'tadi),
 *   • `ConnectorsModule` -> `ConnectorsService` (nishonga bildirishnoma
 *     platformadagi yagona "foydalanuvchiga xabar" kanalidan boradi).
 * Bog'liqlik hamon BIR TOMONLAMA: bu modul hech kimga eksport qilmaydi.
 */
@Module({
  imports: [AuthModule, TelegramModule, BillingModule, ConnectorsModule],
  controllers: [AdminController, DangerousActionController, ImpersonationController],
  providers: [
    AdminQueryService,
    AdminUsersService,
    AdminAuditService,
    AdminFeedbackService,
    // SEC-11 §6.5 — xavfli amallar frameworki
    DangerousActionService,
    DangerousActionQueryService,
    AdminAlertService,
    // SEC-12 §6.6 — impersonation operator yuzasi
    ImpersonationAdminService,
    ImpersonationNotifierService,
  ],
})
export class AdminModule {}
