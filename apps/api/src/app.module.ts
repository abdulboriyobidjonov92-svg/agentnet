import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { AgentsModule } from './agents/agents.module';
import { ConversationsModule } from './conversations/conversations.module';
import { UsersModule } from './users/users.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { TelegramModule } from './telegram/telegram.module';
import { TwinModule } from './twin/twin.module';
import { GoalsModule } from './goals/goals.module';
import { IntelligenceModule } from './intelligence/intelligence.module';
import { AgentOsModule } from './agentos/agentos.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
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
  ],
})
export class AppModule {}
