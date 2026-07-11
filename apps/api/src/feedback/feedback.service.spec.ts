import { FeedbackService } from './feedback.service';
import type { User } from '@prisma/client';

function makeMockPrisma() {
  const rows: any[] = [];
  return {
    _rows: rows,
    feedback: {
      create: jest.fn(async ({ data, select }: any) => {
        const row = { id: `f${rows.length + 1}`, createdAt: new Date(), status: 'new', ...data };
        rows.push(row);
        return select ? { id: row.id, createdAt: row.createdAt } : row;
      }),
      findMany: jest.fn(async ({ take }: any) => rows.slice(0, take)),
      findUnique: jest.fn(async ({ where }: any) => rows.find((r) => r.id === where.id) ?? null),
      update: jest.fn(async ({ where, data, select }: any) => {
        const row = rows.find((r) => r.id === where.id);
        Object.assign(row, data);
        return select ? { id: row.id, status: row.status } : row;
      }),
    },
  };
}

const user = { id: 'u1' } as unknown as User;

describe('FeedbackService', () => {
  it('submit — noma’lum kind "suggestion"ga tushadi va matn kesiladi', async () => {
    const prisma = makeMockPrisma();
    const svc = new FeedbackService(prisma as any);
    const long = 'a'.repeat(3000);
    const res = await svc.submit(user, { kind: 'hacker', message: long, page: '/x' });
    expect(res.received).toBe(true);
    expect(prisma._rows[0].kind).toBe('suggestion');
    expect(prisma._rows[0].message.length).toBe(2000);
    expect(prisma._rows[0].userId).toBe('u1');
  });

  it('submit — to‘g‘ri kind saqlanadi', async () => {
    const prisma = makeMockPrisma();
    const svc = new FeedbackService(prisma as any);
    await svc.submit(user, { kind: 'bug', message: 'ishlamayapti' });
    expect(prisma._rows[0].kind).toBe('bug');
  });

  it('setStatus — yaroqsiz status "seen"ga tushadi', async () => {
    const prisma = makeMockPrisma();
    const svc = new FeedbackService(prisma as any);
    await svc.submit(user, { kind: 'question', message: 'savol?' });
    const res = await svc.setStatus('f1', 'garbage');
    expect(res.status).toBe('seen');
  });

  it('setStatus — yaroqli status saqlanadi', async () => {
    const prisma = makeMockPrisma();
    const svc = new FeedbackService(prisma as any);
    await svc.submit(user, { kind: 'question', message: 'savol?' });
    const res = await svc.setStatus('f1', 'resolved');
    expect(res.status).toBe('resolved');
  });

  it('setStatus — mavjud emas id -> 404 (500 emas)', async () => {
    const prisma = makeMockPrisma();
    const svc = new FeedbackService(prisma as any);
    await expect(svc.setStatus('yoq-id', 'seen')).rejects.toMatchObject({ status: 404 });
    expect(prisma.feedback.update).not.toHaveBeenCalled();
  });
});
