import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { WebhooksController } from './webhooks.controller';
import { WalletCreditService } from './wallet-credit.service';
import { PaymeService } from './payme.service';
import { ClickService } from './click.service';
import { PlatformBillingService } from './platform-billing.service';
import { PlatformBillingController } from './platform-billing.controller';
import { AuthModule } from '../auth/auth.module';
import { UsageModule } from '../usage/usage.module';
import { ConnectorsModule } from '../connectors/connectors.module';

@Module({
  imports: [AuthModule, UsageModule, ConnectorsModule],
  controllers: [BillingController, WebhooksController, PlatformBillingController],
  providers: [BillingService, WalletCreditService, PaymeService, ClickService, PlatformBillingService],
  exports: [BillingService, PlatformBillingService],
})
export class BillingModule {}
