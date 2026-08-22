import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { AgentBillingService } from './agent-billing.service';
import { AuthModule } from '../auth/auth.module';
import { UsageModule } from '../usage/usage.module';
import { ConnectorsModule } from '../connectors/connectors.module';
import { BillingModule } from '../billing/billing.module';
import { EventsModule } from '../events/events.module';
import { MeteringModule } from '../metering/metering.module';

@Module({
  // `EventsModule` — ijro izi (P0-13/P0-7). Aylanma bog'liqlik yo'q:
  // EventsModule faqat AuthModule'ni import qiladi.
  imports: [HttpModule, AuthModule, UsageModule, ConnectorsModule, BillingModule, EventsModule, MeteringModule],
  controllers: [AgentsController],
  providers: [AgentsService, AgentBillingService],
  exports: [AgentsService, AgentBillingService],
})
export class AgentsModule {}
