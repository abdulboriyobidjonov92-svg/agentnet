import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClerkGuard } from '../auth/clerk.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { GovtechService } from './govtech.service';
import type { User } from '@prisma/client';

@ApiTags('govtech')
@Controller('govtech')
export class GovtechController {
  constructor(private readonly govtech: GovtechService) {}

  @Get('catalog')
  catalog() {
    return this.govtech.catalog(null);
  }

  @Post('requests')
  @ApiBearerAuth()
  @UseGuards(ClerkGuard)
  intake(@CurrentUser() user: User, @Body() body: { text: string; fullName?: string; contact?: string }) {
    return this.govtech.intake(user, body);
  }

  @Get('requests')
  @ApiBearerAuth()
  @UseGuards(ClerkGuard)
  list(@CurrentUser() user: User, @Query('status') status?: string) {
    return this.govtech.list(user, status);
  }

  @Patch('requests/:id/status')
  @ApiBearerAuth()
  @UseGuards(ClerkGuard)
  advance(@CurrentUser() user: User, @Param('id') id: string, @Body() body: { status: string; note?: string }) {
    return this.govtech.advance(user, id, body);
  }

  @Post('guide')
  @ApiBearerAuth()
  @UseGuards(ClerkGuard)
  guide(@CurrentUser() user: User, @Body() body: { query: string }) {
    return this.govtech.guide(user, body.query);
  }
}
