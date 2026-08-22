/**
 * Konnektor ↔ agent biriktirmasi (UI-3 backend qismi).
 *
 * Diqqat markazi — `remove()` ning QAMROVI. Ilgari u
 * `deleteMany({ userId, connectorId })` edi: umumiy yozuvni o'chirish
 * BARCHA agentga-xos sozlamalarni ham jimgina o'chirib yuborardi. Bu
 * fayldagi birinchi ikki test aynan o'sha regressiyani ushlab turadi.
 */

import { NotFoundException } from '@nestjs/common';
import { ConnectorsService } from './connectors.service';
import type { User } from '@prisma/client';

interface ConfigRow {
  id: string;
  userId: string;
  connectorId: string;
  label: string;
  agentId: string | null;
  status: string;
  lastUsedAt: Date | null;
  lastError: string | null;
  config: string;
}

function makeMockPrisma(rows: ConfigRow[] = [], agents: { id: string; name: string; userId: string }[] = []) {
  const matches = (r: ConfigRow, where: Record<string, unknown>) =>
    Object.entries(where).every(([k, v]) => {
      if (k === 'agentId') return r.agentId === v;
      return (r as unknown as Record<string, unknown>)[k] === v;
    });

  return {
    _rows: rows,
    connectorConfig: {
      findMany: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
        rows.filter((r) => r.userId === where.userId),
      ),
      deleteMany: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
        const doomed = rows.filter((r) => matches(r, where));
        for (const r of doomed) rows.splice(rows.indexOf(r), 1);
        return { count: doomed.length };
      }),
      upsert: jest.fn(),
    },
    agent: {
      findFirst: jest.fn(async ({ where }: { where: { id: string; userId: string } }) =>
        agents.find((a) => a.id === where.id && a.userId === where.userId) ?? null,
      ),
      findMany: jest.fn(async ({ where }: { where: { id: { in: string[] }; userId: string } }) =>
        agents.filter((a) => where.id.in.includes(a.id) && a.userId === where.userId),
      ),
    },
  };
}

const audit = () => ({ record: jest.fn(async () => undefined) });
const crypto = () => ({ encryptJson: jest.fn((v: unknown) => JSON.stringify(v)), decryptJson: jest.fn() });

const user = { id: 'u1' } as unknown as User;

function row(over: Partial<ConfigRow>): ConfigRow {
  return {
    id: `c${Math.random().toString(36).slice(2, 7)}`,
    userId: 'u1',
    connectorId: 'telegram-bot',
    label: 'default',
    agentId: null,
    status: 'connected',
    lastUsedAt: null,
    lastError: null,
    config: '{}',
    ...over,
  };
}

