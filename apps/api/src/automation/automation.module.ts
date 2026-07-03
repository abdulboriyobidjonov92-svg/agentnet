import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AutomationController } from './automation.controller';
import { AutomationService } from './automation.service';
import { AuthModule } from '../auth/auth.module';
import { ClerkGuard } from '../auth/clerk.guard';

@Module({
  imports: [HttpModule, AuthModule],
  controllers: [AutomationController],
  providers: [AutomationService, ClerkGuard],
  exports: [AutomationService],
})
export class AutomationModule {}
