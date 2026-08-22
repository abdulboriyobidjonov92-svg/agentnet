/**
 * P0-13 — ExecutionEventBus.
 *
 * Eng muhim testlar: REDAKSIYA chetlab o'tilmasligi va yozuv xatosi
 * ijroni yiqitmasligi. Qolganlari — konvert, `seq`, bo'ron chegarasi,
 * obuna tozalanishi.
 */

import { EventActor, ExecutionEventType, Prisma } from '@prisma/client';
import { ExecutionEventBus } from './execution-event-bus.service';
import { MAX_EVENTS_PER_RUN, MAX_PAYLOAD_CHARS } from './execution-event.types';

interface Row {
  id: string;
  runId: string;
  stepId: string | null;
  seq: number;
  type: ExecutionEventType;
  actor: EventActor;
  agentId: string;
  tenantId: string;
  payload: unknown;
  costTiyin: bigint | null;
  latencyMs: number | null;
  createdAt: Date;
}

function makeMockPrisma(opts: { failCreate?: boolean } = {}) {
  const rows: Row[] = [];
  return {
    _rows: rows,
    executionEvent: {
      findFirst: jest.fn(async ({ where }: { where: { runId: string } }) => {
        const forRun = rows.filter((r) => r.runId === where.runId);
        if (!forRun.length) return null;
        return forRun.reduce((a, b) => (a.seq > b.seq ? a : b));
      }),
      create: jest.fn(async ({ data }: { data: Partial<Row> }) => {
        if (opts.failCreate) throw new Error('DB down');
        const row = {
          id: `e${rows.length + 1}`,
          createdAt: new Date('2026-08-17T12:00:00Z'),
          stepId: null,
          payload: null,
          costTiyin: null,
          latencyMs: null,
          ...data,
        } as Row;
        rows.push(row);
        return row;
      }),
    },
  };
}

const base = {
  runId: 'run1',
  type: ExecutionEventType.TOOL_STARTED,
  actor: EventActor.agent,
  agentId: 'a1',
  tenantId: 'u1',
};

describe('emit — konvert validatsiyasi', () => {
  it.each(['runId', 'agentId', 'tenantId'] as const)('%s bo‘lmasa throw qiladi', async (field) => {
    const bus = new ExecutionEventBus(makeMockPrisma() as never);
    await expect(bus.emit({ ...base, [field]: '' })).rejects.toThrow(field);
  });

  it('to‘liq konvert bilan yoziladi', async () => {
    const prisma = makeMockPrisma();
    const bus = new ExecutionEventBus(prisma as never);
    const dto = await bus.emit(base);
    expect(dto).toMatchObject({ runId: 'run1', seq: 1, type: 'TOOL_STARTED', actor: 'agent' });
  });
});

describe('⚠️ REDAKSIYA — chetlab o‘tib bo‘lmaydi', () => {
  it('payloaddagi sir bazaga TUSHMAYDI', async () => {
    const prisma = makeMockPrisma();
    const bus = new ExecutionEventBus(prisma as never);

    await bus.emit({
      ...base,
      payload: {
        authorization: 'Bearer sk-ant-verysecrettokenvalue123456',
        note: 'sk-ant-anothersecret1234567890',
        nested: { password: 'hunter2' },
      },
    });

    const stored = JSON.stringify(prisma._rows[0].payload);
    expect(stored).not.toContain('verysecrettoken');
    expect(stored).not.toContain('hunter2');
    expect(stored).not.toContain('sk-ant-anothersecret');
    expect(stored).toContain('[REDACTED]');
  });

  it('token SONI (tokensIn) redaksiya qilinmaydi — diagnostika buzilmasin', async () => {
    const prisma = makeMockPrisma();
    const bus = new ExecutionEventBus(prisma as never);
    await bus.emit({ ...base, payload: { tokensIn: 1200, tokensOut: 340 } });
    expect(prisma._rows[0].payload).toMatchObject({ tokensIn: 1200, tokensOut: 340 });
  });

  it('juda katta payload KESILADI (rad etilmaydi)', async () => {
    const prisma = makeMockPrisma();
    const bus = new ExecutionEventBus(prisma as never);
    await bus.emit({ ...base, payload: { blob: 'x'.repeat(MAX_PAYLOAD_CHARS + 5_000) } });
    const stored = prisma._rows[0].payload as { truncated?: boolean; originalChars?: number };
    expect(stored.truncated).toBe(true);
    expect(stored.originalChars).toBeGreaterThan(MAX_PAYLOAD_CHARS);
  });

  it('BigInt payloadda yiqilmaydi (JSON.stringify throw qilardi)', async () => {
    const prisma = makeMockPrisma();
    const bus = new ExecutionEventBus(prisma as never);
    await expect(bus.emit({ ...base, payload: { amount: 12345n } })).resolves.not.toBeNull();
    expect(prisma._rows[0].payload).toMatchObject({ amount: '12345' });
  });
});

