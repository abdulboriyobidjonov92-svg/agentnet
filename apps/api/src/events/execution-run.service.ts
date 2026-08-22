import { Injectable, NotFoundException } from '@nestjs/common';
import { RunStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paginate, type PageQuery } from '../common/pagination/paginate';
import { toDto } from './execution-event-bus.service';
import type { ExecutionEventDto } from './execution-event.types';
import type { User } from '@prisma/client';

/**
 * V3-P0 · P0-7 — IJRO IZINI O'QISH.
 *
 * Blueprint: `docs/blueprints/P0_BLUEPRINT.md` P0-7.
 *
 * Yozuv yo'li bu yerda YO'Q — u faqat `ExecutionEventBus` da (yagona
 * nuqta qoidasi). Bu servis o'qiydi va egalikni tekshiradi.
 */
@Injectable()
export class ExecutionRunService {
  constructor(private readonly prisma: PrismaService) {}

  /** Kursorli ro'yxat (Contract A18 — offset YO'Q). */
  async list(user: User, page: PageQuery) {
    return paginate(
      this.prisma.executionRun,
      {
        where: { userId: user.id },
        orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          agentId: true,
          conversationId: true,
          status: true,
          startedAt: true,
          endedAt: true,
          stepCount: true,
          totalCostTiyin: true,
        },
      },
      page,
    );
  }

  /**
   * Bitta run + uning hodisalari.
   *
   * Begona run uchun `404` (403 EMAS): mavjudlik faktining o'zi ham
   * ma'lumot — "bunday run bor, lekin sizniki emas" degan javob
   * identifikatorlarni sanashga imkon berardi.
   */
  async findOne(user: User, runId: string) {
    const run = await this.prisma.executionRun.findFirst({
      where: { id: runId, userId: user.id },
    });
    if (!run) throw new NotFoundException('Ijro topilmadi');

    // @upstream-scope: egalik BIR NECHA QATOR YUQORIDA tekshirildi —
    // `findFirst({ id: runId, userId: user.id })` topilmasa NotFound
    // tashlangan. Quyidagi so'rov allaqachon tasdiqlangan `runId`ga tayanadi.
    const events = await this.prisma.executionEvent.findMany({
      where: { runId },
      orderBy: { seq: 'asc' },
    });

    return {
      id: run.id,
      agentId: run.agentId,
      conversationId: run.conversationId,
      status: run.status,
      startedAt: run.startedAt.toISOString(),
      endedAt: run.endedAt?.toISOString() ?? null,
      stepCount: run.stepCount,
      totalCostTiyin: run.totalCostTiyin.toString(),
      events: events.map(toDto),
    };
  }

  /**
   * `?after=<seq>` dan keyingi hodisalar — SSE uzilib qayta ulanganda
   * teshikni to'ldirish uchun (UI hech qachon "taxmin qilmaydi").
   */
  async eventsAfter(user: User, runId: string, afterSeq: number): Promise<ExecutionEventDto[]> {
    await this.assertOwnsRun(user, runId);
    // @upstream-scope: `assertOwnsRun` yuqoridagi qatorda egalikni tekshirdi
    // va begona run uchun NotFound tashladi.
    const events = await this.prisma.executionEvent.findMany({
      where: { runId, seq: { gt: afterSeq } },
      orderBy: { seq: 'asc' },
    });
    return events.map(toDto);
  }

  /** SSE ochilishida egalik tekshiruvi — oqim ochilishidan OLDIN. */
  async assertOwnsRun(user: User, runId: string): Promise<void> {
    const run = await this.prisma.executionRun.findFirst({
      where: { id: runId, userId: user.id },
      select: { id: true },
    });
    if (!run) throw new NotFoundException('Ijro topilmadi');
  }

  /**
   * Run yaratish — ijro yo'llari (chat, automation, worker) shu orqali
   * boshlanadi. Hodisa YOZMAYDI: `RUN_STARTED` ni chaqiruvchi bus orqali
   * yuboradi (yozuv nuqtasi bitta bo'lib qolsin).
   */
  async createRun(input: {
    userId: string;
    agentId: string;
    conversationId?: string | null;
  }) {
    return this.prisma.executionRun.create({
      data: {
        userId: input.userId,
        agentId: input.agentId,
        conversationId: input.conversationId ?? null,
        status: RunStatus.RUNNING,
      },
      select: { id: true, status: true, startedAt: true },
    });
  }

  /**
   * Yakuniy holatni belgilaydi.
   *
   * Hodisalar append-only bo'lgani uchun bu — hodisaning O'RNINI
   * BOSMAYDI: chaqiruvchi baribir `RUN_COMPLETED`/`RUN_FAILED` hodisasini
   * yuboradi. Bu ustunlar faqat ro'yxat va filtr uchun tezkor nusxa.
   */
  async finishRun(
    runId: string,
    status: Exclude<RunStatus, 'RUNNING'>,
    totals?: { stepCount?: number; totalCostTiyin?: bigint },
  ) {
    return this.prisma.executionRun.update({
      where: { id: runId },
      data: {
        status,
        endedAt: new Date(),
        ...(totals?.stepCount !== undefined ? { stepCount: totals.stepCount } : {}),
        ...(totals?.totalCostTiyin !== undefined ? { totalCostTiyin: totals.totalCostTiyin } : {}),
      },
      select: { id: true, status: true, endedAt: true },
    });
  }
}
