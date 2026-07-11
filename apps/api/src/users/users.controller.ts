import { Controller, Get, Patch, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ClerkGuard } from '../auth/clerk.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UsersService } from './users.service';
import { OnboardingService } from './onboarding.service';
import { OnboardingDto, InstallRecommendationsDto } from './dto/onboarding.dto';
import type { User } from '@prisma/client';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(ClerkGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly onboarding: OnboardingService,
  ) {}

  @Get('me')
  getProfile(@CurrentUser() user: User) {
    return this.users.getProfile(user.id);
  }

  @Get('me/stats')
  getStats(@CurrentUser() user: User) {
    return this.users.getStats(user.id);
  }

  @Patch('me')
  updateProfile(
    @CurrentUser() user: User,
    @Body() dto: { isBusinessAccount?: boolean; name?: string; tourCompleted?: boolean },
  ) {
    return this.users.updateProfile(user.id, dto);
  }

  // ---- Qadriyatlar profili (Ethical Decision Engine uchun) ----

  @Get('me/values')
  getValues(@CurrentUser() user: User) {
    return (user.valuesProfile as object) ?? { tradition: 'islamic', statements: [] };
  }

  @Patch('me/values')
  setValues(@CurrentUser() user: User, @Body() dto: { tradition?: string; statements?: string[] }) {
    return this.users.updateValues(user.id, dto);
  }

  // ---- Adaptiv yadro: onboarding va tavsiyalar ----

  @Post('me/onboarding')
  completeOnboarding(@CurrentUser() user: User, @Body() dto: OnboardingDto) {
    return this.onboarding.completeOnboarding(user, dto);
  }

  @Get('me/recommendations')
  getRecommendations(@CurrentUser() user: User) {
    return this.onboarding.getRecommendations(user);
  }

  @Post('me/recommendations/install')
  installRecommendations(@CurrentUser() user: User, @Body() dto: InstallRecommendationsDto) {
    return this.onboarding.installRecommendations(user, dto);
  }
}
