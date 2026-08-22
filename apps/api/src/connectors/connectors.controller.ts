import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InternalTokenGuard } from '../auth/internal-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ConnectorsService } from './connectors.service';
import type { User } from '@prisma/client';

@ApiTags('connectors')
@Controller('connectors')
export class ConnectorsController {
  constructor(
    private readonly connectors: ConnectorsService,
    private readonly prisma: PrismaService,
  ) {}

  /** Katalog — autentifikatsiyasiz ham ko'rinadi (holatsiz). */
  @Get()
  @Public()
  publicCatalog() {
    return this.connectors.catalog(null);
  }

  @Get('mine')
  @ApiBearerAuth()
  myCatalog(@CurrentUser() user: User) {
    return this.connectors.catalog(user);
  }

  /**
   * `agentId` — ixtiyoriy. Berilsa konnektor FAQAT o'sha agentga
   * biriktiriladi; berilmasa foydalanuvchining barcha agentlari ishlatadi.
   */
  @Post(':connectorId/configure')
  @ApiBearerAuth()
  configure(
    @CurrentUser() user: User,
    @Param('connectorId') connectorId: string,
    @Body() body: { config: Record<string, any>; agentId?: string },
  ) {
    return this.connectors.configure(user, connectorId, body.config ?? {}, body.agentId);
  }

  /**
   * `?agentId=` — ixtiyoriy. Berilsa FAQAT o'sha agentning biriktirmasi
   * uziladi; berilmasa FAQAT umumiy yozuv. Qamrov `ConnectorsService.remove`
   * izohida batafsil.
   */
  @Delete(':connectorId/configure')
  @ApiBearerAuth()
  remove(
    @CurrentUser() user: User,
    @Param('connectorId') connectorId: string,
    @Query('agentId') agentId?: string,
  ) {
    return this.connectors.remove(user, connectorId, agentId || undefined);
  }

  /**
   * Ichki: engine'dagi connector.invoke agent-vositasi uchun. InternalTokenGuard
   * (doimiy-vaqtli + prod fail-closed) — oldingi raw `!==` o'rniga.
   *
   * TARTIB MUHIM: bu STATIK yo'l pastdagi `:connectorId/invoke` PARAMETRLI
   * yo'lidan OLDIN e'lon qilinishi SHART. Nest marshrutlarni e'lon tartibida
   * moslaydi — teskari tartibda `/connectors/internal/invoke` parametrli
   * yo'lga (`connectorId = "internal"`) tushib ketadi, u esa `@Public()` emas,
   * ya'ni global `AuthGuard` uni 401 bilan rad etadi va engine hech qachon
   * konnektorga yeta olmaydi.
   */
  @Post('internal/invoke')
  @Public()
  @UseGuards(InternalTokenGuard)
  async internalInvoke(
    @Body() body: {
      userId: string;
      connectorId: string;
      action: string;
      params?: Record<string, any>;
      agentId?: string;
    },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: body.userId } });
    if (!user) throw new NotFoundException('User topilmadi');
    return this.connectors.invoke(user, body.connectorId, body.action, body.params ?? {}, body.agentId);
  }

  @Post(':connectorId/invoke')
  @ApiBearerAuth()
  invoke(
    @CurrentUser() user: User,
    @Param('connectorId') connectorId: string,
    @Body() body: { action: string; params?: Record<string, any> },
  ) {
    return this.connectors.invoke(user, connectorId, body.action, body.params ?? {});
  }
}
