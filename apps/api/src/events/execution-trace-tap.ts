import { Logger } from '@nestjs/common';
import { PassThrough, type Readable } from 'node:stream';
import { EventActor, ExecutionEventType, RunStatus } from '@prisma/client';
import type { ExecutionEventBus } from './execution-event-bus.service';
import type { ExecutionRunService } from './execution-run.service';

/**
 * ENGINE OQIMI → KANONIK HODISALAR (UI-4 / P0-13 ulanishi).
 *
 * Engine o'z SSE lug'atida gapiradi (`token`, `tool_result`, `halal_block`,
 * `done`). Blueprint §2.3 esa YOPIQ kanonik ro'yxatni belgilaydi. Bu fayl —
 * yagona tarjima nuqtasi: engine lug'ati o'zgarsa, faqat shu jadval
 * yangilanadi va UI/trace/metering tegilmaydi.
 *
 * ⚠️ PUL YO'LIDA TURADI. Chat oqimi — foydalanuvchi allaqachon to'lagan
 * ijro. Shuning uchun bu qatlam **hech qachon** oqimni to'xtatmaydi va
 * hech qachon throw qilmaydi: baytlar o'zgarmasdan o'tadi, tarjima esa
 * "eng yaxshi harakat" (best-effort). `bus.emit()` o'zi ham fail-open.
 */

/** Engine hodisasi → kanonik tur. Ro'yxatda yo'q turlar e'tiborsiz qoladi. */
function mapEngineEvent(event: { type?: string; result?: unknown }): {
  type: ExecutionEventType;
  actor: EventActor;
} | null {
  switch (event.type) {
    case 'tool_result':
      // Engine bitta `tool_result` turini IKKI ma'noda ishlatadi:
      //   `{result: {tool, calling}}` — chaqiruv e'loni (hali natija yo'q)
      //   qolgan shakllar        — natijaning o'zi
      // Kanonik modelda bular alohida hodisalar (§2.3), shuning uchun
      // farq shu yerda ajratiladi.
      return isCallAnnouncement(event.result)
        ? { type: ExecutionEventType.TOOL_STARTED, actor: EventActor.agent }
        : { type: ExecutionEventType.TOOL_RESULT, actor: EventActor.agent };

    // Halal filtr — bu ALLAQACHON policy qarori (P0-6 dan oldin ham).
    // Uni `POLICY_CHECK` sifatida yozish trace'ni bir xil tilda saqlaydi.
    case 'halal_block':
    case 'halal_warning':
    case 'replace':
    case 'compliance_flag':
      return { type: ExecutionEventType.POLICY_CHECK, actor: EventActor.system };

    default:
      // `token` ATAYLAB yo'q: har token uchun hodisa yozish trace'ni
      // foydasiz shovqinga aylantirardi (bir javob = minglab token).
      return null;
  }
}

function isCallAnnouncement(result: unknown): boolean {
  return (
    typeof result === 'object' &&
    result !== null &&
    'calling' in (result as Record<string, unknown>)
  );
}

export interface TraceTapOptions {
  source: Readable;
  bus: ExecutionEventBus;
  runs: ExecutionRunService;
  runId: string;
  agentId: string;
  tenantId: string;
  conversationId?: string | null;
  /**
   * P0-5 — o'lchov. `undefined` bo'lsa metering o'tkazib yuboriladi
   * (mavjud testlar tap'ni metering'siz quradi va ular o'lchovni
   * tekshirmaydi — izning o'zi `metering.service.spec.ts` da).
   */
  metering?: { recordLlm(input: Record<string, unknown>): Promise<unknown> };
}

/**
 * Oqimni "eshitib turadi" va hodisalarni yozadi; baytlarni O'ZGARTIRMASDAN
 * o'tkazadi.
 *
 * Yakun: engine `done` yuborsa → `RUN_COMPLETED`; `error` yuborsa yoki
 * oqim `done`SIZ uzilsa → `RUN_FAILED`. Ya'ni "abadiy RUNNING" run
 * qolmaydi — bu P0-7 ning ro'yxat/filtr ustunlari uchun muhim.
 */
