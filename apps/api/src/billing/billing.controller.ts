import { Controller, Get, Post, Body, Headers, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ClerkGuard } from '../auth/clerk.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { BillingService } from './billing.service';
import type { User } from '@prisma/client';

class TopupDto {
  amountSom: number;
}

class RefundDto {
  reason: string;
}

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(ClerkGuard)
  getBalance(@CurrentUser() user: User) {
    return this.billing.getBalance(user);
  }

  /**
   * Chat oqimidan OLDIN chaqiriladi (Next.js /api/chat/stream route).
   * Balans yetarli bo'lmasa 402 tashlaydi — Claude API'ga so'rov ketmaydi.
   */
  @Post('charge-message')
  @ApiBearerAuth()
  @UseGuards(ClerkGuard)
  chargeMessage(@CurrentUser() user: User) {
    return this.billing.chargeForMessage(user);
  }

  /** Xizmat bajarilmasa (engine xatosi/mavjud emas) — yechilgan pulni qaytaradi. */
  @Post('refund')
  @ApiBearerAuth()
  @UseGuards(ClerkGuard)
  refund(@CurrentUser() user: User, @Body() dto: RefundDto) {
    return this.billing.refund(user, dto.reason);
  }

  @Post('topup')
  @ApiBearerAuth()
  @UseGuards(ClerkGuard)
  topup(@CurrentUser() user: User, @Body() dto: TopupDto) {
    return this.billing.createTopupReceipt(user, dto.amountSom);
  }

  /**
   * Payme Merchant API webhook — Paycom serverlaridan keladi (foydalanuvchi
   * autentifikatsiyasi emas, X-Auth Basic bilan merchant-darajali tekshiruv).
   */
  @Post('payme/webhook')
  async paymeWebhook(@Headers('authorization') auth: string, @Body() body: any) {
    try {
      this.billing.verifyMerchantAuth(auth);
      return await this.billing.handleMerchantRpc(body);
    } catch (e: any) {
      // paymeError() {jsonrpc, error} shaklida — to'g'ridan-to'g'ri qaytariladi
      if (e?.error) return { jsonrpc: '2.0', id: body?.id, ...e };
      throw e;
    }
  }
}
