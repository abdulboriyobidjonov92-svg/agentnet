import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClerkGuard } from '../auth/clerk.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ConnectorsService } from './connectors.service';
import type { User } from '@prisma/client';

const INTERNAL_TOKEN = process.env.INTERNAL_API_TOKEN ?? 'agentnet-internal-dev';

@ApiTags('connectors')
@Controller('connectors')
export class ConnectorsController {
  constructor(
    private readonly connectors: ConnectorsService,
    private readonly prisma: PrismaService,
  ) {}

  /** Katalog — autentifikatsiyasiz ham ko'rinadi (holatsiz). */
  @Get()
  publicCatalog() {
    return this.connectors.catalog(null);
  }

  @Get('mine')
  @ApiBearerAuth()
  @UseGuards(ClerkGuard)
  myCatalog(@CurrentUser() user: User) {
    return this.connectors.catalog(user);
  }

  @Post(':connectorId/configure')
  @ApiBearerAuth()
  @UseGuards(ClerkGuard)
  configure(
    @CurrentUser() user: User,
    @Param('connectorId') connectorId: string,
    @Body() body: { config: Record<string, any> },
  ) {
    return this.connectors.configure(user, connectorId, body.config ?? {});
  }

  @Delete(':connectorId/configure')
  @ApiBearerAuth()
  @UseGuards(ClerkGuard)
  remove(@CurrentUser() user: User, @Param('connectorId') connectorId: string) {
    return this.connectors.remove(user, connectorId);
  }

  @Post(':connectorId/invoke')
  @ApiBearerAuth()
  @UseGuards(ClerkGuard)
  invoke(
    @CurrentUser() user: User,
    @Param('connectorId') connectorId: string,
    @Body() body: { action: string; params?: Record<string, any> },
  ) {
    return this.connectors.invoke(user, connectorId, body.action, body.params ?? {});
  }

  /** Ichki: engine'dagi connector.invoke agent-vositasi uchun. */
  @Post('internal/invoke')
  async internalInvoke(
    @Headers('x-internal-token') token: string,
    @Body() body: { userId: string; connectorId: string; action: string; params?: Record<string, any> },
  ) {
    if (token !== INTERNAL_TOKEN) throw new ForbiddenException('Internal token invalid');
    const user = await this.prisma.user.findUnique({ where: { id: body.userId } });
    if (!user) throw new NotFoundException('User topilmadi');
    return this.connectors.invoke(user, body.connectorId, body.action, body.params ?? {});
  }
}
