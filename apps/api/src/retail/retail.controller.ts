import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClerkGuard } from '../auth/clerk.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RetailService } from './retail.service';
import { CompetitorPriceService } from './competitor-price.service';
import type { User } from '@prisma/client';

@ApiTags('retail')
@ApiBearerAuth()
@UseGuards(ClerkGuard)
@Controller('retail')
export class RetailController {
  constructor(
    private readonly retail: RetailService,
    private readonly competitors: CompetitorPriceService,
  ) {}

  // Inventar
  @Get('products')
  products(@CurrentUser() user: User) {
    return this.retail.listProducts(user);
  }

  @Post('products')
  upsertProduct(@CurrentUser() user: User, @Body() body: any) {
    return this.retail.upsertProduct(user, body);
  }

  @Post('seed-demo')
  seed(@CurrentUser() user: User) {
    return this.retail.seedDemo(user);
  }

  // POS
  @Post('sales')
  sale(@CurrentUser() user: User, @Body() body: { sku: string; qty?: number; total?: number }) {
    return this.retail.recordSale(user, body);
  }

  @Get('sales')
  sales(@CurrentUser() user: User) {
    return this.retail.listSales(user);
  }

  // Bashorat: har tovar necha kunda tugaydi (savdo trendidan)
  @Get('forecast')
  forecast(@CurrentUser() user: User) {
    return this.retail.forecast(user);
  }

  // Avtonom: tugashi bashorat qilingan tovarlar uchun buyurtma qoralamalari
  @Get('reorder-plan')
  reorderPlan(@CurrentUser() user: User) {
    return this.retail.reorderPlan(user);
  }

  // Egasi bir marta ko'rib tasdiqlaydi — shundagina ta'minotchiga yuboriladi
  @Post('reorder-plan/:id/confirm')
  confirmReorder(@CurrentUser() user: User, @Param('id') id: string) {
    return this.retail.confirmReorderDraft(user, id);
  }

  @Post('reorder-plan/:id/cancel')
  cancelReorder(@CurrentUser() user: User, @Param('id') id: string) {
    return this.retail.cancelReorderDraft(user, id);
  }

  // Raqobatchi narx monitoringi (kunlik cron + qo'lda ishga tushirish)
  @Get('competitors')
  competitorSources(@CurrentUser() user: User) {
    return this.competitors.listSources(user);
  }

  @Post('competitors')
  addCompetitorSource(@CurrentUser() user: User, @Body() body: { sku: string; name: string; url?: string; manualPrice?: number }) {
    return this.competitors.addSource(user, body);
  }

  @Delete('competitors/:id')
  removeCompetitorSource(@CurrentUser() user: User, @Param('id') id: string) {
    return this.competitors.removeSource(user, id);
  }

  @Get('competitors/checks')
  competitorChecks(@CurrentUser() user: User) {
    return this.competitors.listChecks(user);
  }

  @Post('competitors/check-now')
  runCompetitorCheck(@CurrentUser() user: User) {
    return this.competitors.runCheckForUser(user);
  }

  // Kamera-vision webhook (haqiqiy CV servis shu endpointga uradi)
  @Post('vision-events')
  vision(@CurrentUser() user: User, @Body() body: any) {
    return this.retail.ingestVisionEvent(user, body ?? {});
  }

  @Get('vision-events')
  events(@CurrentUser() user: User) {
    return this.retail.listEvents(user);
  }

  // Alertlar
  @Get('alerts')
  alerts(@CurrentUser() user: User) {
    return this.retail.listAlerts(user);
  }

  // Sozlamalar (kanal tanlovi — "bu tovar tugadi" qayerga borsin)
  @Get('settings')
  settings(@CurrentUser() user: User) {
    return this.retail.getSettings(user);
  }

  @Patch('settings')
  saveSettings(@CurrentUser() user: User, @Body() body: any) {
    return this.retail.saveSettings(user, body ?? {});
  }
}
