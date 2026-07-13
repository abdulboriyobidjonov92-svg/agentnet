import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

/**
 * Liveness healthcheck (M7). Ilgari API'da alohida `/health` yo'q edi va
 * render.yaml healthCheckPath `/api/docs` (Swagger) ga ishora qilardi — bu
 * Swagger'ni prod'da doim ochiq turishga majbur qilardi. Endi healthcheck shu
 * yengil, autentifikatsiyasiz endpoint'ga tushadi (global prefiks bilan
 * `/api/health`). Throttle'dan chiqarilgan — Render tez-tez ping qiladi.
 */
@Controller('health')
export class HealthController {
  @Get()
  @SkipThrottle()
  check() {
    return { status: 'ok', service: 'api', ts: new Date().toISOString() };
  }
}
