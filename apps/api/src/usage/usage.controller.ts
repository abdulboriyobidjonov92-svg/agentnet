import { Controller, Get, Post } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { UsageService } from './usage.service';
import type { User } from '@prisma/client';

@ApiTags('usage')
@ApiBearerAuth()
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
  @SkipThrottle() // Next.js BFF'dan (bitta IP) chaqiriladi + kunlik limit o'zi cheklaydi
  consumeChat(@CurrentUser() user: User) {
    return this.usage.consumeChat(user);
  }
}
