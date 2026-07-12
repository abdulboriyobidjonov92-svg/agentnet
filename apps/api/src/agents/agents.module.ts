import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { AgentBillingService } from './agent-billing.service';
import { AuthModule } from '../auth/auth.module';
import { ClerkGuard } from '../auth/clerk.guard';
import { UsageModule } from '../usage/usage.module';
import { ConnectorsModule } from '../connectors/connectors.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [HttpModule, AuthModule, UsageModule, ConnectorsModule, BillingModule],
  controllers: [AgentsController],
  providers: [AgentsService, AgentBillingService, ClerkGuard],
  exports: [AgentsService, AgentBillingService],
})
export class AgentsModule {}
