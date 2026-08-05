import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InternalTokenGuard } from '../auth/internal-token.guard';
import { LlmQuotaGuard } from '../usage/llm-quota.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { RetailService } from './retail.service';
import { CompetitorPriceService } from './competitor-price.service';
import type { User } from '@prisma/client';

@ApiTags('retail')
@Controller('retail')
export class RetailController {
  constructor(
    private readonly retail: RetailService,
    private readonly competitors: CompetitorPriceService,
    private readonly prisma: PrismaService,
  ) {}

  // Inventar
  @Get('products')
  @ApiBearerAuth()
  products(@CurrentUser() user: User) {
    return this.retail.listProducts(user);
  }

  @Post('products')
  @ApiBearerAuth()
  upsertProduct(@CurrentUser() user: User, @Body() body: any) {
    return this.retail.upsertProduct(user, body);
  }

  @Post('seed-demo')
  @ApiBearerAuth()
  seed(@CurrentUser() user: User) {
    return this.retail.seedDemo(user);
  }

  // POS
  @Post('sales')
  @ApiBearerAuth()
  sale(@CurrentUser() user: User, @Body() body: { sku: string; qty?: number; total?: number }) {
    return this.retail.recordSale(user, body);
  }

  @Get('sales')
  @ApiBearerAuth()
  sales(@CurrentUser() user: User) {
    return this.retail.listSales(user);
  }

  // Bashorat: har tovar necha kunda tugaydi (savdo trendidan)
  @Get('forecast')
  @ApiBearerAuth()
  @UseGuards(LlmQuotaGuard) // engine LLM (trend xulosasi)
  forecast(@CurrentUser() user: User) {
    return this.retail.forecast(user);
  }

  // Avtonom: tugashi bashorat qilingan tovarlar uchun buyurtma qoralamalari
  @Get('reorder-plan')
  @ApiBearerAuth()
  reorderPlan(@CurrentUser() user: User) {
    return this.retail.reorderPlan(user);
  }

  // Egasi bir marta ko'rib tasdiqlaydi — shundagina ta'minotchiga yuboriladi
  @Post('reorder-plan/:id/confirm')
  @ApiBearerAuth()
  confirmReorder(@CurrentUser() user: User, @Param('id') id: string) {
    return this.retail.confirmReorderDraft(user, id);
  }

  @Post('reorder-plan/:id/cancel')
  @ApiBearerAuth()
  cancelReorder(@CurrentUser() user: User, @Param('id') id: string) {
    return this.retail.cancelReorderDraft(user, id);
  }

  // Raqobatchi narx monitoringi (kunlik cron + qo'lda ishga tushirish)
  @Get('competitors')
  @ApiBearerAuth()
  competitorSources(@CurrentUser() user: User) {
    return this.competitors.listSources(user);
  }

  @Post('competitors')
  @ApiBearerAuth()
  addCompetitorSource(@CurrentUser() user: User, @Body() body: { sku: string; name: string; url?: string; manualPrice?: number }) {
    return this.competitors.addSource(user, body);
  }

  @Delete('competitors/:id')
  @ApiBearerAuth()
  removeCompetitorSource(@CurrentUser() user: User, @Param('id') id: string) {
    return this.competitors.removeSource(user, id);
  }

  @Get('competitors/checks')
  @ApiBearerAuth()
  competitorChecks(@CurrentUser() user: User) {
    return this.competitors.listChecks(user);
  }

  @Post('competitors/check-now')
  @ApiBearerAuth()
  runCompetitorCheck(@CurrentUser() user: User) {
    return this.competitors.runCheckForUser(user);
  }

  // Kamera-vision webhook (simulyator UI shu yerga uradi — foydalanuvchi o'zi sinov uchun)
  @Post('vision-events')
  @ApiBearerAuth()
  @UseGuards(LlmQuotaGuard) // ingest → engine Vision/assess (LLM)
  vision(@CurrentUser() user: User, @Body() body: any) {
    return this.retail.ingestVisionEvent(user, body ?? {});
  }

  @Get('vision-events')
  @ApiBearerAuth()
  events(@CurrentUser() user: User) {
    return this.retail.listEvents(user);
  }

  // ---- Haqiqiy IP-kamera (agent-engine camera_service.py — RTSP/ONVIF+YOLO+Claude Vision) ----

  @Post('camera/connect')
  @ApiBearerAuth()
  connectCamera(
    @CurrentUser() user: User,
    @Body() body: { cameraId: string; rtspUrl: string; highValueZones?: any[] },
  ) {
    return this.retail.connectCamera(user, body);
  }

  @Post('camera/disconnect')
  @ApiBearerAuth()
  disconnectCamera(@CurrentUser() user: User, @Body() body: { cameraId: string }) {
    return this.retail.disconnectCamera(user, body.cameraId);
  }

  @Get('camera/status')
  @ApiBearerAuth()
  cameraStatus(@CurrentUser() user: User, @Query('cameraId') cameraId?: string) {
    return this.retail.cameraStatus(user, cameraId);
  }

  /**
   * Ichki: haqiqiy CV servis (agent-engine camera_service.py) shu yerga uradi —
   * oddiy foydalanuvchi JWT emas, servislararo InternalTokenGuard (x-internal-token, doimiy-
   * vaqtli solishtirish + prod'da fail-closed — /billing/refund bilan bir xil
   * himoya; oldin raw `!==` bilan prod-default kalitni qabul qilardi).
   */
  @Post('internal/vision-events')
  @Public()
  @UseGuards(InternalTokenGuard)
  async internalVisionEvent(
    @Body()
    body: {
      userId: string;
      camera?: string;
      type?: string;
      sku?: string;
      zone?: string;
      confidence?: number;
      raw?: any;
    },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: body.userId } });
    if (!user) throw new NotFoundException('User topilmadi');
    return this.retail.ingestVisionEvent(user, body);
  }

  // Alertlar
  @Get('alerts')
  @ApiBearerAuth()
  alerts(@CurrentUser() user: User) {
    return this.retail.listAlerts(user);
  }

  // Sozlamalar (kanal tanlovi — "bu tovar tugadi" qayerga borsin)
  @Get('settings')
  @ApiBearerAuth()
  settings(@CurrentUser() user: User) {
    return this.retail.getSettings(user);
  }

  @Patch('settings')
  @ApiBearerAuth()
  saveSettings(@CurrentUser() user: User, @Body() body: any) {
    return this.retail.saveSettings(user, body ?? {});
  }
}
