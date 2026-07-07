import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { WebhooksController } from './webhooks.controller';
import { WalletCreditService } from './wallet-credit.service';
import { PaymeService } from './payme.service';
import { ClickService } from './click.service';
import { AuthModule } from '../auth/auth.module';
import { UsageModule } from '../usage/usage.module';

@Module({
  imports: [AuthModule, UsageModule],
  controllers: [BillingController, WebhooksController],
  providers: [BillingService, WalletCreditService, PaymeService, ClickService],
  exports: [BillingService],
})
export class BillingModule {}
