import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ConnectorsModule } from '../connectors/connectors.module';
import { EventsModule } from '../events/events.module';
import { ApprovalService } from './approval.service';
import { KillSwitchService } from './kill-switch.service';
import { PolicyController } from './policy.controller';
import { PolicyEngine } from './policy-engine.service';

/**
 * V3-P0 · P0-6 — Policy engine + kill switch + approval logging.
 *
 * `PolicyEngine` va `ApprovalService` EKSPORT qilinadi: tool ijro qatlami
 * (`ConnectorsService.invoke`) ularni ishlatadi.
 */
@Module({
  // `forwardRef` — ikki tomonlama: ConnectorsModule policy darvozasini
  // ishlatadi, PolicyModule esa tasdiqlangan amalni bajarish uchun
  // ConnectorsService'ga qaytadi.
  imports: [AuthModule, EventsModule, forwardRef(() => ConnectorsModule)],
  controllers: [PolicyController],
  providers: [PolicyEngine, KillSwitchService, ApprovalService],
  exports: [PolicyEngine, KillSwitchService, ApprovalService],
})
export class PolicyModule {}
