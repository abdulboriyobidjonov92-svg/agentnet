/**
 * V3-P0 EXIT GATE **G0.4** — "Har agentda kill switch: 100% agentlar uchun
 * ishlaydi (E2E test bilan)" + SAFETY_POLICY_LAYER §4 talablari.
 *
 * §4 jadvalidagi har qator alohida test bilan qoplangan.
 */

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ExecutionEventType, RunStatus, UserRole } from '@prisma/client';
import { GLOBAL_KILL_PHRASE, KillSwitchService } from './kill-switch.service';
import type { User } from '@prisma/client';

const owner = { id: 'owner1', role: UserRole.OWNER } as unknown as User;
const admin = { id: 'admin1', role: UserRole.ADMIN } as unknown as User;
const member = { id: 'u1', role: UserRole.MEMBER } as unknown as User;
const stranger = { id: 'u2', role: UserRole.MEMBER } as unknown as User;

function setup(
  agents: { id: string; userId: string; killedAt?: Date | null; killReason?: string | null }[] = [
    { id: 'a1', userId: 'u1', killedAt: null, killReason: null },
  ],
  runs: { id: string; agentId: string; userId: string; status: RunStatus }[] = [],
) {
  const emitted: { type: ExecutionEventType; runId: string }[] = [];
  const prisma = {
    agent: {
      findFirst: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
        agents.find(
          (a) => a.id === where.id && (where.userId === undefined || a.userId === where.userId),
        ) ?? null,
      ),
      update: jest.fn(async ({ where, data }: any) => {
        const a = agents.find((x) => x.id === where.id)!;
        Object.assign(a, data);
        return a;
      }),
      updateMany: jest.fn(async ({ data }: any) => {
        const doomed = agents.filter((a) => !a.killedAt);
        for (const a of doomed) Object.assign(a, data);
        return { count: doomed.length };
      }),
    },
    executionRun: {
      findMany: jest.fn(async ({ where }: any) =>
        runs.filter((r) => r.agentId === where.agentId && r.status === where.status),
      ),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const doomed = runs.filter(
          (r) => r.status === RunStatus.RUNNING && (!where.agentId || r.agentId === where.agentId),
        );
        for (const r of doomed) Object.assign(r, data);
        return { count: doomed.length };
      }),
    },
  };
  const audit = { record: jest.fn(async () => undefined) };
  const bus = {
    emit: jest.fn(async (e: any) => {
      emitted.push({ type: e.type, runId: e.runId });
      return null;
    }),
  };
  const svc = new KillSwitchService(prisma as never, audit as never, bus as never);
  return { svc, prisma, audit, emitted, agents, runs };
}

describe('G0.4 — kill switch qamrovi va ta’siri', () => {
  it('egasi o‘z agentini to‘xtatadi', async () => {
    const { svc, agents } = setup();
    const res = await svc.kill(member, 'a1', 'noto‘g‘ri ish qildi');
    expect(res.killed).toBe(true);
    expect(agents[0].killedAt).toBeInstanceOf(Date);
  });

  it('⚠️ FAOL IJROLAR bekor qilinadi va trace’da IZ qoldiradi', async () => {
    const { svc, runs, emitted } = setup(
      [{ id: 'a1', userId: 'u1', killedAt: null }],
      [
        { id: 'r1', agentId: 'a1', userId: 'u1', status: RunStatus.RUNNING },
        { id: 'r2', agentId: 'a1', userId: 'u1', status: RunStatus.RUNNING },
        { id: 'r3', agentId: 'a1', userId: 'u1', status: RunStatus.COMPLETED },
      ],
    );

    const res = await svc.kill(member, 'a1');

    expect(res.cancelledRuns).toBe(2);
    expect(runs.filter((r) => r.status === RunStatus.CANCELLED)).toHaveLength(2);
    // Tugagan ijro TEGILMAYDI.
    expect(runs.find((r) => r.id === 'r3')!.status).toBe(RunStatus.COMPLETED);
    // Har bekor qilingan ijro uchun hodisa.
    expect(emitted.filter((e) => e.type === ExecutionEventType.RUN_CANCELLED)).toHaveLength(2);
  });

  it('OWNER/ADMIN har qanday agentni to‘xtatadi (§4 "Kimga")', async () => {
    for (const actor of [owner, admin]) {
      const { svc, agents } = setup([{ id: 'a1', userId: 'boshqa-odam', killedAt: null }]);
      await svc.kill(actor, 'a1');
      expect(agents[0].killedAt).toBeInstanceOf(Date);
    }
  });

  it('⚠️ BEGONA foydalanuvchi to‘xtata OLMAYDI → 404', async () => {
    const { svc, prisma } = setup([{ id: 'a1', userId: 'u1', killedAt: null }]);
    await expect(svc.kill(stranger, 'a1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.agent.update).not.toHaveBeenCalled();
  });

  it('idempotent — ikki marta bosish xato emas', async () => {
    const { svc } = setup([{ id: 'a1', userId: 'u1', killedAt: new Date() }]);
    const res = await svc.kill(member, 'a1');
    expect(res).toMatchObject({ killed: true, alreadyKilled: true, cancelledRuns: 0 });
  });

  it('audit yozuvi qoldiradi (§4 "Audit")', async () => {
    const { svc, audit } = setup();
    await svc.kill(member, 'a1', 'sabab');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'agent.kill', resourceId: 'a1' }),
    );
  });
});

