import { AuditLogService } from './auth.service';
import { AUDIT_GENESIS, computeEntryHash } from './audit-hash';

/**
 * A17 / ADR-008 — `verifyChain(actorId)` shartnomasi.
 *
 * Zanjirning butun qiymati shu metodda: agar u buzilishni SEZMASA, hash-zanjir
 * shunchaki bezak bo'lib qoladi. Shuning uchun har bir buzilish turi alohida
 * tekshiriladi.
 */

interface Row {
  id: string;
  seq: number;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  createdAt: Date;
  metadata: unknown;
  prevHash: string;
  entryHash: string;
}

/** To'g'ri bog'langan zanjir quradi (aynan `record()` qiladigan tarzda). */
function buildChain(actorId: string, count: number): Row[] {
  const rows: Row[] = [];
  let prevHash = AUDIT_GENESIS;

  for (let i = 0; i < count; i++) {
    const base = {
      id: `id${i}`,
      seq: i + 1,
      actorId,
      action: `action.${i}`,
      resourceType: 'agent',
      resourceId: `r${i}`,
      createdAt: new Date(`2026-08-07T10:0${i}:00.000Z`),
      metadata: { i, note: `n${i}` },
    };
    const entryHash = computeEntryHash(prevHash, base);
    rows.push({ ...base, prevHash, entryHash });
    prevHash = entryHash;
  }
  return rows;
}

function serviceFor(rows: Row[]) {
  const prisma = {
    auditLog: { findMany: jest.fn(async () => rows) },
  };
  return new AuditLogService(prisma as never);
}

describe('AuditLogService.verifyChain', () => {
  it('to\'g\'ri zanjir -> ok, tekshirilgan soni qaytadi', async () => {
    const res = await serviceFor(buildChain('u1', 5)).verifyChain('u1');
    expect(res).toEqual({ ok: true, checked: 5 });
  });

  it('bo\'sh zanjir (aktorda yozuv yo\'q) -> ok', async () => {
    const res = await serviceFor([]).verifyChain('u1');
    expect(res).toEqual({ ok: true, checked: 0 });
  });

  it('birinchi yozuv GENESIS dan boshlanmasa -> prev_mismatch', async () => {
    const rows = buildChain('u1', 3);
    rows[0].prevHash = 'boshqa-narsa';
    const res = await serviceFor(rows).verifyChain('u1');

    expect(res.ok).toBe(false);
    expect(res.brokenAt).toEqual({ id: 'id0', seq: 1, reason: 'prev_mismatch' });
  });

  it('metadata jimgina o\'zgartirilsa -> hash_mismatch (aynan o\'sha yozuvda)', async () => {
    const rows = buildChain('u1', 4);
    rows[2].metadata = { i: 99, note: 'buzilgan' };
    const res = await serviceFor(rows).verifyChain('u1');

    expect(res.ok).toBe(false);
    expect(res.brokenAt).toEqual({ id: 'id2', seq: 3, reason: 'hash_mismatch' });
  });

  it('createdAt orqaga surilsa -> hash_mismatch (vaqt belgisi ham qo\'riqlanadi)', async () => {
    const rows = buildChain('u1', 3);
    rows[1].createdAt = new Date('2020-01-01T00:00:00.000Z');
    const res = await serviceFor(rows).verifyChain('u1');

    expect(res.ok).toBe(false);
    expect(res.brokenAt?.reason).toBe('hash_mismatch');
  });

  it('actorId almashtirilsa -> hash_mismatch', async () => {
    const rows = buildChain('u1', 3);
    rows[1].actorId = 'boshqa-odam';
    const res = await serviceFor(rows).verifyChain('u1');

    expect(res.ok).toBe(false);
    expect(res.brokenAt?.reason).toBe('hash_mismatch');
  });

  it('o\'rtadagi yozuv O\'CHIRILSA -> keyingi yozuvda prev_mismatch', async () => {
    const rows = buildChain('u1', 5);
    rows.splice(2, 1); // 3-yozuvni olib tashlaymiz
    const res = await serviceFor(rows).verifyChain('u1');

    expect(res.ok).toBe(false);
    expect(res.brokenAt).toEqual({ id: 'id3', seq: 4, reason: 'prev_mismatch' });
  });

  it('yozuv QO\'SHIB qo\'yilsa -> prev_mismatch', async () => {
    const rows = buildChain('u1', 3);
    const fake: Row = {
      ...rows[1],
      id: 'soxta',
      seq: 99,
      action: 'admin.grant_owner',
    };
    rows.splice(2, 0, fake); // oxiridan oldin qistiramiz
    const res = await serviceFor(rows).verifyChain('u1');

    expect(res.ok).toBe(false);
  });

  it('ikki yozuv o\'rni ALMASHTIRILSA -> buzilish seziladi', async () => {
    const rows = buildChain('u1', 4);
    [rows[1], rows[2]] = [rows[2], rows[1]];
    const res = await serviceFor(rows).verifyChain('u1');

    expect(res.ok).toBe(false);
  });

  it('faqat SO\'RALGAN aktor yozuvlari o\'qiladi (per-actor zanjir)', async () => {
    const rows = buildChain('u1', 2);
    const prisma = { auditLog: { findMany: jest.fn(async () => rows) } };
    await new AuditLogService(prisma as never).verifyChain('u1');

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      where: { actorId: 'u1' },
      orderBy: { seq: 'asc' },
    });
  });
});
