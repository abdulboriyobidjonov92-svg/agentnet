import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClerkGuard } from '../auth/clerk.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RetailService } from './retail.service';
import type { User } from '@prisma/client';

@ApiTags('retail')
@ApiBearerAuth()
@UseGuards(ClerkGuard)
@Controller('retail')
export class RetailController {
  constructor(private readonly retail: RetailService) {}

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