describe('remove — qamrov (UI-3 tuzatishi)', () => {
  it('⚠️ REGRESSIYA: umumiy yozuvni uzish agentga-xos sozlamalarga TEGMAYDI', async () => {
    const rows = [
      row({ agentId: null, label: 'default' }),
      row({ agentId: 'a1', label: 'agent:a1' }),
      row({ agentId: 'a2', label: 'agent:a2' }),
    ];
    const prisma = makeMockPrisma(rows);
    const svc = new ConnectorsService(prisma as never, audit() as never, crypto() as never);

    const res = await svc.remove(user, 'telegram-bot');

    expect(res).toMatchObject({ removed: true, count: 1, agentId: null });
    // Ikkala agent sozlamasi TIRIK qoldi — ilgari ular ham o'chib ketardi.
    expect(rows.map((r) => r.agentId).sort()).toEqual(['a1', 'a2']);
  });

  it('agentni uzish faqat O‘SHA agentnikini o‘chiradi', async () => {
    const rows = [
      row({ agentId: null }),
      row({ agentId: 'a1', label: 'agent:a1' }),
      row({ agentId: 'a2', label: 'agent:a2' }),
    ];
    const prisma = makeMockPrisma(rows, [{ id: 'a1', name: 'Do‘kon', userId: 'u1' }]);
    const svc = new ConnectorsService(prisma as never, audit() as never, crypto() as never);

    const res = await svc.remove(user, 'telegram-bot', 'a1');

    expect(res).toMatchObject({ removed: true, count: 1, agentId: 'a1' });
    expect(rows.map((r) => r.agentId).sort()).toEqual(['a2', null]);
  });

  it('begona agentni uzib bo‘lmaydi (IDOR)', async () => {
    const prisma = makeMockPrisma([], []); // `a9` boshqa foydalanuvchiniki
    const svc = new ConnectorsService(prisma as never, audit() as never, crypto() as never);

    await expect(svc.remove(user, 'telegram-bot', 'a9')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.connectorConfig.deleteMany).not.toHaveBeenCalled();
  });

  it('o‘chiradigan narsa bo‘lmasa removed=false (jim muvaffaqiyat emas)', async () => {
    const prisma = makeMockPrisma([]);
    const svc = new ConnectorsService(prisma as never, audit() as never, crypto() as never);

    expect(await svc.remove(user, 'telegram-bot')).toMatchObject({ removed: false, count: 0 });
  });

  it('audit yozuvi qoldiradi (ilgari bu yo‘lda audit UMUMAN yo‘q edi)', async () => {
    const a = audit();
    const prisma = makeMockPrisma([row({ agentId: null })]);
    const svc = new ConnectorsService(prisma as never, a as never, crypto() as never);

    await svc.remove(user, 'telegram-bot');

    expect(a.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'u1',
        action: 'connector.remove',
        metadata: expect.objectContaining({ connectorId: 'telegram-bot', agentId: null, removed: 1 }),
      }),
    );
  });
});

describe('catalog — biriktirilgan agentlar', () => {
  it('agent NOMLARI bilan qaytaradi (UI klient-tomon JOIN qilmaydi)', async () => {
    const prisma = makeMockPrisma(
      [row({ agentId: 'a1', label: 'agent:a1' }), row({ agentId: 'a2', label: 'agent:a2' })],
      [
        { id: 'a1', name: 'Do‘kon hisobotchisi', userId: 'u1' },
        { id: 'a2', name: 'Buyurtma xabarnomasi', userId: 'u1' },
      ],
    );
    const svc = new ConnectorsService(prisma as never, audit() as never, crypto() as never);

    const catalog = await svc.catalog(user);
    const telegram = catalog.find((c) => c.id === 'telegram-bot');

    expect(telegram?.attachedAgents).toEqual([
      { id: 'a1', name: 'Do‘kon hisobotchisi' },
      { id: 'a2', name: 'Buyurtma xabarnomasi' },
    ]);
  });

  it('nomi topilmasa id ga tushadi (agent o‘chirilgan holat) — yiqilmaydi', async () => {
    const prisma = makeMockPrisma([row({ agentId: 'gone', label: 'agent:gone' })], []);
    const svc = new ConnectorsService(prisma as never, audit() as never, crypto() as never);

    const telegram = (await svc.catalog(user)).find((c) => c.id === 'telegram-bot');
    expect(telegram?.attachedAgents).toEqual([{ id: 'gone', name: 'gone' }]);
  });

  it('agent nomlari FAQAT o‘z tenantidan izlanadi', async () => {
    const prisma = makeMockPrisma([row({ agentId: 'a1', label: 'agent:a1' })], []);
    const svc = new ConnectorsService(prisma as never, audit() as never, crypto() as never);

    await svc.catalog(user);

    expect(prisma.agent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'u1' }) }),
    );
  });

  it('anonim katalogda agent so‘rovi umuman qilinmaydi', async () => {
    const prisma = makeMockPrisma([]);
    const svc = new ConnectorsService(prisma as never, audit() as never, crypto() as never);

    const catalog = await svc.catalog(null);

    expect(prisma.agent.findMany).not.toHaveBeenCalled();
    expect(catalog.every((c) => c.attachedAgents.length === 0)).toBe(true);
  });
});
