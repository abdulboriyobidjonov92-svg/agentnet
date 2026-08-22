/**
 * V3-P0 EXIT GATE **G0.5** — "HIGH-risk amal inson tasdig'isiz
 * bajarilmaydi: 0 ta chetlab o'tish".
 *
 * Bu fayl gate'ning MEXANIK dalili. U policy engine'ni alohida
 * tekshirmaydi (u `policy-engine.spec.ts` da) — bu yerda savol bitta:
 * **konnektorning `execute()` metodi haqiqatan chaqirilmaydimi?**
 *
 * Chetlab o'tishning yagona mumkin yo'li — `ConnectorsService.invoke`
 * dan tashqari ijro nuqtasi bo'lishi. Oxirgi test aynan shuni qulflaydi.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ConnectorsService } from '../connectors/connectors.service';
import { PolicyEngine } from './policy-engine.service';
import { connectorById } from '../connectors/connectors.registry';
import type { User } from '@prisma/client';

const user = { id: 'u1', role: 'MEMBER' } as unknown as User;

function makeService() {
  const prisma = {
    connectorConfig: {
      findMany: jest.fn(async () => [
        { id: 'c1', userId: 'u1', connectorId: 'eskiz-sms', agentId: null, config: '{}', status: 'connected' },
      ]),
      update: jest.fn(async () => undefined),
    },
    agent: { findFirst: jest.fn(async () => ({ id: 'a1', vertical: null, killedAt: null })) },
    // Faol ijro yo'q — tasdiq so'rovi yozilmaydi, lekin amal baribir BLOKLANADI.
    executionRun: { findMany: jest.fn(async () => []) },
  };
  const audit = { record: jest.fn(async () => undefined) };
  const crypto = { decryptJson: jest.fn(() => ({ token: 'x' })), encryptJson: jest.fn() };
  const svc = new ConnectorsService(
    prisma as never,
    audit as never,
    crypto as never,
    new PolicyEngine(),
  );
  return { svc, prisma, audit };
}

/** Konnektorning haqiqiy `execute` metodini kuzatuvchi bilan almashtiradi. */
function spyOnExecute(connectorId: string) {
  const def = connectorById.get(connectorId);
  if (!def) throw new Error(`test uchun konnektor topilmadi: ${connectorId}`);
  return jest.spyOn(def, 'execute').mockResolvedValue({ ok: true, data: 'BAJARILDI' });
}

afterEach(() => jest.restoreAllMocks());

describe('G0.5 — HIGH+ amal tasdiqsiz BAJARILMAYDI', () => {
  it('⚠️ SMS yuborish → `execute` CHAQIRILMAYDI', async () => {
    const execute = spyOnExecute('eskiz-sms');
    const { svc } = makeService();

    const res = await svc.invoke(user, 'eskiz-sms', 'send_sms', { to: '+998901234567', text: 'salom' }, 'a1');

    expect(execute).not.toHaveBeenCalled();
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/tasdig|bloklandi/i);
  });

  it('⚠️ to‘lov → `execute` CHAQIRILMAYDI', async () => {
    const execute = spyOnExecute('payme-merchant');
    const { svc, prisma } = makeService();
    prisma.connectorConfig.findMany = jest.fn(async () => [
      { id: 'c2', userId: 'u1', connectorId: 'payme-merchant', agentId: null, config: '{}', status: 'connected' },
    ]) as never;

    const res = await svc.invoke(user, 'payme-merchant', 'create_invoice', { amount: 100000 }, 'a1');

    expect(execute).not.toHaveBeenCalled();
    expect(res.ok).toBe(false);
  });

  it('⚠️ davlat hujjatini topshirish → `execute` CHAQIRILMAYDI', async () => {
    const execute = spyOnExecute('soliq-uz');
    const { svc, prisma } = makeService();
    prisma.connectorConfig.findMany = jest.fn(async () => [
      { id: 'c3', userId: 'u1', connectorId: 'soliq-uz', agentId: null, config: '{}', status: 'connected' },
    ]) as never;

    const res = await svc.invoke(user, 'soliq-uz', 'submit_report', {}, 'a1');

    expect(execute).not.toHaveBeenCalled();
    expect(res.ok).toBe(false);
  });

  it('blok hodisasi AUDITGA yoziladi (jimgina rad etilmaydi)', async () => {
    spyOnExecute('eskiz-sms');
    const { svc, audit } = makeService();

    await svc.invoke(user, 'eskiz-sms', 'send_sms', { to: '+998901234567' }, 'a1');

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: expect.stringMatching(/^policy\.(blocked|approval_required)$/),
        metadata: expect.objectContaining({ tier: expect.any(String) }),
      }),
    );
  });

  it('to‘xtatilgan agent (kill switch) → `execute` CHAQIRILMAYDI', async () => {
    const execute = spyOnExecute('google-sheets');
    const { svc, prisma } = makeService();
    prisma.agent.findFirst = jest.fn(async () => ({ id: 'a1', vertical: null, killedAt: new Date() })) as never;
    prisma.connectorConfig.findMany = jest.fn(async () => [
      { id: 'c4', userId: 'u1', connectorId: 'google-sheets', agentId: null, config: '{}', status: 'connected' },
    ]) as never;

    const res = await svc.invoke(user, 'google-sheets', 'read_range', {}, 'a1');

    expect(execute).not.toHaveBeenCalled();
    expect(res.error).toMatch(/bloklandi/i);
  });
});

describe('LOW amal — darvoza to‘sib qolmaydi', () => {
  it('sheets o‘qish BAJARILADI', async () => {
    const execute = spyOnExecute('google-sheets');
    const { svc, prisma } = makeService();
    prisma.connectorConfig.findMany = jest.fn(async () => [
      { id: 'c5', userId: 'u1', connectorId: 'google-sheets', agentId: null, config: '{}', status: 'connected' },
    ]) as never;

    const res = await svc.invoke(user, 'google-sheets', 'read_range', { range: 'A1:B2' }, 'a1');

    expect(execute).toHaveBeenCalledTimes(1);
    expect(res.ok).toBe(true);
  });
});

describe('⚠️ CHETLAB O‘TISH YUZASI — yagona ijro nuqtasi', () => {
  it('konnektor `execute()` FAQAT connectors.service.ts dan chaqiriladi', () => {
    // Agar boshqa fayl `def.execute(...)` ni chaqirsa, u policy darvozasini
    // chetlab o'tgan bo'lardi — G0.5 buzilardi. Bu test shuni qulflaydi.
    const SRC = join(__dirname, '..');
    const offenders: string[] = [];

    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!entry.name.endsWith('.ts') || entry.name.endsWith('.spec.ts')) continue;
        // Konnektorlarning O'ZIDA `execute` — ta'rif, chaqiruv emas.
        if (full.includes(join('connectors', 'connectors'))) continue;
        if (full.endsWith(join('connectors', 'connectors.service.ts'))) continue;

        const src = readFileSync(full, 'utf8');
        if (/\bdef\.execute\s*\(|\.execute\s*\(\s*actionId/.test(src)) {
          offenders.push(full.slice(SRC.length + 1));
        }
      }
    };
    walk(SRC);

    expect(offenders).toEqual([]);
  });
});
