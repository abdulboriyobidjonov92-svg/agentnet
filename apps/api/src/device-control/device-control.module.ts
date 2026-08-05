import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { DeviceControlController } from './device-control.controller';
import { DeviceControlService } from './device-control.service';
import { DeviceCompanionService } from './device-companion.service';
import { CallRecordingService } from './call-recording.service';
import { CapabilityRouterService } from './capability-router.service';
import { AutomationModule } from '../automation/automation.module';
import { AuthModule } from '../auth/auth.module';
import { AuthGuard } from '../auth/auth.guard';
import { UsageModule } from '../usage/usage.module';
import { ConnectorsModule } from '../connectors/connectors.module';
import { BillingModule } from '../billing/billing.module';

/**
 * Device Control — qurilma-boshqaruv (BOSQICH 0: brauzer-agent).
 * Boshqa agentlardan ATAYLAB ajratilgan modul — xavfsizlik-modeli boshqacha
 * (real boshqaruv). Hozircha brauzer-agentni ta'minlaydi (mavjud
 * AutomationService/Playwright poydevorini qayta ishlatadi — noldan qurilmadi).
 *
 * ConnectorsModule — SEC-01: pairing-muvaffaqiyat bildirishnomasi
 * (DeviceCompanionService.notifyPaired) Telegram konnektori orqali yuboradi.
 * BillingModule — SEC-02: computerUsePlan() endi chargeForMessage orqali o'tadi.
 */
@Module({
  imports: [HttpModule, AutomationModule, AuthModule, UsageModule, ConnectorsModule, BillingModule],
  controllers: [DeviceControlController],
  providers: [
    AuthGuard,
    DeviceControlService,
    DeviceCompanionService,
    CallRecordingService,
    CapabilityRouterService,
  ],
  exports: [DeviceControlService],
})
export class DeviceControlModule {}
