import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { GoalsService } from './goals.service';
import type { User } from '@prisma/client';

/**
 * GoalsService — engine dekompozitsiyasi (halal-block vs engine-down),
 * ownership guard'i, va `advance` progress/status hisob-kitobi.
 */

function makeMock() {
  const prisma: any = {
    goal: {
      create: jest.fn(async (a: any) => ({ id: 'g1', userId: a.data.userId, status: 'active', progress: 0, ...a.data })),
      findUnique: jest.fn(),
      findMany: jest.fn(async () => []),
      delete: jest.fn(),
      update: jest.fn(async (a: any) => a),
    },
    goalTask: {
      create: jest.fn(async (a: any) => ({ id: `t${Math.random()}`, status: 'pending', ...a.data })),
      update: jest.fn(async (a: any) => a),
      findMany: jest.fn(async () => []),
    },
  };
  const http = { post: jest.fn() } as any;
  const audit = { record: jest.fn(async () => {}) } as any;
  const twin = { factsForEngine: jest.fn(async () => []) } as any;
  return { prisma, http, audit, twin };
}

const user = { id: 'u1', preferredLanguage: 'uz', professionTitle: 'Do\'kon egasi' } as unknown as User;

describe('GoalsService.create', () => {
  it('engine dekompozitsiyasidan Goal + GoalTask\'lar yaratadi (tekis order bilan)', async () => {
    const { prisma, http, audit, twin } = makeMock();
    http.post.mockReturnValue(
      of({
        data: {
          title: 'Savdoni oshirish',
          method: 'llm',
          reasoning: 'chunki...',
          milestones: [
            { title: 'Bosqich 1', tasks: [{ title: 'Vazifa A', agent_role: 'retail', cadence: 'weekly' }, { title: 'Vazifa B' }] },
            { title: 'Bosqich 2', tasks: [{ title: 'Vazifa C' }] },
          ],
        },
      }),
    );
    prisma.goal.findUnique.mockResolvedValue({ id: 'g1', userId: 'u1', status: 'active', tasks: [] });
    const svc = new GoalsService(prisma, http, audit, twin);

    await svc.create(user, 'Savdoni oshirish');

    expect(prisma.goal.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'u1', title: 'Savdoni oshirish' }) }),
    );
    expect(prisma.goalTask.create).toHaveBeenCalledTimes(3);
    const orders = prisma.goalTask.create.mock.calls.map((c: any) => c[0].data.order);
    expect(orders).toEqual([0, 1, 2]); // milestonelar orasida ham ketma-ket
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'goal.create', metadata: expect.objectContaining({ tasks: 3 }) }));
  });

  it("engine 422 halal-block bersa -> UnprocessableEntityException, DB'ga yozilmaydi", async () => {
    const { prisma, http, audit, twin } = makeMock();
    http.post.mockReturnValue(
      throwError(() => ({ response: { status: 422, data: { detail: { blocked: true, reason: 'gambling' } } } })),
    );
    const svc = new GoalsService(prisma, http, audit, twin);

    await expect(svc.create(user, 'kazino ochish')).rejects.toMatchObject({ status: 422 });
    expect(prisma.goal.create).not.toHaveBeenCalled();
  });

  it('engine mavjud bo\'lmasa -> BadGatewayException (502)', async () => {
    const { prisma, http, audit, twin } = makeMock();
    http.post.mockReturnValue(throwError(() => ({ message: 'ECONNREFUSED' })));
    const svc = new GoalsService(prisma, http, audit, twin);

    await expect(svc.create(user, 'maqsad')).rejects.toMatchObject({ status: 502 });
  });
});

