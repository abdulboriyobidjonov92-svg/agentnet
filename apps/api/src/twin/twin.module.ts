import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TwinController } from './twin.controller';
import { TwinService } from './twin.service';
import { AuthModule } from '../auth/auth.module';
import { ClerkGuard } from '../auth/clerk.guard';
import { UsageModule } from '../usage/usage.module';

@Module({
  imports: [HttpModule, AuthModule, UsageModule],
  controllers: [TwinController],
  providers: [TwinService, ClerkGuard],
  exports: [TwinService],
})
export class TwinModule {}
