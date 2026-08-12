import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { RedisLockService } from './lock.service';

/**
 * Phase 6 — Redis qatlami.
 *
 * `@Global()`: `RedisService` throttler (app.module), sog'liq, qulf va
 * (keyinchalik) navbatlar tomonidan kerak bo'ladi. Uni har modulga qayta
 * import qilish o'rniga bir marta global qilamiz — bu `PrismaModule`
 * dagi bilan bir xil naqsh emas (u global emas), lekin bu yerda
 * asoslangan: Redis KESIB O'TUVCHI infratuzilma, domen modeli emas.
 */
@Global()
@Module({
  providers: [
    { provide: RedisService, useFactory: () => new RedisService(process.env) },
    RedisLockService,
  ],
  exports: [RedisService, RedisLockService],
})
export class RedisModule {}
