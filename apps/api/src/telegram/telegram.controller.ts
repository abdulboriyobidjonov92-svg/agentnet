import { Controller, Post, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { TelegramService } from './telegram.service';
import type { User } from '@prisma/client';

@ApiTags('telegram')
@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegram: TelegramService) {}

  // Telegram botdan keladigan webhook (public endpoint)
  @Post('webhook')
  @Public()
  async handleWebhook(
    @Body() update: any,
    @Headers('x-telegram-bot-api-secret-token') secret?: string,
  ) {
    // Optional: webhook secret header tekshiruvi
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (expectedSecret && secret !== expectedSecret) {
      throw new UnauthorizedException('Webhook secret noto\'g\'ri');
    }
    await this.telegram.handleUpdate(update);
    return { ok: true };
  }

  /** Foydalanuvchi hisobini Telegram bilan bog'lash uchun bir martalik havola. */
  @Post('link-code')
  @ApiBearerAuth()
  linkCode(@CurrentUser() user: User) {
    return this.telegram.generateLinkCode(user);
  }
}
