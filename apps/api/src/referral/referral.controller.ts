import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { ReferralService } from './referral.service';
import type { User } from '@prisma/client';

@ApiTags('referral')
@ApiBearerAuth()
@Controller('referral')
export class ReferralController {
  constructor(private readonly referral: ReferralService) {}

  /** Mening taklif kodim + statistika (kod birinchi so'rovda yaratiladi). */
  @Get('me')
  me(@CurrentUser() user: User) {
    return this.referral.getMyReferralInfo(user);
  }
}
