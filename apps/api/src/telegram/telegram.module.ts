import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';
import { AgentsModule } from '../agents/agents.module';
import { ClerkGuard } from '../auth/clerk.guard';

@Module({
  imports: [HttpModule, AgentsModule],
  controllers: [TelegramController],
  providers: [TelegramService, ClerkGuard],
  exports: [TelegramService],
})
export class TelegramModule {}
