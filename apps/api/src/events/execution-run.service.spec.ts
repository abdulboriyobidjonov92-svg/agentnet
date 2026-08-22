/**
 * P0-7 — ijro izini o'qish.
 *
 * Diqqat markazi: EGALIK. Trace ichida foydalanuvchining tool argumentlari
 * va natijalari yashaydi — begona `runId` bo'yicha o'qish eng qimmat
 * sizish yo'li bo'lardi. Har o'qish yo'li alohida tekshiriladi.
 */

import { NotFoundException } from '@nestjs/common';
import { EventActor, ExecutionEventType, RunStatus } from '@prisma/client';
import { ExecutionRunService } from './execution-run.service';
import type { User } from '@prisma/client';

const user = { id: 'u1' } as unknown as User;

function makeMockPrisma(
  runs: { id: string; userId: string; agentId: string }[] = [],
  events: { runId: string; seq: number }[] = [],
) {
  return {
    _events: events,
    executionRun: {
      findFirst: jest.fn(async ({ where }: { where: { id: string; userId: string } }) => {
        const r = runs.find((x) => x.id === where.id && x.userId === where.userId);
        return r
          ? {
              ...r,
              conversationId: null,
              status: RunStatus.COMPLETED,
              startedAt: new Date('2026-08-17T10:00:00Z'),
              endedAt: new Date('2026-08-17T10:01:00Z'),
              stepCount: 3,
              totalCostTiyin: 4200n,
            }
          : null;
      }),
      create: jest.fn(),
      update: jest.fn(),
    },
    executionEvent: {
      findMany: jest.fn(async ({ where }: { where: { runId: string; seq?: { gt: number } } }) =>
        events
          .filter((e) => e.runId === where.runId && (!where.seq || e.seq > where.seq.gt))
          .map((e) => ({
            id: `e${e.seq}`,
            runId: e.runId,
            stepId: null,
            seq: e.seq,
            type: ExecutionEventType.TOOL_RESULT,
            actor: EventActor.agent,
            agentId: 'a1',
            tenantId: 'u1',
            payload: { ok: true },
            costTiyin: 100n,
            latencyMs: 12,
            createdAt: new Date('2026-08-17T10:00:0' + e.seq + 'Z'),
          })),
      ),
    },
  };
}

const OWN_RUN = { id: 'run1', userId: 'u1', agentId: 'a1' };
const OTHER_RUN = { id: 'run9', userId: 'u2', agentId: 'a9' };

describe('findOne — egalik', () => {
  it('o‘z run‘ini hodisalari bilan qaytaradi', async () => {
    const prisma = makeMockPrisma([OWN_RUN], [{ runId: 'run1', seq: 1 }, { runId: 'run1', seq: 2 }]);
    const svc = new ExecutionRunService(prisma as never);

    const res = await svc.findOne(user, 'run1');

    expect(res.id).toBe('run1');
    expect(res.events.map((e) => e.seq)).toEqual([1, 2]);
  });

  it('⚠️ BEGONA run → 404 (403 EMAS — mavjudlik fakti ham ma’lumot)', async () => {
    const prisma = makeMockPrisma([OTHER_RUN]);
    const svc = new ExecutionRunService(prisma as never);

    await expect(svc.findOne(user, 'run9')).rejects.toBeInstanceOf(NotFoundException);
    // Hodisalar UMUMAN so'ralmaydi — egalik yiqilgach to'xtaydi.
    expect(prisma.executionEvent.findMany).not.toHaveBeenCalled();
  });

  it('mavjud bo‘lmagan run → 404', async () => {
    const svc = new ExecutionRunService(makeMockPrisma([]) as never);
    await expect(svc.findOne(user, 'yoq')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('BigInt maydonlar SATR sifatida chiqadi (JSON-xavfsiz)', async () => {
    const prisma = makeMockPrisma([OWN_RUN], [{ runId: 'run1', seq: 1 }]);
    const svc = new ExecutionRunService(prisma as never);

    const res = await svc.findOne(user, 'run1');

    expect(res.totalCostTiyin).toBe('4200');
    expect(res.events[0].costTiyin).toBe('100');
    expect(typeof res.events[0].createdAt).toBe('string');
  });
});

describe('eventsAfter — SSE teshigini to‘ldirish', () => {
  it('faqat berilgan seq dan KEYINGILARINI qaytaradi', async () => {
    const prisma = makeMockPrisma(
      [OWN_RUN],
      [
        { runId: 'run1', seq: 1 },
        { runId: 'run1', seq: 2 },
        { runId: 'run1', seq: 3 },
      ],
    );
    const svc = new ExecutionRunService(prisma as never);

    const res = await svc.eventsAfter(user, 'run1', 1);

    expect(res.map((e) => e.seq)).toEqual([2, 3]);
  });

  it('begona run → 404, hodisalar so‘ralmaydi', async () => {
    const prisma = makeMockPrisma([OTHER_RUN]);
    const svc = new ExecutionRunService(prisma as never);

    await expect(svc.eventsAfter(user, 'run9', 0)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.executionEvent.findMany).not.toHaveBeenCalled();
  });
});

describe('assertOwnsRun — SSE ochilishidagi darvoza', () => {
  it('o‘z run‘ida o‘tadi', async () => {
    const svc = new ExecutionRunService(makeMockPrisma([OWN_RUN]) as never);
    await expect(svc.assertOwnsRun(user, 'run1')).resolves.toBeUndefined();
  });

  it('begona run‘da 404 — oqim UMUMAN ochilmaydi', async () => {
    const svc = new ExecutionRunService(makeMockPrisma([OTHER_RUN]) as never);
    await expect(svc.assertOwnsRun(user, 'run9')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('so‘rov userId bilan scope qilinadi (tenant chegarasi)', async () => {
    const prisma = makeMockPrisma([OWN_RUN]);
    const svc = new ExecutionRunService(prisma as never);

    await svc.assertOwnsRun(user, 'run1');

    expect(prisma.executionRun.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'run1', userId: 'u1' } }),
    );
  });
});

describe('list — kursorli (Contract A18)', () => {
  it('userId bilan scope qilinadi va offset ISHLATMAYDI', async () => {
    const findMany = jest.fn(async (_args: Record<string, unknown>) => []);
    const svc = new ExecutionRunService({ executionRun: { findMany } } as never);

    await svc.list(user, { limit: 10 });

    const args = findMany.mock.calls[0][0];
    expect((args.where as Record<string, unknown>).userId).toBe('u1');
    expect(args.skip).toBeUndefined();
  });
});
