import { Controller, Get, Res } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../auth/public.decorator';
import { HealthService } from './health.service';

/**
 * Phase 5 (P5.5) — sog'liq endpointlari.
 *
 * MAVJUD XULQ SAQLANADI: `/api/health` ilgari `{status:'ok', service:'api',
 * ts}` qaytarardi va `render.yaml` `healthCheckPath` aynan shunga qaraydi.
 * Bu uchala maydon HAM QOLADI (qo'shimchalar bilan), ya'ni deploy
 * healthcheck'i buzilmaydi.
 *
 * THROTTLE SIYOSATI (P5.5 "DDoS vektoriga aylanmasin"):
 *   • `/live`  — `@SkipThrottle()`: u I/O qilmaydi, cheklash ma'nosiz va
 *     orkestrator ping'ini bo'g'ardi;
 *   • `/ready` — `@SkipThrottle()`: load-balancer tez-tez so'raydi;
 *     DB'ni himoya qiladigan narsa — limit emas, KESH va TIMEOUT;
 *   • `/`      — `@Throttle`: bu odam/monitoring uchun boy javob,
 *     minutiga 30 so'rov yetarli. Kesh bilan birga DB'ga tushadigan yuk
 *     har qanday holatda ham `HEALTH_CACHE_MS` bilan chegaralangan.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /**
   * Liveness — jarayon tirikmi. Bog'liqliklarga TEGMAYDI, doim 200.
   * Orkestrator buni "qayta ishga tushirish" qarori uchun ishlatadi.
   */
  @Get('live')
  @SkipThrottle()
  @Public()
  live() {
    return this.health.live();
  }

  /**
   * Readiness — trafik qabul qila oladimi.
   * Tayyor bo'lmasa **503** (ataylab: 200 qaytarish load-balancer'ni
   * ishlamaydigan instansga trafik yuborishga majburlardi).
   */
  @Get('ready')
  @SkipThrottle()
  @Public()
  async ready(@Res({ passthrough: true }) res: Response) {
    const report = await this.health.readiness();
    res.status(report.ready ? 200 : 503);
    return { status: report.ready ? 'ok' : 'not_ready', checks: report.checks, ts: new Date().toISOString() };
  }

  /**
   * Phase 6 — Redis uchun ALOHIDA endpoint (`/api/health/redis`).
   *
   * NEGA ALOHIDA: `/health` keshlangan (`HEALTH_CACHE_MS`) va u
   * operator uchun umumiy xulosa. Redis migratsiyasi/uzilishini
   * tekshirayotgan kishi esa KESHSIZ, aniq javob xohlaydi.
   *
   * `skipped` (REDIS_URL yo'q) — bu XATO EMAS, shuning uchun 200.
   * Faqat sozlangan-u ishlamayotgan Redis 503 beradi.
   */
  @Get('redis')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Public()
  async redis(@Res({ passthrough: true }) res: Response) {
    const check = await this.health.checkRedis();
    res.status(check.status === 'error' ? 503 : 200);
    return { ...check, ts: new Date().toISOString() };
  }

  /**
   * Diagnostik xulosa. `error` bo'lsa 503, `degraded` bo'lsa 200
   * (sabab — `health.service.ts` izohida).
   */
  @Get()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Public()
  async check(@Res({ passthrough: true }) res: Response) {
    const report = await this.health.report();
    res.status(report.status === 'error' ? 503 : 200);
    return report;
  }
}
