import { Module } from '@nestjs/common';
import { UsageService } from './usage.service';
import { UsageController } from './usage.controller';
import { LlmQuotaGuard } from './llm-quota.guard';
import { FreeTierBudgetService } from './free-tier-budget.service';
import { AuthModule } from '../auth/auth.module';

// `RedisModule` @Global() — shuning uchun bu yerda import qilinmaydi
// (`FreeTierBudgetService` `RedisService`ni to'g'ridan-to'g'ri oladi).
@Module({
  imports: [AuthModule],
  controllers: [UsageController],
  providers: [UsageService, LlmQuotaGuard, FreeTierBudgetService],
  exports: [UsageService, LlmQuotaGuard, FreeTierBudgetService],
})
export class UsageModule {}
