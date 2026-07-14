import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { RetailController } from './retail.controller';
import { RetailService } from './retail.service';
import { CompetitorPriceService } from './competitor-price.service';
import { ManualPosAdapter } from './manual-pos.adapter';
import { POS_ADAPTER } from './pos-adapter';
import { AuthModule } from '../auth/auth.module';
import { ClerkGuard } from '../auth/clerk.guard';
import { ConnectorsModule } from '../connectors/connectors.module';
import { UsageModule } from '../usage/usage.module';

@Module({
  imports: [HttpModule, AuthModule, ConnectorsModule, UsageModule],
  controllers: [RetailController],
  providers: [
    RetailService,
    CompetitorPriceService,
    ClerkGuard,
    ManualPosAdapter,
    { provide: POS_ADAPTER, useExisting: ManualPosAdapter },
  ],
})
export class RetailModule {}
