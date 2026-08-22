import { Controller, Get, Param, Query, Sse } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Observable, Subject } from 'rxjs';
import { CurrentUser } from '../auth/current-user.decorator';
import { PageQueryDto } from '../common/pagination/page-query.dto';
import { ExecutionEventBus } from './execution-event-bus.service';
import { ExecutionRunService } from './execution-run.service';
import type { ExecutionEventDto } from './execution-event.types';
import type { User } from '@prisma/client';

/**
 * Ijro izini o'qish (P0-7) + jonli oqim (P0-13).
 *
 * UI-4 (chat + tool ijrosi) aynan shu ikkitasidan oziqlanadi: jonli
 * oqim uchun SSE, uzilishdan keyin teshikni to'ldirish uchun `?after=`.
 */
@ApiTags('runs')
@ApiBearerAuth()
@Controller('runs')
export class RunsController {
  constructor(
    private readonly runs: ExecutionRunService,
    private readonly bus: ExecutionEventBus,
  ) {}

  /** Kursorli ro'yxat — `{ items, nextCursor, hasMore }` (Contract A18). */
  @Get()
  list(@CurrentUser() user: User, @Query() page: PageQueryDto) {
    return this.runs.list(user, page);
  }

  @Get(':runId')
  findOne(@CurrentUser() user: User, @Param('runId') runId: string) {
    return this.runs.findOne(user, runId);
  }

  /**
   * `?after=<seq>` — SSE uzilib qayta ulanganda o'tkazib yuborilgan
   * hodisalar. UI teshikni TO'LDIRADI, taxmin qilmaydi.
   */
  @Get(':runId/events')
  events(
    @CurrentUser() user: User,
    @Param('runId') runId: string,
    @Query('after') after?: string,
  ) {
    const afterSeq = Number.parseInt(after ?? '0', 10);
    return this.runs.eventsAfter(user, runId, Number.isFinite(afterSeq) ? afterSeq : 0);
  }

  /**
   * Jonli hodisa oqimi (SSE).
   *
   * Egalik oqim OCHILISHIDAN OLDIN tekshiriladi — begona `runId` uchun
   * `404` (oqim umuman ochilmaydi). Mijoz uzilganda obuna `finalize`
   * orqali tozalanadi, aks holda `Map` uzoq ishlaydigan jarayonda o'sib
   * borardi.
   */
  @Sse(':runId/stream')
  async stream(
    @CurrentUser() user: User,
    @Param('runId') runId: string,
  ): Promise<Observable<{ data: ExecutionEventDto }>> {
    await this.runs.assertOwnsRun(user, runId);

    const subject = new Subject<{ data: ExecutionEventDto }>();
    const unsubscribe = this.bus.subscribe(runId, (event) => subject.next({ data: event }));

    return new Observable<{ data: ExecutionEventDto }>((subscriber) => {
      const sub = subject.subscribe(subscriber);
      return () => {
        unsubscribe();
        sub.unsubscribe();
      };
    });
  }
}