describe('seq — run ichida monotonik', () => {
  it('ketma-ket o‘sadi', async () => {
    const prisma = makeMockPrisma();
    const bus = new ExecutionEventBus(prisma as never);
    for (let i = 0; i < 3; i++) await bus.emit(base);
    expect(prisma._rows.map((r) => r.seq)).toEqual([1, 2, 3]);
  });

  it('har run O‘Z hisobidan boshlanadi (global emas)', async () => {
    const prisma = makeMockPrisma();
    const bus = new ExecutionEventBus(prisma as never);
    await bus.emit(base);
    await bus.emit({ ...base, runId: 'run2' });
    expect(prisma._rows.find((r) => r.runId === 'run2')?.seq).toBe(1);
  });

  it('seq to‘qnashuvida (P2002) qayta uriniladi', async () => {
    const prisma = makeMockPrisma();
    let firstCall = true;
    const original = prisma.executionEvent.create;
    prisma.executionEvent.create = jest.fn(async (args: any) => {
      if (firstCall) {
        firstCall = false;
        throw new Prisma.PrismaClientKnownRequestError('unique', {
          code: 'P2002',
          clientVersion: 'test',
        });
      }
      return original(args);
    }) as never;

    const bus = new ExecutionEventBus(prisma as never);
    const dto = await bus.emit(base);

    expect(dto).not.toBeNull();
    expect(prisma.executionEvent.create).toHaveBeenCalledTimes(2);
  });
});

describe('⚠️ yozuv xatosi ijroni YIQITMAYDI (fail-open)', () => {
  it('DB yiqilsa null qaytaradi, throw qilmaydi', async () => {
    const bus = new ExecutionEventBus(makeMockPrisma({ failCreate: true }) as never);
    await expect(bus.emit(base)).resolves.toBeNull();
  });
});

describe('hodisa bo‘roni chegarasi', () => {
  it(`${MAX_EVENTS_PER_RUN} dan keyin oddiy hodisalar yozilmaydi`, async () => {
    const prisma = makeMockPrisma();
    const bus = new ExecutionEventBus(prisma as never);
    // Hisoblagichni to'g'ridan-to'g'ri to'ldiramiz (1000 marta yozish sekin).
    (bus as unknown as { emittedCount: Map<string, number> }).emittedCount.set(
      'run1',
      MAX_EVENTS_PER_RUN,
    );

    expect(await bus.emit(base)).toBeNull();
    expect(prisma.executionEvent.create).not.toHaveBeenCalled();
  });

  it('YAKUNIY hodisa chegaradan keyin ham yoziladi (run abadiy RUNNING qolmasin)', async () => {
    const prisma = makeMockPrisma();
    const bus = new ExecutionEventBus(prisma as never);
    (bus as unknown as { emittedCount: Map<string, number> }).emittedCount.set(
      'run1',
      MAX_EVENTS_PER_RUN + 50,
    );

    const dto = await bus.emit({ ...base, type: ExecutionEventType.RUN_FAILED });
    expect(dto).not.toBeNull();
  });
});

describe('obuna (SSE ko‘prigi)', () => {
  it('obunachi hodisani oladi', async () => {
    const bus = new ExecutionEventBus(makeMockPrisma() as never);
    const seen: unknown[] = [];
    bus.subscribe('run1', (e) => seen.push(e));

    await bus.emit(base);

    expect(seen).toHaveLength(1);
  });

  it('boshqa run obunachisiga TUSHMAYDI', async () => {
    const bus = new ExecutionEventBus(makeMockPrisma() as never);
    const seen: unknown[] = [];
    bus.subscribe('run2', (e) => seen.push(e));
    await bus.emit(base);
    expect(seen).toHaveLength(0);
  });

  it('obuna bekor qilinganda Map TOZALANADI (xotira sizishi yo‘q)', async () => {
    const bus = new ExecutionEventBus(makeMockPrisma() as never);
    const off = bus.subscribe('run1', () => undefined);
    expect(bus.subscriberCount('run1')).toBe(1);
    off();
    expect(bus.subscriberCount('run1')).toBe(0);
    expect(bus.subscriberCount()).toBe(0);
  });

  it('bitta obunachining xatosi qolganlarini to‘xtatmaydi', async () => {
    const bus = new ExecutionEventBus(makeMockPrisma() as never);
    const seen: unknown[] = [];
    bus.subscribe('run1', () => {
      throw new Error('mijoz uzildi');
    });
    bus.subscribe('run1', (e) => seen.push(e));

    await expect(bus.emit(base)).resolves.not.toBeNull();
    expect(seen).toHaveLength(1);
  });
});
