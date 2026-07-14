import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClerkGuard } from '../auth/clerk.guard';
import { InternalTokenGuard } from '../auth/internal-token.guard';
import { LlmQuotaGuard } from '../usage/llm-quota.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { AutomationService } from './automation.service';
import type { User } from '@prisma/client';

@ApiTags('automation')
@Controller('automation')
export class AutomationController {
  constructor(
    private readonly automation: AutomationService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('run')
  @ApiBearerAuth()
  @UseGuards(ClerkGuard, LlmQuotaGuard) // ko'p-qadamli engine LLM loop — kvota bilan
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
   * Auth: InternalTokenGuard (doimiy-vaqtli solishtirish + prod'da fail-closed —
   * oldingi raw `!==` timing-xavfli edi VA prod-default kalitni qabul qilardi).
   * User esa body'dagi userId orqali.
   */
  @Post('internal/run')
  @UseGuards(InternalTokenGuard)
  async internalRun(
    @Body() body: { goal: string; startUrl?: string; userId: string; language?: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: body.userId } });
    if (!user) throw new NotFoundException('User topilmadi');
    return this.automation.run(user, body.goal, body.startUrl, body.language);
  }
}
