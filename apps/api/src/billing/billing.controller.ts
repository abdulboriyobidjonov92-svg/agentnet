import { Controller, Get, Post, Body, Headers, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { ClerkGuard } from '../auth/clerk.guard';
import { InternalTokenGuard } from '../auth/internal-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { BillingService } from './billing.service';
import { PaymeService } from './payme.service';
import { UsageService } from '../usage/usage.service';
import type { User } from '@prisma/client';

// MUHIM: global ValidationPipe whitelist:true — dekoratorSIZ maydonlarni
// butunlay O'CHIRIB yuboradi. Ilgari bu ikkala DTO dekoratorsiz edi, ya'ni
// amountSom/reason/idempotencyKey server'ga umuman yetib kelmasdi:
// refund-idempotency (L12) himoyasi jimgina ishlamay qolgan edi.
class TopupDto {
  @IsNumber()
  amountSom: number;

  @IsOptional()
  @IsIn(['payme', 'click'])
  provider?: 'payme' | 'click';
}

class RefundDto {
  @IsString()
  @MaxLength(100)
  reason: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  idempotencyKey?: string;
}

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly usage: UsageService,
    private readonly payme: PaymeService,
  ) {}

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(ClerkGuard)
  getBalance(@CurrentUser() user: User) {
    return this.billing.getBalance(user);
  }

  /** Pricing sahifasi uchun tariflar katalogi — env'dagi haqiqiy narx/limitlar. */
  @Get('plans')
  @ApiBearerAuth()
  @UseGuards(ClerkGuard)
  plans() {
    return {
      pricePerMessageSom: Math.round(this.billing.pricePerMessageTiyin / 100),
      proMonthSom: Math.round(this.billing.proMonthTiyin / 100),
      limits: this.usage.limitsCatalog(),
    };
  }

  /** Prepaid balansdan 30 kunlik Pro obuna sotib olish. Balans yetmasa 402. */
  @Post('upgrade-pro')
  @ApiBearerAuth()
  @UseGuards(ClerkGuard)
  upgradePro(@CurrentUser() user: User) {
    return this.billing.upgradePro(user);
  }

  /**
   * Chat oqimidan OLDIN chaqiriladi (Next.js /api/chat/stream route).
   * Balans yetarli bo'lmasa 402 tashlaydi — Claude API'ga so'rov ketmaydi.
   */
  @Post('charge-message')
  @SkipThrottle() // Next.js BFF'dan (bitta IP) chaqiriladi + har-user balans o'zi cheklaydi
  @ApiBearerAuth()
  @UseGuards(ClerkGuard)
  chargeMessage(@CurrentUser() user: User) {
    return this.billing.chargeForMessage(user);
  }

  /**
   * Xizmat bajarilmasa (engine xatosi/mavjud emas) — yechilgan pulni qaytaradi.
   * FAQAT ichki chaqiruv (Next.js BFF): balansni OSHIRADI, shuning uchun
   * InternalTokenGuard bilan himoyalangan — brauzer/foydalanuvchi to'g'ridan-to'g'ri
   * chaqirib bepul kredit ola olmaydi. ClerkGuard qaysi foydalanuvchi ekanini
   * (BFF uzatadigan bearer token orqali) aniqlaydi.
   */
  @Post('refund')
  @ApiBearerAuth()
  @UseGuards(ClerkGuard, InternalTokenGuard)
  refund(@CurrentUser() user: User, @Body() dto: RefundDto) {
    return this.billing.refund(user, dto.reason, dto.idempotencyKey);
  }

  /** Balansni to'ldirish — foydalanuvchi checkout'da Payme yoki Click'ni tanlaydi. */
  @Post('topup')
  @ApiBearerAuth()
  @UseGuards(ClerkGuard)
  topup(@CurrentUser() user: User, @Body() dto: TopupDto) {
    return this.billing.createTopupReceipt(user, dto.amountSom, dto.provider);
  }

  /**
   * Payme Merchant API webhook — Paycom serverlaridan keladi (foydalanuvchi
   * autentifikatsiyasi emas, X-Auth Basic bilan merchant-darajali tekshiruv).
   */
  @Post('payme/webhook')
  @SkipThrottle() // Paycom serverlaridan keladi — to'lov ishonchliligini throttle buzmasin
  @Public()
  async paymeWebhook(@Headers('authorization') auth: string, @Body() body: any) {
    try {
      this.payme.verifyMerchantAuth(auth);
      return await this.payme.handleMerchantRpc(body);
    } catch (e: any) {
      // paymeError() {jsonrpc, error} shaklida — to'g'ridan-to'g'ri qaytariladi
      if (e?.error) return { jsonrpc: '2.0', id: body?.id, ...e };
      throw e;
    }
  }
}
