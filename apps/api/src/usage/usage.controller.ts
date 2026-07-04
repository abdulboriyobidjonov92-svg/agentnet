import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ClerkGuard } from '../auth/clerk.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UsageService } from './usage.service';
import type { User } from '@prisma/client';

@ApiTags('usage')
@ApiBearerAuth()
@UseGuards(ClerkGuard)
@Controller('usage')
export class UsageController {
  constructor(private readonly usage: UsageService) {}

  /** UI uchun qolgan kunlik kvota. */
  @Get('me')
  status(@CurrentUser() user: User) {
    return this.usage.status(user);
  }

  /**
   * Chat oqimidan OLDIN chaqiriladi (Next.js /api/chat/stream route).
   * Limit oshsa 429 tashlaydi; aks holda hisoblagichni oshirib { remaining } qaytaradi.
   */
  @Post('consume-chat')
  consumeChat(@CurrentUser() user: User) {
    return this.usage.consumeChat(user);
  }
}
