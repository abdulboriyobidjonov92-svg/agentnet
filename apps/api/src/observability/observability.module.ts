import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { HealthModule } from '../health/health.module';
import { TelegramModule } from '../telegram/telegram.module';
import { UsageModule } from '../usage/usage.module';
import { buildPinoHttpOptions } from './logger.config';
import { AlertService } from './alerts/alert.service';
import { AlertEvaluatorService } from './alerts/alert-evaluator.service';

/**
 * Phase 5 — kuzatuv qatlamining yagona moduli.
 *
 * `LoggerModule.forRootAsync` EMAS, `forRoot`: konfiguratsiya faqat
 * `process.env` ga tayanadi va u boot paytida allaqachon tayyor
 * (`validateEnv()` main.ts da undan ham oldin ishlaydi). Async variant
 * hech qanday foyda bermay, boot tartibini murakkablashtirardi.
 */
@Module({
  imports: [
    LoggerModule.forRoot({ pinoHttp: buildPinoHttpOptions() }),
    HealthModule,
    TelegramModule,
    // `FreeTierBudgetService` — free tarif budjeti alerti (5-qoida) uchun.
    UsageModule,
  ],
  providers: [AlertService, AlertEvaluatorService],
  exports: [AlertService],
})
export class ObservabilityModule {}
