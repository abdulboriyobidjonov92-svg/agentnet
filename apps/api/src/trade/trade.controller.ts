import { Body, Controller, Get, Param, Post, Query, UseGuards, UnprocessableEntityException, BadGatewayException, Logger } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { LlmQuotaGuard } from '../usage/llm-quota.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { User } from '@prisma/client';

/**
 * S6: Cross-Border Trade — engine'dagi trade modulining API qatlami.
 * Barcha aql engine'da (LLM-first + ma'lumotnoma-fallback); bu controller
 * foydalanuvchi kontekstini (til) qo'shib proksilaydi.
 */
@ApiTags('trade')
@ApiBearerAuth()
@Controller('trade')
export class TradeController {
  private readonly logger = new Logger(TradeController.name);
  private readonly engineUrl = process.env.AGENT_ENGINE_URL ?? 'http://localhost:8000';

  constructor(private readonly http: HttpService) {}

  // LlmQuotaGuard — bu 3 endpoint engine→Claude'ni chaqiradi (LLM xarajati),
  // shuning uchun kunlik+global kvota bilan himoyalanadi. tracking/fx (tashqi
  // arzon API) esa faqat ClerkGuard bilan qoladi.
  @Post('customs-docs')
  @UseGuards(LlmQuotaGuard)
  docs(@CurrentUser() user: User, @Body() body: { shipment: Record<string, any> }) {
    return this.callEngine('/trade/customs-docs', { shipment: body.shipment ?? {}, language: user.preferredLanguage ?? 'en' });
  }

  @Post('tariff')
  @UseGuards(LlmQuotaGuard)
  tariff(@CurrentUser() user: User, @Body() body: { goods: string; destination?: string }) {
    return this.callEngine('/trade/tariff', {
      goods: body.goods, destination: body.destination ?? 'Uzbekistan', language: user.preferredLanguage ?? 'en',
    });
  }

  @Post('compliance')
  @UseGuards(LlmQuotaGuard)
  compliance(@CurrentUser() user: User, @Body() body: { goods: string; origin?: string; destination?: string; counterparty?: string }) {
    return this.callEngine('/trade/compliance', {
      goods: body.goods, origin: body.origin ?? '', destination: body.destination ?? '',
      counterparty: body.counterparty ?? '', language: user.preferredLanguage ?? 'en',
    });
  }

  @Get('tracking/:trackingNumber')
  async tracking(@Param('trackingNumber') trackingNumber: string) {
    const { data } = await firstValueFrom(
      this.http.get(`${this.engineUrl}/trade/tracking/${encodeURIComponent(trackingNumber)}`, { timeout: 20_000 }),
    );
    return data;
  }

  @Get('fx')
  async fx(@Query('base') base?: string, @Query('symbols') symbols?: string) {
    const { data } = await firstValueFrom(
      this.http.get(`${this.engineUrl}/trade/fx`, {
        params: { base: base ?? 'USD', symbols: symbols ?? 'UZS,EUR,RUB,CNY,KZT' }, timeout: 20_000,
      }),
    );
    return data;
  }

  private async callEngine(path: string, body: unknown): Promise<any> {
    try {
      const { data } = await firstValueFrom(
        this.http.post(`${this.engineUrl}${path}`, body, { timeout: 90_000 }),
      );
      return data;
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      if (e?.response?.status === 422 && detail?.blocked) {
        throw new UnprocessableEntityException({ blocked: true, reason: detail.reason });
      }
      this.logger.error(`Engine xatosi (${path}): ${e.message}`);
      throw new BadGatewayException({ message: "Agent engine bilan aloqa yo'q", reason: 'engine_unavailable' });
    }
  }
}
