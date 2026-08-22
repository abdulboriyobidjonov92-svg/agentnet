import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * V3-P0 · P0-8 — LANGGRAPH IJRO HOLATI (checkpoint) SAQLAGICHI.
 *
 * Blueprint: `docs/blueprints/P0_BLUEPRINT.md` P0-8.
 *
 * ⚠️ NEGA BU API'DA. `apps/agent-engine` da DB kutubxonasi UMUMAN yo'q va
 * u Postgres'ga ulanmaydi (faqat HTTP). `langgraph-checkpoint-postgres` ni
 * engine'ga qo'shish unga DB kredensiallarini berish bo'lardi — engine
 * buzilsa hujumchi to'g'ridan-to'g'ri bazaga chiqardi.
 *
 * Shuning uchun holat AYNAN kerakli joyda (Postgres — Contract A10), lekin
 * unga yozish API orqali: engine tomonda `ApiCheckpointSaver` shu
 * endpointlarga boradi.
 *
 * Bu servis LangGraph semantikasini QAYTA IXTIRO QILMAYDI — u faqat
 * `BaseCheckpointSaver` talab qiladigan uchta amalni bajaradi:
 * oxirgisini olish · tarixni ro'yxatlash · yozish.
 */
@Injectable()
export class CheckpointService {
  private readonly logger = new Logger(CheckpointService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Checkpoint yozadi.
   *
   * Idempotent: `@@unique([threadId, checkpointNs, checkpointId])` — bir xil
   * checkpoint ikki marta kelsa (retry) ikkinchisi YANGILAYDI, dublikat
   * yaratmaydi. LangGraph checkpoint id'lari tartibli va takrorlanmas.
   */
  async put(input: {
    threadId: string;
    checkpointNs?: string;
    checkpointId: string;
    parentCheckpointId?: string | null;
    blob: string;
    metadata?: unknown;
  }) {
    const checkpointNs = input.checkpointNs ?? '';
    const row = await this.prisma.agentCheckpoint.upsert({
      where: {
        threadId_checkpointNs_checkpointId: {
          threadId: input.threadId,
          checkpointNs,
          checkpointId: input.checkpointId,
        },
      },
      create: {
        threadId: input.threadId,
        checkpointNs,
        checkpointId: input.checkpointId,
        parentCheckpointId: input.parentCheckpointId ?? null,
        blob: input.blob,
        metadata: (input.metadata ?? undefined) as never,
      },
      update: {
        blob: input.blob,
        metadata: (input.metadata ?? undefined) as never,
        parentCheckpointId: input.parentCheckpointId ?? null,
      },
      select: { checkpointId: true },
    });
    return { checkpointId: row.checkpointId };
  }

  /**
   * Bitta checkpoint: `checkpointId` berilsa aynan u, aks holda ENG
   * OXIRGISI (resume shu yo'ldan boradi).
   */
  async get(threadId: string, checkpointNs = '', checkpointId?: string) {
    // @system-scope: checkpoint `threadId` = `ExecutionRun.id` bo'yicha
    // saqlanadi va bu endpoint FAQAT `InternalTokenGuard` ortida (engine).
    // Foydalanuvchi yuzasi yo'q — shuning uchun tenant ustuni ham yo'q.
    const row = await this.prisma.agentCheckpoint.findFirst({
      where: { threadId, checkpointNs, ...(checkpointId ? { checkpointId } : {}) },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) return null;

    const writes = await this.writesFor(threadId, checkpointNs, row.checkpointId);
    return {
      threadId: row.threadId,
      checkpointNs: row.checkpointNs,
      checkpointId: row.checkpointId,
      parentCheckpointId: row.parentCheckpointId,
      blob: row.blob,
      metadata: row.metadata,
      writes,
    };
  }

  /**
   * Tarix — eng yangisidan eskisiga. `before` berilsa undan OLDINGILARI
   * (LangGraph `list(before=...)` semantikasi).
   */
  async list(threadId: string, opts: { checkpointNs?: string; before?: string; limit?: number } = {}) {
    const checkpointNs = opts.checkpointNs ?? '';
    const limit = Math.min(Math.max(opts.limit ?? 10, 1), 100);

    let beforeCreatedAt: Date | undefined;
    if (opts.before) {
      // @system-scope: ichki endpoint (yuqoridagi izohga qarang).
      const anchor = await this.prisma.agentCheckpoint.findFirst({
        where: { threadId, checkpointNs, checkpointId: opts.before },
        select: { createdAt: true },
      });
      beforeCreatedAt = anchor?.createdAt;
    }

    // @system-scope: ichki endpoint (yuqoridagi izohga qarang).
    const rows = await this.prisma.agentCheckpoint.findMany({
      where: {
        threadId,
        checkpointNs,
        ...(beforeCreatedAt ? { createdAt: { lt: beforeCreatedAt } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return Promise.all(
      rows.map(async (row) => ({
        threadId: row.threadId,
        checkpointNs: row.checkpointNs,
        checkpointId: row.checkpointId,
        parentCheckpointId: row.parentCheckpointId,
        blob: row.blob,
        metadata: row.metadata,
        writes: await this.writesFor(threadId, checkpointNs, row.checkpointId),
      })),
    );
  }

  /**
   * Tugun yozuvlari (`put_writes`).
   *
   * Bir chaqiruvda bir nechta yozuv keladi — ular BITTA tranzaksiyada
   * yoziladi, aks holda yarim yozilgan holat `get_tuple` ga tushib,
   * graf noto'g'ri tiklanardi.
   */
  async putWrites(input: {
    threadId: string;
    checkpointNs?: string;
    checkpointId: string;
    taskId: string;
    writes: { idx: number; channel: string; blob: string }[];
  }) {
    const checkpointNs = input.checkpointNs ?? '';
    await this.prisma.$transaction(
      input.writes.map((w) =>
        this.prisma.agentCheckpointWrite.upsert({
          where: {
            threadId_checkpointNs_checkpointId_taskId_idx: {
              threadId: input.threadId,
              checkpointNs,
              checkpointId: input.checkpointId,
              taskId: input.taskId,
              idx: w.idx,
            },
          },
          create: {
            threadId: input.threadId,
            checkpointNs,
            checkpointId: input.checkpointId,
            taskId: input.taskId,
            idx: w.idx,
            channel: w.channel,
            blob: w.blob,
          },
          update: { channel: w.channel, blob: w.blob },
        }),
      ),
    );
    return { written: input.writes.length };
  }

  /**
   * Run tugagach holatni tozalaydi.
   *
   * Checkpoint — QISQA MUDDATLI ijro holati, xotira EMAS (P0-15 jadvali:
   * 7 kun). Run yakunlangach u kerak emas; retention cron'ini kutmasdan
   * shu yerda tozalash bazani kichik saqlaydi.
   */
  async deleteForThread(threadId: string) {
    const [writes, checkpoints] = await this.prisma.$transaction([
      this.prisma.agentCheckpointWrite.deleteMany({ where: { threadId } }),
      this.prisma.agentCheckpoint.deleteMany({ where: { threadId } }),
    ]);
    return { checkpoints: checkpoints.count, writes: writes.count };
  }

  private async writesFor(threadId: string, checkpointNs: string, checkpointId: string) {
    // @system-scope: ichki endpoint (yuqoridagi izohga qarang).
    const rows = await this.prisma.agentCheckpointWrite.findMany({
      where: { threadId, checkpointNs, checkpointId },
      orderBy: [{ taskId: 'asc' }, { idx: 'asc' }],
    });
    return rows.map((w) => ({ taskId: w.taskId, idx: w.idx, channel: w.channel, blob: w.blob }));
  }
}
