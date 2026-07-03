import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GovtechController } from './govtech.controller';
import { GovtechService } from './govtech.service';
import { AuthModule } from '../auth/auth.module';
import { ClerkGuard } from '../auth/clerk.guard';

@Module({
  imports: [HttpModule, AuthModule],
  controllers: [GovtechController],
  providers: [GovtechService, ClerkGuard],
})
export class GovtechModule {}
