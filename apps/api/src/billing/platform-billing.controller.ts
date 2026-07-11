import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { ClerkGuard } from '../auth/clerk.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PlatformBillingService, PLATFORM_PLANS, type SelfServePlatformPlan } from './platform-billing.service';
import { PaymeService } from './payme.service';
import { ClickService } from './click.service';
import { UsageService } from '../usage/usage.service';
import type { User } from '@prisma/client';

class SubscribeDto {
  @ApiProperty({ enum: PLATFORM_PLANS })
  @IsIn(PLATFORM_PLANS)
  plan: SelfServePlatformPlan;

  @ApiProperty({ enum: ['payme', 'click'], required: false })
  @IsOptional()
  @IsIn(['payme', 'click'])
  provider?: 'payme' | 'click';
}

/**
 * Platforma obunasi (Pro/Max/Enterprise) — PER-AGENT narxlashdan (billing.controller.ts
 * / /agents) BUTUNLAY ALOHIDA endpointlar. Enterprise o'z-o'zidan sotib
 * olinmaydi ("kelishuv asosida") — shuning uchun /subscribe faqat pro/max qabul qiladi.
 */
@ApiTags('platform-billing')
@Controller('platform')
export class PlatformBillingController {
  constructor(
    private readonly platformBilling: PlatformBillingService,
    private readonly payme: PaymeService,
    private readonly click: ClickService,
    private readonly usage: UsageService,
  ) {}

  /** Narxlar sahifasi uchun katalog — narx (billing) + kunlik limit (usage) birlashtirilgan. */
  @Get('plans')
  @ApiBearerAuth()
  @UseGuards(ClerkGuard)
  plans() {
    const prices = this.platformBilling.plansCatalog();
    const limits = this.usage.platformLimitsCatalog();
    return {
      pro: { ...prices.pro, ...limits.pro },
      max: { ...prices.max, ...limits.max },
      enterprise: { ...prices.enterprise, ...limits.enterprise },
    };
  }

  /** Joriy foydalanuvchining platforma-obunasi holati. */
  @Get('status')
  @ApiBearerAuth()
  @UseGuards(ClerkGuard)
  status(@CurrentUser() user: User) {
    return this.platformBilling.status(user);
  }

  /**
   * Pro/Max obunasiga to'lov havolasi yaratadi (Payme/Click). Hozircha QO'LDA
   * to'lanadi — webhook tasdiqlagach obuna faollashadi (billing.controller.ts'dagi
   * /payme/webhook va webhooks.controller.ts'dagi /webhooks/click orqali,
   * purpose="platform_subscription" bilan belgilangan).
   */
  @Post('subscribe')
  @ApiBearerAuth()
  @UseGuards(ClerkGuard)
  subscribe(@CurrentUser() user: User, @Body() dto: SubscribeDto) {
    const priceSom = Math.round(this.platformBilling.priceForPlan(dto.plan) / 100);
    const svc = dto.provider === 'click' ? this.click : this.payme;
    return svc.createSubscriptionReceipt(user, dto.plan, priceSom);
  }
}
