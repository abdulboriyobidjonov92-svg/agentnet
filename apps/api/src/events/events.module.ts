import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ExecutionEventBus } from './execution-event-bus.service';
import { ExecutionEventsController } from './execution-events.controller';
import { ExecutionRunService } from './execution-run.service';
import { RunsController } from './runs.controller';

/**
 * V3-P0 · P0-13 (Event Bus) + P0-7 (Trace).
 *
 * `ExecutionEventBus` EKSPORT qilinadi — ijro yo'llari (chat, automation,
 * kelajakdagi worker) hodisani shu orqali yozadi. Ikkinchi yozuv yo'li
 * qo'shilmaydi (blueprint §2.3.2).
 *
 * `PrismaModule` @Global() — bu yerda import qilinmaydi.
 */
@Module({
  imports: [AuthModule],
  controllers: [ExecutionEventsController, RunsController],
  providers: [ExecutionEventBus, ExecutionRunService],
  exports: [ExecutionEventBus, ExecutionRunService],
})
export class EventsModule {}
