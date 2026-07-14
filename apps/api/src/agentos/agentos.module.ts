import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AgentOsController } from './agentos.controller';
import { AgentOsService } from './agentos.service';
import { AuthModule } from '../auth/auth.module';
import { ClerkGuard } from '../auth/clerk.guard';
import { UsageModule } from '../usage/usage.module';

@Module({
  imports: [HttpModule, AuthModule, UsageModule],
  controllers: [AgentOsController],
  providers: [AgentOsService, ClerkGuard],
})
export class AgentOsModule {}