describe('§4 — tiklash AVTOMATIK emas', () => {
  it('resume qo‘lda chaqirilganda tozalanadi', async () => {
    const { svc, agents } = setup([
      { id: 'a1', userId: 'u1', killedAt: new Date(), killReason: 'sabab' },
    ]);
    const res = await svc.resume(member, 'a1');
    expect(res.resumed).toBe(true);
    expect(agents[0].killedAt).toBeNull();
    expect(agents[0].killReason).toBeNull();
  });

  it('to‘xtatilmagan agentda resume no-op', async () => {
    const { svc } = setup();
    expect(await svc.resume(member, 'a1')).toMatchObject({ alreadyRunning: true });
  });

  it('begona agentni tiklab bo‘lmaydi → 404', async () => {
    const { svc } = setup([{ id: 'a1', userId: 'u1', killedAt: new Date() }]);
    await expect(svc.resume(stranger, 'a1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('GLOBAL kill — faqat OWNER + dual confirmation', () => {
  const valid = { confirm: GLOBAL_KILL_PHRASE, reason: 'Prompt injection hodisasi aniqlandi' };

  it('ADMIN chaqira OLMAYDI (faqat OWNER)', async () => {
    const { svc } = setup();
    await expect(svc.globalKill(admin, valid)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('⚠️ tasdiqlash iborasi noto‘g‘ri bo‘lsa ISHLAMAYDI', async () => {
    const { svc, prisma } = setup();
    await expect(
      svc.globalKill(owner, { confirm: 'ha', reason: valid.reason }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.agent.updateMany).not.toHaveBeenCalled();
  });

  it('⚠️ sabab 20 belgidan qisqa bo‘lsa ISHLAMAYDI (§6.5 ruhi)', async () => {
    const { svc, prisma } = setup();
    await expect(
      svc.globalKill(owner, { confirm: GLOBAL_KILL_PHRASE, reason: 'shunchaki' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.agent.updateMany).not.toHaveBeenCalled();
  });

  it('to‘g‘ri shartlar bilan BARCHA agentni to‘xtatadi', async () => {
    const { svc, agents, runs } = setup(
      [
        { id: 'a1', userId: 'u1', killedAt: null },
        { id: 'a2', userId: 'u2', killedAt: null },
        { id: 'a3', userId: 'u3', killedAt: new Date() }, // allaqachon to'xtatilgan
      ],
      [{ id: 'r1', agentId: 'a1', userId: 'u1', status: RunStatus.RUNNING }],
    );

    const res = await svc.globalKill(owner, valid);

    expect(res.agentsKilled).toBe(2); // uchinchisi allaqachon to'xtatilgan
    expect(res.runsCancelled).toBe(1);
    expect(agents.every((a) => a.killedAt)).toBe(true);
    expect(runs[0].status).toBe(RunStatus.CANCELLED);
  });

  it('global kill audit yozuvi qoldiradi', async () => {
    const { svc, audit } = setup();
    await svc.globalKill(owner, valid);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'platform.global_kill' }),
    );
  });
});
