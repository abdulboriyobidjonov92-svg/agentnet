import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Ichki (server-to-server) chaqiruv guardi.
 *
 * Faqat platformaning o'z servislari (Next.js BFF, agent-engine) chaqira
 * oladigan endpointlar uchun — brauzer/foydalanuvchi to'g'ridan-to'g'ri
 * chaqira olmaydi. `x-internal-token` sarlavhasi `INTERNAL_API_TOKEN` bilan
 * solishtiriladi (doimiy-vaqtli).
 *
 * MUHIM: `INTERNAL_API_TOKEN` default qiymati (`agentnet-internal-dev`)
 * .env.example'da ochiq — shuning uchun PRODUCTION'da default yoki bo'sh
 * kalit QABUL QILINMAYDI (fail-closed). Bu, masalan, /billing/refund kabi
 * balansni oshiradigan endpointni ommaviy-ma'lum kalit bilan chetlab
 * o'tishning oldini oladi.
 */

const PUBLIC_DEV_DEFAULT = 'agentnet-internal-dev';

function safeEqual(a: string | undefined, b: string): boolean {
  if (!a) return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

@Injectable()
export class InternalTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const provided: string | undefined = request.headers['x-internal-token'];
    const configured = process.env.INTERNAL_API_TOKEN;
    const isProd = process.env.NODE_ENV === 'production';

    // Prod'da ommaviy default/bo'sh kalit — fail-closed (kuchli kalit majburiy)
    if (isProd && (!configured || configured === PUBLIC_DEV_DEFAULT)) {
      throw new UnauthorizedException(
        'INTERNAL_API_TOKEN production uchun kuchli qiymatga sozlanishi shart',
      );
    }

    const expected = configured ?? PUBLIC_DEV_DEFAULT;
    if (!safeEqual(provided, expected)) {
      throw new UnauthorizedException('Faqat ichki (server-to-server) chaqiruv ruxsat etiladi');
    }
    return true;
  }
}
