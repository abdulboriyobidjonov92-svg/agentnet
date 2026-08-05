import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GovtechController } from './govtech.controller';
import { GovtechService } from './govtech.service';
import { AuthModule } from '../auth/auth.module';
import { AuthGuard } from '../auth/auth.guard';
import { UsageModule } from '../usage/usage.module';

@Module({
  imports: [HttpModule, AuthModule, UsageModule],
  controllers: [GovtechController],
  providers: [GovtechService, AuthGuard],
})
export class GovtechModule {}
