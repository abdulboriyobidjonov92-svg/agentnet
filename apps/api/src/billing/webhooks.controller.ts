import { Body, Controller, Post } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { ClickService } from './click.service';

/**
 * Click Merchant serverlaridan keladigan webhook — Payme'dan farqli o'laroq
 * JSON-RPC emas, oddiy POST + action (0=Prepare, 1=Complete). Foydalanuvchi
 * autentifikatsiyasi emas — har so'rov MD5 imzo (sign_string) bilan
 * tekshiriladi (ClickService.handleWebhook ichida).
 */
@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly click: ClickService) {}

  @Post('click')
  @SkipThrottle() // Click serverlaridan keladi — to'lov ishonchliligini throttle buzmasin
  clickWebhook(@Body() body: any) {
    return this.click.handleWebhook(body ?? {});
  }
}