export function tapExecutionTrace(opts: TraceTapOptions): Readable {
  const { source, bus, runs, runId, agentId, tenantId, conversationId, metering } = opts;
  const logger = new Logger('ExecutionTraceTap');
  const out = new PassThrough();

  let buffer = '';
  let stepIndex = 0;
  let finished = false;
  let sawDone = false;
  let modelStarted = false;
  let modelCompleted = false;

  /**
   * Hodisa yuborishning YAGONA nuqtasi — va u HECH QACHON throw qilmaydi.
   *
   * ⚠️ NEGA `try/catch` SHU YERDA: `finish()` stream hodisa handlerlaridan
   * (`end`, `error`, `close`) chaqiriladi. U yerdan qochib ketgan xato Node'da
   * `uncaughtException` ga aylanadi va butun API jarayonini yiqitadi — ya'ni
   * KUZATUV QATLAMI xatosi xizmatni o'ldirardi. Himoyani `emit` ichiga
   * qo'yamiz, chaqiruv nuqtalariga tarqatmaymiz.
   */
  const emit = (
    type: ExecutionEventType,
    actor: EventActor,
    payload?: unknown,
    stepId?: string,
  ) => {
    try {
      // Fire-and-forget: `bus.emit` o'zi ham fail-open, bu yerda kutmaymiz.
      void bus
        .emit({ runId, agentId, tenantId, type, actor, payload, stepId: stepId ?? null })
        ?.catch?.((e: any) => logger.warn(`Hodisa yuborilmadi (${type}): ${e?.message}`));
    } catch (e: any) {
      logger.warn(`Hodisa yuborilmadi (${type}): ${e?.message}`);
    }
  };

  const finish = (status: Exclude<RunStatus, 'RUNNING'>) => {
    if (finished) return;
    finished = true;
    emit(
      status === RunStatus.COMPLETED
        ? ExecutionEventType.RUN_COMPLETED
        : ExecutionEventType.RUN_FAILED,
      EventActor.system,
      { stepCount: stepIndex },
    );
    // Ayni sabab (`emit` izohiga qarang): bu ham stream handlerlaridan
    // chaqiriladi, ya'ni throw qilishi mumkin bo'lmasligi kerak.
    try {
      void runs
        .finishRun(runId, status, { stepCount: stepIndex })
        ?.catch?.((e: any) => logger.warn(`Run yakunlanmadi (${runId}): ${e?.message}`));
      bus.forgetRun(runId);
    } catch (e: any) {
      logger.warn(`Run yakunlanmadi (${runId}): ${e?.message}`);
    }
  };

  const handleLine = (line: string) => {
    if (!line.startsWith('data:')) return;
    const raw = line.slice(5).trim();
    if (!raw) return;

    let event: { type?: string; result?: unknown; message?: string; reason?: string };
    try {
      event = JSON.parse(raw);
    } catch {
      return; // yaroqsiz JSON — trace uchun jim o'tkazamiz
    }

    if (event.type === 'done') {
      sawDone = true;
      if (modelStarted && !modelCompleted) emit(ExecutionEventType.MODEL_COMPLETED, EventActor.agent);
      finish(RunStatus.COMPLETED);
      return;
    }

    if (event.type === 'error') {
      emit(ExecutionEventType.RUN_FAILED, EventActor.system, { message: event.message });
      finish(RunStatus.FAILED);
      return;
    }

    // P0-5 — O'LCHOV. Engine oqim oxirida BITTA `usage` hodisasi yuboradi
    // (tool-loop aylanishlari allaqachon qo'shilgan). Uni shu yerda
    // ushlaymiz: tap yagona joy bo'lib, `runId`/`agentId`/`tenantId`
    // ni allaqachon biladi va oqimni baribir o'qib turibdi.
    //
    // ⚠️ Metering `MODEL_COMPLETED` dan OLDIN yoziladi, chunki engine
    // `usage` ni `done` dan oldin yuboradi.
    if (event.type === 'usage') {
      const u = event as unknown as {
        model?: string;
        input_tokens?: number;
        output_tokens?: number;
        cache_read_tokens?: number;
      };
      emit(ExecutionEventType.MODEL_COMPLETED, EventActor.agent, {
        model: u.model ?? null,
        // Token SONLARI redaksiyadan o'tadi, lekin `tokensIn/Out`
        // allowlist'da (redaction.ts) — ular diagnostikada kerak.
        tokensIn: u.input_tokens ?? 0,
        tokensOut: u.output_tokens ?? 0,
      });
      modelCompleted = true;

      try {
        void metering
          ?.recordLlm({
            // §2.2 idempotency: bir run uchun bitta LLM o'lchovi.
            idempotencyKey: `${runId}:llm`,
            userId: tenantId,
            agentId,
            runId,
            conversationId: conversationId ?? null,
            model: u.model ?? null,
            inputTokens: u.input_tokens ?? 0,
            outputTokens: u.output_tokens ?? 0,
            cacheReadTokens: u.cache_read_tokens ?? 0,
            toolCalls: stepIndex,
          })
          ?.catch?.((e: any) => logger.warn(`O'lchov yozilmadi: ${e?.message}`));
      } catch (e: any) {
        // Fail-open — o'lchov LLM javobini BUZMAYDI (ADR-023).
        logger.warn(`O'lchov yozilmadi: ${e?.message}`);
      }
      return;
    }

    if (event.type === 'token' && !modelStarted) {
      modelStarted = true;
      emit(ExecutionEventType.MODEL_STARTED, EventActor.agent);
      return;
    }

    const mapped = mapEngineEvent(event);
    if (!mapped) return;

    stepIndex += 1;
    emit(mapped.type, mapped.actor, event.result ?? { reason: event.reason }, `s${stepIndex}`);
  };

  source.on('data', (chunk: Buffer) => {
    out.write(chunk);
    try {
      buffer += chunk.toString('utf8');
      // SSE hodisalari `\n\n` bilan ajratiladi; qatorlarni alohida o'qiymiz.
      const parts = buffer.split('\n');
      buffer = parts.pop() ?? '';
      for (const line of parts) handleLine(line.trim());
    } catch (e: any) {
      // Tarjima xatosi — OQIM DAVOM ETADI (pul yo'li buzilmaydi).
      logger.warn(`Trace tarjimasi xato berdi: ${e?.message}`);
    }
  });

  source.on('end', () => {
    // `done`siz uzilish — yarim javob. Run FAILED bo'lib yopiladi.
    if (!sawDone) finish(RunStatus.FAILED);
    out.end();
  });

  source.on('error', (e: Error) => {
    finish(RunStatus.FAILED);
    out.destroy(e);
  });

  // Mijoz uzilsa (tab yopildi) — run "abadiy RUNNING" qolmasin.
  out.on('close', () => {
    if (!finished) finish(RunStatus.CANCELLED);
  });

  return out;
}
