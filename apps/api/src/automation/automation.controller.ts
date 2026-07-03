import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClerkGuard } from '../auth/clerk.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { AutomationService } from './automation.service';
import type { User } from '@prisma/client';

const INTERNAL_TOKEN = process.env.INTERNAL_API_TOKEN ?? 'agentnet-internal-dev';

@ApiTags('automation')
@Controller('automation')
export class AutomationController {
  constructor(
    private readonly automation: AutomationService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('run')
  @ApiBearerAuth()
  @UseGuards(ClerkGuard)
  run(@CurrentUser() user: User, @Body() body: { goal: string; startUrl?: string; language?: string }) {
    return this.automation.run(user, body.goal, body.startUrl, body.language);
  }

  @Get('runs')
  @ApiBearerAuth()
  @UseGuards(ClerkGuard)
  list(@CurrentUser() user: User) {
    return this.automation.listRuns(user);
  }

  @Get('capabilities')
  capabilities() {
    return this.automation.capabilities();
  }

  /**
   * Ichki endpoint — engine'dagi web.automate agent-vositasi chaqiradi.
   * Auth: x-internal-token (servislararo), user esa body'dagi userId orqali.
   */
  @Post('internal/run')
  async internalRun(
    @Headers('x-internal-token') token: string,
    @Body() body: { goal: string; startUrl?: string; userId: string; language?: string },
  ) {
    if (token !== INTERNAL_TOKEN) throw new ForbiddenException('Internal token invalid');
    const user = await this.prisma.user.findUnique({ where: { id: body.userId } });
    if (!user) throw new NotFoundException('User topilmadi');
    return this.automation.run(user, body.goal, body.startUrl, body.language);
  }
}
