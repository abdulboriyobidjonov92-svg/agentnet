/**
 * Engine oqimi → kanonik hodisalar tarjimasi (UI-4 / P0-13 ulanishi).
 *
 * Ikki xususiyat qulflanadi:
 *   1. TARJIMA to'g'ri (engine lug'ati → §2.3 yopiq ro'yxati)
 *   2. Oqim BUZILMAYDI — baytlar o'zgarmasdan o'tadi va tarjima xatosi
 *      chat'ni to'xtatmaydi (pul yo'li).
 */

import { PassThrough } from 'node:stream';
import { ExecutionEventType, RunStatus } from '@prisma/client';
import { tapExecutionTrace } from './execution-trace-tap';

function setup() {
  const emitted: { type: ExecutionEventType; payload?: unknown; stepId?: string | null }[] = [];
  const bus = {
    emit: jest.fn(async (e: any) => {
      emitted.push({ type: e.type, payload: e.payload, stepId: e.stepId });
      return null;
    }),
    forgetRun: jest.fn(),
  };
  const runs = { finishRun: jest.fn(async () => undefined) };
  const source = new PassThrough();
  const out = tapExecutionTrace({
    source,
    bus: bus as never,
    runs: runs as never,
    runId: 'run1',
    agentId: 'a1',
    tenantId: 'u1',
  });
  return { emitted, bus, runs, source, out };
}

const sse = (obj: unknown) => `data: ${JSON.stringify(obj)}\n\n`;

/** Oqim tugashini va mikrotasklarni kutadi. */
const settle = () => new Promise((r) => setImmediate(r));

function collect(out: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve) => {
    let text = '';
    out.on('data', (c: Buffer) => (text += c.toString()));
    out.on('end', () => resolve(text));
  });
}

describe('tarjima jadvali (engine → kanonik)', () => {
  it('`tool_result` + `calling` → TOOL_STARTED', async () => {
    const { emitted, source } = setup();
    source.write(sse({ type: 'tool_result', result: { tool: 'telegram', calling: { chat: 1 } } }));
    await settle();
    expect(emitted.map((e) => e.type)).toContain(ExecutionEventType.TOOL_STARTED);
  });

  it('`tool_result` natija bilan → TOOL_RESULT', async () => {
    const { emitted, source } = setup();
    source.write(sse({ type: 'tool_result', result: { tool: 'telegram', content: 'ok' } }));
    await settle();
    expect(emitted.map((e) => e.type)).toContain(ExecutionEventType.TOOL_RESULT);
  });

  it('halal filtr hodisalari → POLICY_CHECK (bu allaqachon policy qarori)', async () => {
    for (const type of ['halal_block', 'halal_warning', 'replace', 'compliance_flag']) {
      const { emitted, source } = setup();
      source.write(sse({ type, reason: 'sabab' }));
      await settle();
      expect(emitted.map((e) => e.type)).toContain(ExecutionEventType.POLICY_CHECK);
    }
  });

  it('birinchi `token` → MODEL_STARTED, keyingilari YO‘Q (shovqin bo‘lmasin)', async () => {
    const { emitted, source } = setup();
    source.write(sse({ type: 'token', content: 'a' }));
    source.write(sse({ type: 'token', content: 'b' }));
    source.write(sse({ type: 'token', content: 'c' }));
    await settle();
    expect(emitted.filter((e) => e.type === ExecutionEventType.MODEL_STARTED)).toHaveLength(1);
  });

  it('noma‘lum hodisa turi e‘tiborsiz qoladi', async () => {
    const { emitted, source } = setup();
    source.write(sse({ type: 'sessions', domains: ['a.com'] }));
    await settle();
    expect(emitted).toHaveLength(0);
  });

  it('qadamlar stepId bilan raqamlanadi (s1, s2, …)', async () => {
    const { emitted, source } = setup();
    source.write(sse({ type: 'tool_result', result: { tool: 't', calling: {} } }));
    source.write(sse({ type: 'tool_result', result: { tool: 't', content: 'ok' } }));
    await settle();
    expect(emitted.map((e) => e.stepId)).toEqual(['s1', 's2']);
  });
});

describe('run yakuni', () => {
  it('`done` → MODEL_COMPLETED + RUN_COMPLETED, finishRun(COMPLETED)', async () => {
    const { emitted, runs, source } = setup();
    source.write(sse({ type: 'token', content: 'a' }));
    source.write(sse({ type: 'done' }));
    await settle();

    expect(emitted.map((e) => e.type)).toEqual([
      ExecutionEventType.MODEL_STARTED,
      ExecutionEventType.MODEL_COMPLETED,
      ExecutionEventType.RUN_COMPLETED,
    ]);
    expect(runs.finishRun).toHaveBeenCalledWith('run1', RunStatus.COMPLETED, expect.any(Object));
  });

  it('`error` → RUN_FAILED', async () => {
    const { runs, source } = setup();
    source.write(sse({ type: 'error', message: 'engine yiqildi' }));
    await settle();
    expect(runs.finishRun).toHaveBeenCalledWith('run1', RunStatus.FAILED, expect.any(Object));
  });

  it('⚠️ `done`SIZ uzilish → RUN_FAILED (run abadiy RUNNING qolmaydi)', async () => {
    const { runs, source, out } = setup();
    const done = collect(out);
    source.write(sse({ type: 'token', content: 'yarim javob' }));
    source.end();
    await done;
    await settle();
    expect(runs.finishRun).toHaveBeenCalledWith('run1', RunStatus.FAILED, expect.any(Object));
  });

  it('yakun IKKI MARTA yozilmaydi', async () => {
    const { runs, source, out } = setup();
    const done = collect(out);
    source.write(sse({ type: 'done' }));
    source.end();
    await done;
    await settle();
    expect(runs.finishRun).toHaveBeenCalledTimes(1);
  });

  it('run yopilganda hisoblagich tozalanadi', async () => {
    const { bus, source } = setup();
    source.write(sse({ type: 'done' }));
    await settle();
    expect(bus.forgetRun).toHaveBeenCalledWith('run1');
  });
});

describe('⚠️ oqim buzilmaydi (pul yo‘li)', () => {
  it('baytlar O‘ZGARMASDAN o‘tadi', async () => {
    const { source, out } = setup();
    const done = collect(out);
    const payload = sse({ type: 'token', content: 'salom' }) + sse({ type: 'done' });
    source.write(payload);
    source.end();
    expect(await done).toBe(payload);
  });

  it('yaroqsiz JSON oqimni to‘xtatmaydi', async () => {
    const { source, out } = setup();
    const done = collect(out);
    source.write('data: {buzuq json\n\n');
    source.write(sse({ type: 'done' }));
    source.end();
    await expect(done).resolves.toContain('buzuq json');
  });

  it('`emit` throw qilsa ham oqim tugaydi', async () => {
    const emitted: unknown[] = [];
    const bus = {
      emit: jest.fn(() => {
        emitted.push(1);
        throw new Error('bus yiqildi');
      }),
      forgetRun: jest.fn(),
    };
    const source = new PassThrough();
    const out = tapExecutionTrace({
      source,
      bus: bus as never,
      runs: { finishRun: jest.fn(async () => undefined) } as never,
      runId: 'run1',
      agentId: 'a1',
      tenantId: 'u1',
    });
    const done = collect(out);

    source.write(sse({ type: 'token', content: 'x' }));
    source.write(sse({ type: 'done' }));
    source.end();

    await expect(done).resolves.toContain('done');
    expect(emitted.length).toBeGreaterThan(0);
  });
});