describe('GoalsService.findOne — egalik tekshiruvi', () => {
  it('boshqa foydalanuvchining maqsadi -> ForbiddenException', async () => {
    const { prisma, http, audit, twin } = makeMock();
    prisma.goal.findUnique.mockResolvedValue({ id: 'g1', userId: 'boshqa-user', tasks: [] });
    const svc = new GoalsService(prisma, http, audit, twin);

    await expect(svc.findOne('g1', user)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('mavjud bo\'lmagan maqsad -> NotFoundException', async () => {
    const { prisma, http, audit, twin } = makeMock();
    prisma.goal.findUnique.mockResolvedValue(null);
    const svc = new GoalsService(prisma, http, audit, twin);

    await expect(svc.findOne('yoq', user)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('GoalsService.advance', () => {
  it('faol bo\'lmagan maqsadni oldinga surmaydi (advanced: 0)', async () => {
    const { prisma, http, audit, twin } = makeMock();
    prisma.goal.findUnique.mockResolvedValue({ id: 'g1', userId: 'u1', status: 'completed', tasks: [] });
    const svc = new GoalsService(prisma, http, audit, twin);

    const res = await svc.advance('g1', user);
    expect(res.advanced).toBe(0);
    expect(http.post).not.toHaveBeenCalled();
  });

  it('pending vazifalarni bajaradi, progressni hisoblaydi va 100% da completed qiladi', async () => {
    const { prisma, http, audit, twin } = makeMock();
    const tasks = [
      { id: 't1', status: 'pending', title: 'A', description: null, agentRole: null },
      { id: 't2', status: 'done', title: 'B' },
    ];
    prisma.goal.findUnique.mockResolvedValue({ id: 'g1', userId: 'u1', status: 'active', title: 'Maqsad', tasks });
    prisma.goalTask.findMany.mockResolvedValue([{ status: 'done' }, { status: 'done' }]);
    http.post.mockReturnValue(of({ data: { result: 'bajarildi' } }));
    const svc = new GoalsService(prisma, http, audit, twin);

    const res = await svc.advance('g1', user);

    expect(res.advanced).toBe(1);
    expect(prisma.goalTask.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 't1' }, data: expect.objectContaining({ status: 'done', result: 'bajarildi' }) }),
    );
    expect(prisma.goal.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ progress: 100, status: 'completed' }) }),
    );
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'goal.advance' }));
  });

  it("bitta vazifa muvaffaqiyatsiz bo'lsa ham davom etadi (boshqalarga xalaqit bermaydi)", async () => {
    const { prisma, http, audit, twin } = makeMock();
    const tasks = [
      { id: 't1', status: 'pending', title: 'A' },
      { id: 't2', status: 'pending', title: 'B' },
    ];
    prisma.goal.findUnique.mockResolvedValue({ id: 'g1', userId: 'u1', status: 'active', title: 'Maqsad', tasks });
    prisma.goalTask.findMany.mockResolvedValue([{ status: 'pending' }, { status: 'done' }]);
    http.post
      .mockReturnValueOnce(throwError(() => new Error('engine timeout')))
      .mockReturnValueOnce(of({ data: { result: 'ok' } }));
    const svc = new GoalsService(prisma, http, audit, twin);

    const res = await svc.advance('g1', user);
    expect(res.advanced).toBe(1); // faqat 2-vazifa muvaffaqiyatli
    expect(prisma.goalTask.update).toHaveBeenCalledTimes(1);
  });
});

describe('GoalsService.advanceAllActive (cron)', () => {
  it("faol maqsadlarni yuritadi va bittasi xato bersa ham qolganini to'xtatmaydi", async () => {
    const { prisma, http, audit, twin } = makeMock();
    prisma.goal.findMany.mockResolvedValue([
      { id: 'g1', status: 'active', user: { id: 'u1' } },
      { id: 'g2', status: 'active', user: { id: 'u2' } },
    ]);
    const svc = new GoalsService(prisma, http, audit, twin);
    const advanceSpy = jest
      .spyOn(svc, 'advance')
      .mockRejectedValueOnce(new Error('g1 muvaffaqiyatsiz'))
      .mockResolvedValueOnce({ advanced: 1, goal: {} as any });

    await expect(svc.advanceAllActive()).resolves.toBeUndefined();
    expect(advanceSpy).toHaveBeenCalledTimes(2);
    expect(advanceSpy).toHaveBeenNthCalledWith(1, 'g1', { id: 'u1' }, 2);
    expect(advanceSpy).toHaveBeenNthCalledWith(2, 'g2', { id: 'u2' }, 2);
  });
});
