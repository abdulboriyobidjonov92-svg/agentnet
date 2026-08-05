import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TradeController } from './trade.controller';
import { AuthModule } from '../auth/auth.module';
import { AuthGuard } from '../auth/auth.guard';
import { UsageModule } from '../usage/usage.module';

@Module({
  imports: [HttpModule, AuthModule, UsageModule],
  controllers: [TradeController],
  providers: [AuthGuard],
})
export class TradeModule {}
