import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminEconomyController, UsageSummaryController } from './metering.controller';
import { MeteringService } from './metering.service';

/**
 * V3-P0 · P0-5 — foydalanish o'lchovi (metering).
 *
 * ⚠️ `UsageModule` DAN ALOHIDA. `usage/` — KVOTA (kunlik limit, abuse
 * himoyasi); `metering/` — XARAJAT o'lchovi. Ikkalasi "usage" so'zini
 * ishlatadi, lekin savollari boshqa: "ruxsat bormi?" va "bizga qancha
 * turdi?". Bitta modulga qo'shish ADR-023 §4 dagi
 * `internal cost` ↔ `user price` ajratilishini xiralashtirardi.
 */
@Module({
  imports: [AuthModule],
  controllers: [UsageSummaryController, AdminEconomyController],
  providers: [MeteringService],
  exports: [MeteringService],
})
export class MeteringModule {}
