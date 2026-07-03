import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TradeController } from './trade.controller';
import { AuthModule } from '../auth/auth.module';
import { ClerkGuard } from '../auth/clerk.guard';

@Module({
  imports: [HttpModule, AuthModule],
  controllers: [TradeController],
  providers: [ClerkGuard],
})
export class TradeModule {}
