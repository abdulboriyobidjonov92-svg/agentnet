import { Injectable, Logger } from '@nestjs/common';
import { Prisma, ExecutionEventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { scrubValue } from '../observability/redaction';
import {
  ExecutionEventDto,
  ExecutionEventInput,
  MAX_EVENTS_PER_RUN,
  MAX_PAYLOAD_CHARS,
  TERMINAL_EVENT_TYPES,
} from './execution-event.types';

/**
 * V3-P0 · P0-13 — AGENT IJROSI HODISA SHINASI.
 *
 * Blueprint: `docs/blueprints/P0_BLUEPRINT.md` §2.3, P0-13.
 *
 * BU — YAGONA YOZUV NUQTASI. UI (SSE), trace (P0-7), metering (P0-5) va
 * admin — hammasi shu shinadan oziqlanadi. Iste'molchi o'z jadvalini
 * yaratmaydi; yangi iste'molchi `subscribe()` bilan qo'shiladi.
 *
 * ⚠️ REDAKSIYA CHETLAB O'TILMAYDI. `emit()` payloadni `scrubValue()` dan
 * MAJBURIY o'tkazadi — bu tartib ataylab shu yerda, iste'molchilarda emas:
 * hech bir obunachi xom payloadni ko'rmaydi va hech kim "men allaqachon
 * tozalaganman" deb o'tkazib yubora olmaydi.
 *
 * `AuditLog` bilan ARALASHTIRILMAYDI (ADR-008): u "kim nima qildi" auditi,
 * hash-zanjirli va formati muzlatilgan. Bu esa "agent qanday ishladi".
 */
@Injectable()
export class ExecutionEventBus {
  private readonly logger = new Logger(ExecutionEventBus.name);

  /** `runId` → jonli obunachilar (SSE mijozlari). */
  private readonly subscribers = new Map<string, Set<(event: ExecutionEventDto) => void>>();

  /**
   * `runId` → shu jarayonda yozilgan hodisa soni (bo'ron himoyasi).
   * Bu KESH, haqiqat emas: qayta ishga tushirilganda nolga qaytadi va
   * chegara faqat DB'dagi haqiqiy `seq` bilan birga ishlaydi.
   */
  private readonly emittedCount = new Map<string, number>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Hodisani yozadi va jonli obunachilarga tarqatadi.
   *
   * Yozuv XATOSI ijroni YIQITMAYDI (fail-open) — trace yo'qolgani yomon,
   * lekin foydalanuvchi ishini to'xtatgani battar. Xato `warn` bilan
   * qayd etiladi va `trace_event_loss` metrikasiga tushadi.
   */
  async emit(input: ExecutionEventInput): Promise<ExecutionEventDto | null> {
    this.assertEnvelope(input);

    if (this.isStormBlocked(input)) return null;

    // ⚠️ REDAKSIYA — birinchi va majburiy qadam.
    const payload = this.redactPayload(input.payload);

    try {
      const row = await this.insertWithSeq({ ...input, payload });
      this.emittedCount.set(input.runId, (this.emittedCount.get(input.runId) ?? 0) + 1);
      const dto = toDto(row);
      this.publish(dto);
      return dto;
    } catch (e: any) {
      // Fail-open: ijro davom etadi.
      this.logger.warn(`Hodisa yozilmadi (${input.type}, run=${input.runId}): ${e?.message}`);
      return null;
    }
  }

  /** Konvert to'liqmi — bo'sh `runId`/`tenantId` bilan hodisa yozilmaydi. */
  private assertEnvelope(input: ExecutionEventInput): void {
    for (const field of ['runId', 'agentId', 'tenantId'] as const) {
      if (!input[field]) {
        // Bu — dasturchi xatosi, ma'lumot xatosi emas: darhol ko'rinsin.
        throw new Error(`ExecutionEvent konverti to'liq emas: "${field}" majburiy`);
      }
    }
  }

  /**
   * Hodisa bo'roni (tool-loop bug'i) chegarasi. Yakuniy hodisalar
   * HECH QACHON bloklanmaydi — aks holda run "abadiy RUNNING" bo'lib qolardi.
   */
  private isStormBlocked(input: ExecutionEventInput): boolean {
    if (TERMINAL_EVENT_TYPES.includes(input.type)) return false;
    const count = this.emittedCount.get(input.runId) ?? 0;
    if (count < MAX_EVENTS_PER_RUN) return false;
    if (count === MAX_EVENTS_PER_RUN) {
      this.logger.warn(
        `Run ${input.runId} hodisa chegarasiga yetdi (${MAX_EVENTS_PER_RUN}) — ` +
          'faqat yakuniy hodisalar yoziladi',
      );
      this.emittedCount.set(input.runId, count + 1); // ogohlantirish bir marta
    }
    return true;
  }

  /**
   * Payloadni redaksiya qiladi va hajmini cheklaydi.
   *
   * Redaksiyaning O'ZI yiqilsa — payload BUTUNLAY tashlanadi (fail-closed).
   * Sababi: "tozalay olmadim" holatida xom payloadni yozish sirni bazaga
   * kiritish demak. Hodisaning o'zi baribir yoziladi (nima bo'lganini
   * bilamiz), faqat tafsilotisiz.
   */
  private redactPayload(raw: unknown): Prisma.InputJsonValue | undefined {
    if (raw === undefined || raw === null) return undefined;

    let scrubbed: unknown;
    try {
      scrubbed = scrubValue(raw);
    } catch (e: any) {
      this.logger.error(`Redaksiya yiqildi — payload tashlandi: ${e?.message}`);
      return { redaction_failed: true } as Prisma.InputJsonValue;
    }

    // BigInt JSON'ga tushmaydi — `JSON.stringify` throw qiladi.
    const json = JSON.stringify(scrubbed, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
    if (json === undefined) return undefined;

    if (json.length > MAX_PAYLOAD_CHARS) {
      return {
        truncated: true,
        originalChars: json.length,
        preview: json.slice(0, MAX_PAYLOAD_CHARS),
      } as Prisma.InputJsonValue;
    }
    return JSON.parse(json) as Prisma.InputJsonValue;
  }

  /**
   * `seq` ni ajratib yozadi.
   *
   * `@@unique([runId, seq])` poyga holatini USHLAYDI (ikki worker bir runga
   * yozsa) — to'qnashuvda keyingi `seq` bilan qayta uriniladi. Bu naqsh
   * `AuditLog.seq` dagi bilan bir xil mantiqda, lekin u yerda `autoincrement`
   * global, bu yerda esa `seq` HAR RUN ICHIDA boshlanadi (UI "3-qadam" deb
   * ko'rsatishi uchun global raqam yaroqsiz).
   */
  private async insertWithSeq(
    input: ExecutionEventInput & { payload?: Prisma.InputJsonValue },
    attempt = 0,
  ): Promise<Prisma.ExecutionEventGetPayload<object>> {
    const MAX_ATTEMPTS = 5;
    // @upstream-scope: bu YOZUV yo'lining ichki qadami — `runId` allaqachon
    // chaqiruvchi tomonidan tasdiqlangan (`/internal/*` — InternalTokenGuard
    // ortida; ichki ijro yo'llari esa run'ni o'zi yaratgan). So'rov faqat
    // keyingi `seq` ni topadi va hech qanday foydalanuvchi ma'lumotini
    // qaytarmaydi (`select: { seq }`).
    const last = await this.prisma.executionEvent.findFirst({
      where: { runId: input.runId },
      orderBy: { seq: 'desc' },
      select: { seq: true },
    });

    try {
      return await this.prisma.executionEvent.create({
        data: {
          runId: input.runId,
          stepId: input.stepId ?? null,
          seq: (last?.seq ?? 0) + 1,
          type: input.type,
          actor: input.actor,
          agentId: input.agentId,
          tenantId: input.tenantId,
          payload: input.payload,
          costTiyin: input.costTiyin ?? null,
          latencyMs: input.latencyMs ?? null,
        },
      });
    } catch (e: any) {
      const isSeqConflict =
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
      if (isSeqConflict && attempt < MAX_ATTEMPTS) {
        return this.insertWithSeq(input, attempt + 1);
      }
      throw e;
    }
  }

  // ---------------- jonli obuna (SSE ko'prigi) ----------------

  /** `runId` oqimiga obuna bo'ladi; qaytgan funksiya obunani bekor qiladi. */
  subscribe(runId: string, listener: (event: ExecutionEventDto) => void): () => void {
    const set = this.subscribers.get(runId) ?? new Set();
    set.add(listener);
    this.subscribers.set(runId, set);

    return () => {
      const current = this.subscribers.get(runId);
      if (!current) return;
      current.delete(listener);
      // Bo'sh to'plam qoldirilmaydi — aks holda Map uzoq ishlaydigan
      // jarayonda o'sib boradi (sekin sizish).
      if (current.size === 0) this.subscribers.delete(runId);
    };
  }

  /** Diagnostika: hozir nechta jonli mijoz bor. */
  subscriberCount(runId?: string): number {
    if (runId) return this.subscribers.get(runId)?.size ?? 0;
    let total = 0;
    for (const set of this.subscribers.values()) total += set.size;
    return total;
  }

  private publish(event: ExecutionEventDto): void {
    const listeners = this.subscribers.get(event.runId);
    if (!listeners) return;
    for (const listener of listeners) {
      try {
        listener(event);
      } catch (e: any) {
        // Bitta uzilgan mijoz qolganlarini to'xtatmaydi.
        this.logger.warn(`SSE obunachisi xato berdi: ${e?.message}`);
      }
    }
  }

  /** Run yopilganda hisoblagichni tozalaydi (xotira sizishining oldini oladi). */
  forgetRun(runId: string): void {
    this.emittedCount.delete(runId);
  }
}

/** Prisma qatorini JSON-xavfsiz DTO ga o'giradi (BigInt → string). */
export function toDto(row: Prisma.ExecutionEventGetPayload<object>): ExecutionEventDto {
  return {
    id: row.id,
    runId: row.runId,
    stepId: row.stepId,
    seq: row.seq,
    type: row.type as ExecutionEventType,
    actor: row.actor,
    agentId: row.agentId,
    payload: row.payload,
    costTiyin: row.costTiyin === null ? null : row.costTiyin.toString(),
    latencyMs: row.latencyMs,
    createdAt: row.createdAt.toISOString(),
  };
}
