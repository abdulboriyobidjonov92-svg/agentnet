import { EventActor, ExecutionEventType } from '@prisma/client';

/**
 * V3-P0 · P0-13 — KANONIK hodisa konverti.
 *
 * Manba: `docs/blueprints/P0_BLUEPRINT.md` §2.3.
 *
 * Bu tip UI, trace, admin va metering uchun YAGONA shartnoma. Ikkinchi
 * hodisa modeli yozilmaydi — yangi iste'molchi shu yerdan o'qiydi.
 */
export interface ExecutionEventInput {
  runId: string;
  /** Run-ichi qadam. `RUN_*` hodisalarida bo'lmaydi. */
  stepId?: string | null;
  type: ExecutionEventType;
  actor: EventActor;
  agentId: string;
  /** Bugungi tenant modelida = `userId`. */
  tenantId: string;
  /**
   * XOM payload. `emit()` uni MAJBURIY redaksiyadan o'tkazadi — chaqiruvchi
   * o'zi tozalashi SHART EMAS va tozalagan bo'lsa ham qayta o'tadi
   * (ikki marta redaksiya zararsiz, bir marta ham o'tkazmaslik esa sirni
   * bazaga yozadi).
   */
  payload?: unknown;
  /** Konstitutsiya #20: pul — BigInt tiyin. */
  costTiyin?: bigint | null;
  latencyMs?: number | null;
}

/** SSE va o'qish API'si qaytaradigan shakl (BigInt → string, JSON-xavfsiz). */
export interface ExecutionEventDto {
  id: string;
  runId: string;
  stepId: string | null;
  seq: number;
  type: ExecutionEventType;
  actor: EventActor;
  agentId: string;
  payload: unknown;
  costTiyin: string | null;
  latencyMs: number | null;
  createdAt: string;
}

/**
 * Bitta run ichidagi maksimal hodisa soni.
 *
 * NEGA KERAK: tool-loop bug'i (agent o'zini cheksiz chaqiradi) bazani
 * to'ldirib qo'yishi mumkin. Chegaraga yetganda faqat YAKUNIY (`RUN_*`)
 * hodisalar o'tkaziladi — ya'ni run toza yopiladi, lekin shovqin to'xtaydi.
 * `[CALIBRATE]` — real ijro uzunligi o'lchangach qayta ko'riladi.
 */
export const MAX_EVENTS_PER_RUN = 1000;

/** Yakuniy hodisalar — hodisa chegarasi ularni HECH QACHON bloklamaydi. */
export const TERMINAL_EVENT_TYPES: readonly ExecutionEventType[] = [
  ExecutionEventType.RUN_COMPLETED,
  ExecutionEventType.RUN_FAILED,
  ExecutionEventType.RUN_CANCELLED,
];

/** `payload` uchun maksimal hajm (JSON belgilarida) — kesiladi, rad etilmaydi. */
export const MAX_PAYLOAD_CHARS = 64_000;
