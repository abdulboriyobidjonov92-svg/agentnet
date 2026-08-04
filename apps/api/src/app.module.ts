import { Module } from '@nestjs/common';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { RolesGuard } from './auth/roles.guard';
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
    // SEC-05: global RBAC. ThrottlerGuard'dan KEYIN turadi — Nest APP_GUARD'larni
    // ro'yxat tartibida bajaradi, ya'ni avval rate-limit, keyin avtorizatsiya.
    // Guard FAQAT `request.dbUser` mavjud (ya'ni ClerkGuard allaqachon
    // autentifikatsiya qilgan) yo'llarga ta'sir qiladi; ochiq endpointlar,
    // internal-token yo'llari va to'lov webhooklari tegilmaydi (roles.guard.ts).
    { provide: APP_GUARD, useClass: RolesGuard },
    // Global xato-filtri (observability) — har bir ishlov berilmagan xatoni
    // strukturaviy loglaydi (5xx to'liq stack bilan). Render loglarida ko'rinadi.
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
