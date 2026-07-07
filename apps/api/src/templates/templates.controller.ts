import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ClerkGuard } from '../auth/clerk.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { TemplatesService } from './templates.service';
import type { User } from '@prisma/client';

/** Y3: tayyor shablon galereyasi — ko'rish, moslash, bir-bosishda o'rnatish. */
@ApiTags('templates')
@ApiBearerAuth()
@UseGuards(ClerkGuard)
@Controller('templates')
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  /** Butun galereya (murakkablik bo'yicha kamayadi). */
  @Get()
  list(@Query('language') language?: string) {
    return this.templates.list(language);
  }

  /** Kasb matnidan mos shablon(lar) — `:id` dan OLDIN e'lon qilinadi (route tartibi). */
  @Get('match')
  match(@Query('q') q: string, @Query('language') language?: string) {
    return this.templates.match(q ?? '', language);
  }

  @Get(':id')
  get(@Param('id') id: string, @Query('language') language?: string) {
    return this.templates.get(id, language);
  }

  /** Shablonni foydalanuvchiga real agent qilib o'rnatadi. */
  @Post(':id/install')
  install(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: { language?: string },
  ) {
    return this.templates.install(user, id, body?.language);
  }
}
