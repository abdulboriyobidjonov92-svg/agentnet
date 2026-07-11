import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClerkGuard } from '../auth/clerk.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ReferralService } from './referral.service';
import type { User } from '@prisma/client';

@ApiTags('referral')
@ApiBearerAuth()
@UseGuards(ClerkGuard)
@Controller('referral')
export class ReferralController {
  constructor(private readonly referral: ReferralService) {}

  /** Mening taklif kodim + statistika (kod birinchi so'rovda yaratiladi). */
  @Get('me')
  me(@CurrentUser() user: User) {
    return this.referral.getMyReferralInfo(user);
  }
}
