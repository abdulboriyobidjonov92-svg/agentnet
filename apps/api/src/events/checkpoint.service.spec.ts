/**
 * P0-8 — checkpoint saqlagichi (API tomoni).
 *
 * Diqqat markazi: LangGraph SEMANTIKASI to'g'ri bajarilyaptimi —
 * "oxirgisini ber", "tarixni ber", "retry dublikat yaratmasin".
 */

import { CheckpointService } from './checkpoint.service';

function makeMockPrisma() {
  const checkpoints: any[] = [];
  const writes: any[] = [];

  const matches = (row: any, where: any) =>
    Object.entries(where).every(([k, v]) => {
      if (v && typeof v === 'object' && 'lt' in (v as any)) return row[k] < (v as any).lt;
      return row[k] === v;
    });

  return {
    _checkpoints: checkpoints,
    _writes: writes,
    agentCheckpoint: {
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const key = where.threadId_checkpointNs_checkpointId;
        const existing = checkpoints.find(
          (c) =>
            c.threadId === key.threadId &&
            c.checkpointNs === key.checkpointNs &&
            c.checkpointId === key.checkpointId,
        );
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const row = { ...create, createdAt: new Date(Date.now() + checkpoints.length) };
        checkpoints.push(row);
        return row;
      }),
      findFirst: jest.fn(async ({ where, orderBy }: any) => {
        const found = checkpoints.filter((c) => matches(c, where));
        found.sort((a, b) =>
          orderBy?.createdAt === 'desc'
            ? b.createdAt - a.createdAt
            : a.createdAt - b.createdAt,
        );
        return found[0] ?? null;
      }),
      findMany: jest.fn(async ({ where, take }: any) => {
        const found = checkpoints.filter((c) => matches(c, where));
        found.sort((a, b) => b.createdAt - a.createdAt);
        return found.slice(0, take);
      }),
      deleteMany: jest.fn(async ({ where }: any) => {
        const doomed = checkpoints.filter((c) => c.threadId === where.threadId);
        for (const d of doomed) checkpoints.splice(checkpoints.indexOf(d), 1);
        return { count: doomed.length };
      }),
    },
    agentCheckpointWrite: {
      upsert: jest.fn(async ({ create }: any) => {
        writes.push(create);
        return create;
      }),
      findMany: jest.fn(async ({ where }: any) =>
        writes
          .filter(
            (w) =>
              w.threadId === where.threadId &&
              w.checkpointNs === where.checkpointNs &&
              w.checkpointId === where.checkpointId,
          )
          .sort((a, b) => a.idx - b.idx),
      ),
      deleteMany: jest.fn(async ({ where }: any) => {
        const doomed = writes.filter((w) => w.threadId === where.threadId);
        for (const d of doomed) writes.splice(writes.indexOf(d), 1);
        return { count: doomed.length };
      }),
    },
    $transaction: jest.fn(async (ops: any) =>
      Array.isArray(ops) ? Promise.all(ops) : ops,
    ),
  };
}

const put = (svc: CheckpointService, id: string, parent?: string) =>
  svc.put({ threadId: 'run1', checkpointId: id, parentCheckpointId: parent, blob: `blob-${id}` });

describe('put — yozish va idempotentlik', () => {
  it('checkpoint yozadi', async () => {
    const prisma = makeMockPrisma();
    const svc = new CheckpointService(prisma as never);

    expect(await put(svc, 'cp-1')).toEqual({ checkpointId: 'cp-1' });
    expect(prisma._checkpoints).toHaveLength(1);
  });

  it('⚠️ bir xil checkpoint IKKI marta kelsa dublikat YARATMAYDI (retry xavfsiz)', async () => {
    const prisma = makeMockPrisma();
    const svc = new CheckpointService(prisma as never);

    await put(svc, 'cp-1');
    await put(svc, 'cp-1');

    expect(prisma._checkpoints).toHaveLength(1);
  });
});

