import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ClerkGuard } from '../auth/clerk.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { MarketplaceService } from './marketplace.service';
import type { User } from '@prisma/client';

@ApiTags('marketplace')
@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplace: MarketplaceService) {}

  /** Reyting bo'yicha saralangan bozor (leaderboard). */
  @Get()
  @ApiQuery({ name: 'search', required: false })
  list(@Query('search') search?: string) {
    return this.marketplace.listPublished(search);
  }

  @Get('creator/dashboard')
  @ApiBearerAuth()
  @UseGuards(ClerkGuard)
  creatorDashboard(@CurrentUser() user: User) {
    return this.marketplace.creatorDashboard(user);
  }

  @Post('creator/payout')
  @ApiBearerAuth()
  @UseGuards(ClerkGuard)
  payout(@CurrentUser() user: User) {
    return this.marketplace.requestPayout(user);
  }

  @Post(':agentId/publish')
  @ApiBearerAuth()
  @UseGuards(ClerkGuard)
  publish(
    @CurrentUser() user: User,
    @Param('agentId') agentId: string,
    @Body() body: { price?: number; description?: string; monthlyPrice?: number },
  ) {
    return this.marketplace.publish(agentId, user, body.price, body.description, body.monthlyPrice);
  }

  @Delete(':agentId/publish')
  @ApiBearerAuth()
  @UseGuards(ClerkGuard)
  @HttpCode(204)
  unpublish(@CurrentUser() user: User, @Param('agentId') agentId: string) {
    return this.marketplace.unpublish(agentId, user);
  }

  @Post(':agentId/install')
  @ApiBearerAuth()
  @UseGuards(ClerkGuard)
  install(@CurrentUser() user: User, @Param('agentId') agentId: string) {
    return this.marketplace.install(agentId, user);
  }

  @Get(':agentId/reviews')
  reviews(@Param('agentId') agentId: string) {
    return this.marketplace.reviews(agentId);
  }

  @Post(':agentId/reviews')
  @ApiBearerAuth()
  @UseGuards(ClerkGuard)
  review(
    @CurrentUser() user: User,
    @Param('agentId') agentId: string,
    @Body() body: { rating: number; comment?: string },
  ) {
    return this.marketplace.review(agentId, user, body.rating, body.comment);
  }
}
