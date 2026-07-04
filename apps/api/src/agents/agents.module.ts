import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { AuthModule } from '../auth/auth.module';
import { ClerkGuard } from '../auth/clerk.guard';
import { UsageModule } from '../usage/usage.module';

@Module({
  imports: [HttpModule, AuthModule, UsageModule],
  controllers: [AgentsController],
  providers: [AgentsService, ClerkGuard],
  exports: [AgentsService],
})
export class AgentsModule {}
