import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { IntelligenceController } from './intelligence.controller';
import { IntelligenceService } from './intelligence.service';
import { AuthModule } from '../auth/auth.module';
import { ClerkGuard } from '../auth/clerk.guard';
import { TwinModule } from '../twin/twin.module';

@Module({
  imports: [HttpModule, AuthModule, TwinModule],
  controllers: [IntelligenceController],
  providers: [IntelligenceService, ClerkGuard],
})
export class IntelligenceModule {}
