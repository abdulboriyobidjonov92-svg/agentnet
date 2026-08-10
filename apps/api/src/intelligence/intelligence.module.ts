import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { IntelligenceController } from './intelligence.controller';
import { IntelligenceService } from './intelligence.service';
import { AuthModule } from '../auth/auth.module';
import { TwinModule } from '../twin/twin.module';
import { UsageModule } from '../usage/usage.module';

@Module({
  imports: [HttpModule, AuthModule, TwinModule, UsageModule],
  controllers: [IntelligenceController],
  providers: [IntelligenceService],
})
export class IntelligenceModule {}
