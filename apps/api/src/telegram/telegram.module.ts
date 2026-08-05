import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';
import { AgentsModule } from '../agents/agents.module';
import { AuthGuard } from '../auth/auth.guard';

@Module({
  imports: [HttpModule, AgentsModule],
  controllers: [TelegramController],
  providers: [TelegramService, AuthGuard],
  exports: [TelegramService],
})
export class TelegramModule {}
