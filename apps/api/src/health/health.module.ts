import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

/**
 * Phase 5 (P5.5). Ilgari `HealthController` `app.module.ts` ning
 * `controllers` ro'yxatida yolg'iz turardi (bog'liqliksiz edi). Endi
 * DB tekshiruvi kerak bo'lgani uchun o'z moduliga ko'chdi — bu
 * `AppModule` ni Prisma'ga to'g'ridan-to'g'ri bog'lamaslik uchun ham.
 */
@Module({
  imports: [PrismaModule],
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
