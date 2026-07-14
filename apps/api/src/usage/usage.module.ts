import { Module } from '@nestjs/common';
import { UsageService } from './usage.service';
import { UsageController } from './usage.controller';
import { LlmQuotaGuard } from './llm-quota.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [UsageController],
  providers: [UsageService, LlmQuotaGuard],
  exports: [UsageService, LlmQuotaGuard],
})
export class UsageModule {}
