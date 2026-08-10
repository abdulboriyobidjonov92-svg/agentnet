import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { OnboardingService } from './onboarding.service';
import { AuthModule } from '../auth/auth.module';
import { TwinModule } from '../twin/twin.module';
import { UsageModule } from '../usage/usage.module';

@Module({
  imports: [HttpModule, AuthModule, TwinModule, UsageModule],
  controllers: [UsersController],
  providers: [UsersService, OnboardingService],
  exports: [UsersService],
})
export class UsersModule {}
