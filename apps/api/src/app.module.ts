import { Module } from '@nestjs/common';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { AuthGuard } from './auth/auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { ImpersonationGuard } from './auth/impersonation.guard';
import { ImpersonationAuditInterceptor } from './auth/impersonation-audit.interceptor';
import { PrismaModule } from './prisma/prisma.module';
import { CryptoModule } from './crypto/crypto.module';
import { AgentsModule } from './agents/agents.module';
import { ConversationsModule } from './conversations/conversations.module';
import { UsersModule } from './users/users.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { TelegramModule } from './telegram/telegram.module';
import { TwinModule } from './twin/twin.module';
import { GoalsModule } from './goals/goals.module';
import { IntelligenceModule } from './intelligence/intelligence.module';
import { AgentOsModule } from './agentos/agentos.module';
import { AutomationModule } from './automation/automation.module';
import { ConnectorsModule } from './connectors/connectors.module';
import { RetailModule } from './retail/retail.module';
import { OperationsModule } from './operations/operations.module';
import { GovtechModule } from './govtech/govtech.module';
import { TradeModule } from './trade/trade.module';
import { UsageModule } from './usage/usage.module';
import { BillingModule } from './billing/billing.module';
import { TemplatesModule } from './templates/templates.module';
import { FeedbackModule } from './feedback/feedback.module';
import { AdminModule } from './admin/admin.module';
import { ShareModule } from './share/share.module';
import { ReferralModule } from './referral/referral.module';
import { BriefingModule } from './briefing/briefing.module';
import { DeviceControlModule } from './device-control/device-control.module';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    CryptoModule,
    AuthModule,
    UsersModule,
    AgentsModule,
    ConversationsModule,
    MarketplaceModule,
    TelegramModule,
    TwinModule,
    GoalsModule,
    IntelligenceModule,
    AgentOsModule,
    AutomationModule,
    ConnectorsModule,
    RetailModule,
    OperationsModule,
    GovtechModule,
    TradeModule,
    UsageModule,
    BillingModule,
    TemplatesModule,
    FeedbackModule,
    AdminModule,
    ShareModule,
    ReferralModule,
    BriefingModule,
    DeviceControlModule,
  ],
  providers: [
    // Global rate-limiting: har IP uchun 60s ichida 100 so'rov (ThrottlerModule
    // config'i). Ilgari modul import qilingan-u, guard ro'yxatdan o'tmagandi —
    // ya'ni limit AMALDA ishlamas edi. Server-to-server BFF endpointlari va
    // webhooklar controller darajasida @SkipThrottle bilan chiqarib tashlangan.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // SEC-05 (Option B): global autentifikatsiya. Ilgari AuthGuard har
    // controller'da alohida `@UseGuards(AuthGuard)` bilan qo'llanardi —
    // buning ostida global RolesGuard HAR DOIM `request.dbUser`ni yo'q deb
    // ko'rardi (guard tartibi: global -> controller -> route; global guard
    // controller-darajasidagi AuthGuard'dan OLDIN ishlaydi). Endi AuthGuard
    // o'zi global — barcha controller'lardagi ortiqcha `@UseGuards(AuthGuard)`
    // olib tashlandi, `@Public()` bilan belgilangan yo'llar (webhooklar,
    // companion, ichki-token, login-oldi oqim) chiqarib tashlanadi.
    { provide: APP_GUARD, useClass: AuthGuard },
    // RolesGuard AuthGuard'dan KEYIN turadi — endi haqiqatan `request.dbUser`ni
    // ko'radi. `@Public()` yo'llarda dbUser yo'q, RolesGuard o'zi ham aralashmaydi
    // (roles.guard.ts).
    { provide: APP_GUARD, useClass: RolesGuard },
    // SEC-12 §8: impersonation sessiyasidagi taqiqlar (read-only + maxfiy
    // o'qish yo'llari). RolesGuard'dan KEYIN — guardlar shu tartibda
    // ishlaydi, ya'ni imtiyozli yo'l allaqachon RolesGuard'da yopilgan
    // bo'ladi va bu guard qolgan (oddiy foydalanuvchi) yuzasini qamraydi.
    // Impersonation bo'lmagan so'rovlarda darhol `true` qaytaradi.
    { provide: APP_GUARD, useClass: ImpersonationGuard },
    // Global xato-filtri (observability) — har bir ishlov berilmagan xatoni
    // strukturaviy loglaydi (5xx to'liq stack bilan). Render loglarida ko'rinadi.
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // SEC-12 §6.6: impersonation orqali o'tgan HAR SO'ROV auditlanadi
    // (ruxsat berilganlari — bu yerda; rad etilganlari — guard'da).
    { provide: APP_INTERCEPTOR, useClass: ImpersonationAuditInterceptor },
  ],
})
export class AppModule {}
