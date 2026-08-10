import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AutomationController } from './automation.controller';
import { AutomationService } from './automation.service';
import { AuthModule } from '../auth/auth.module';
import { UsageModule } from '../usage/usage.module';

@Module({
  imports: [HttpModule, AuthModule, UsageModule],
  controllers: [AutomationController],
  providers: [AutomationService],
  exports: [AutomationService],
})
export class AutomationModule {}
