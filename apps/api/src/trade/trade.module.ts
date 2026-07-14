import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TradeController } from './trade.controller';
import { AuthModule } from '../auth/auth.module';
import { ClerkGuard } from '../auth/clerk.guard';
import { UsageModule } from '../usage/usage.module';

@Module({
  imports: [HttpModule, AuthModule, UsageModule],
  controllers: [TradeController],
  providers: [ClerkGuard],
})
export class TradeModule {}
