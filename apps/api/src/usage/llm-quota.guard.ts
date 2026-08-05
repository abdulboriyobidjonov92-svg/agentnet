import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { UsageService } from './usage.service';
import type { User } from '@prisma/client';

/**
 * LLM-kvota darvozasi — engine (ANTHROPIC kaliti) chaqiradigan, LEKIN per-agent
 * billing yo'lidan o'tmaydigan vertikal/biznes endpointlari uchun xarajat
 * himoyasi (trade, govtech, agentos, operations, retail...).
 *
 * Nega kerak: bu endpointlar autentifikatsiya qilingan foydalanuvchi tomonidan
 * cheksiz chaqirilishi mumkin edi va HAR biri engine→Claude so'roviga aylanardi
 * — ya'ni platforma egasining ANTHROPIC kaliti bepul sarflanardi (kunlik/global
 * cap bilan himoyalanmagan). Endi `consumeChat` orqali:
 *   • per-user kunlik chat kvotasi (free 20/kun)
 *   • GLOBAL kunlik LLM cap (barcha akkauntlar bo'ylab so'nggi himoya)
 * Ikkalasi ham `consumeChat` ichida ATOMIK (poyga yo'q). Pul YECHILMAYDI (bu
 * endpointlar hozircha pulli emas) — faqat hisoblagich; shuning uchun engine
 * keyin yiqilsa refund shart emas (pul harakatlanmagan).
 *
 * MUHIM: `request.dbUser`ga tayanadi — SEC-05 (Option B)'dan beri global
 * `AuthGuard` (`APP_GUARD`) buni HAR so'rovda, bu guard ishga tushishidan
 * OLDIN to'ldiradi, shuning uchun bu yerda `@UseGuards(LlmQuotaGuard)`
 * yetarli (`AuthGuard`ni qayta ko'rsatish shart emas).
 */
@Injectable()
export class LlmQuotaGuard implements CanActivate {
  constructor(private readonly usage: UsageService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: User | undefined = request.dbUser;
    if (!user) throw new UnauthorizedException('Autentifikatsiya talab qilinadi');
    // Limit oshsa consumeChat 429 (HttpException) tashlaydi — propagatsiya qilinadi.
    await this.usage.consumeChat(user);
    return true;
  }
}