describe('get — LangGraph semantikasi', () => {
  it('checkpointId berilmasa ENG OXIRGISINI qaytaradi (resume shu yo‘ldan)', async () => {
    const prisma = makeMockPrisma();
    const svc = new CheckpointService(prisma as never);
    await put(svc, 'cp-1');
    await put(svc, 'cp-2', 'cp-1');
    await put(svc, 'cp-3', 'cp-2');

    const out = await svc.get('run1');

    expect(out?.checkpointId).toBe('cp-3');
    expect(out?.parentCheckpointId).toBe('cp-2');
  });

  it('checkpointId berilsa AYNAN o‘shani qaytaradi', async () => {
    const prisma = makeMockPrisma();
    const svc = new CheckpointService(prisma as never);
    await put(svc, 'cp-1');
    await put(svc, 'cp-2', 'cp-1');

    expect((await svc.get('run1', '', 'cp-1'))?.checkpointId).toBe('cp-1');
  });

  it('yo‘q bo‘lsa null (throw QILMAYDI)', async () => {
    const svc = new CheckpointService(makeMockPrisma() as never);
    expect(await svc.get('yoq-bunday-run')).toBeNull();
  });

  it('yozuvlarni checkpoint bilan BIRGA qaytaradi', async () => {
    const prisma = makeMockPrisma();
    const svc = new CheckpointService(prisma as never);
    await put(svc, 'cp-1');
    await svc.putWrites({
      threadId: 'run1',
      checkpointId: 'cp-1',
      taskId: 't1',
      writes: [
        { idx: 0, channel: 'messages', blob: 'b0' },
        { idx: 1, channel: 'messages', blob: 'b1' },
      ],
    });

    const out = await svc.get('run1');

    expect(out?.writes.map((w) => w.idx)).toEqual([0, 1]);
    expect(out?.writes[0].channel).toBe('messages');
  });
});

describe('list — tarix', () => {
  it('eng yangisidan eskisiga qaytaradi', async () => {
    const prisma = makeMockPrisma();
    const svc = new CheckpointService(prisma as never);
    await put(svc, 'cp-1');
    await put(svc, 'cp-2');
    await put(svc, 'cp-3');

    const out = await svc.list('run1');

    expect(out.map((c) => c.checkpointId)).toEqual(['cp-3', 'cp-2', 'cp-1']);
  });

  it('limit 100 dan oshmaydi (DoS himoyasi)', async () => {
    const prisma = makeMockPrisma();
    const svc = new CheckpointService(prisma as never);
    await put(svc, 'cp-1');

    await svc.list('run1', { limit: 5000 });

    expect(prisma.agentCheckpoint.findMany.mock.calls[0][0].take).toBe(100);
  });

  it('`before` berilsa undan OLDINGILARINI qaytaradi', async () => {
    const prisma = makeMockPrisma();
    const svc = new CheckpointService(prisma as never);
    await put(svc, 'cp-1');
    await put(svc, 'cp-2');
    await put(svc, 'cp-3');

    const out = await svc.list('run1', { before: 'cp-2' });

    expect(out.map((c) => c.checkpointId)).toEqual(['cp-1']);
  });
});

describe('putWrites — tranzaksiyada', () => {
  it('barcha yozuv BITTA tranzaksiyada ketadi (yarim holat bo‘lmasin)', async () => {
    const prisma = makeMockPrisma();
    const svc = new CheckpointService(prisma as never);

    await svc.putWrites({
      threadId: 'run1',
      checkpointId: 'cp-1',
      taskId: 't1',
      writes: [
        { idx: 0, channel: 'a', blob: 'x' },
        { idx: 1, channel: 'b', blob: 'y' },
      ],
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma._writes).toHaveLength(2);
  });
});

describe('deleteForThread — run tugagach tozalash', () => {
  it('checkpoint va yozuvlarni birga o‘chiradi', async () => {
    const prisma = makeMockPrisma();
    const svc = new CheckpointService(prisma as never);
    await put(svc, 'cp-1');
    await svc.putWrites({
      threadId: 'run1',
      checkpointId: 'cp-1',
      taskId: 't1',
      writes: [{ idx: 0, channel: 'a', blob: 'x' }],
    });

    const out = await svc.deleteForThread('run1');

    expect(out).toEqual({ checkpoints: 1, writes: 1 });
    expect(prisma._checkpoints).toHaveLength(0);
    expect(prisma._writes).toHaveLength(0);
  });

  it('boshqa run TEGILMAYDI', async () => {
    const prisma = makeMockPrisma();
    const svc = new CheckpointService(prisma as never);
    await put(svc, 'cp-1');
    await svc.put({ threadId: 'run2', checkpointId: 'cp-1', blob: 'b' });

    await svc.deleteForThread('run1');

    expect(prisma._checkpoints.map((c: any) => c.threadId)).toEqual(['run2']);
  });
});
