import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { of } from 'rxjs';
import { DeviceCompanionService } from './device-companion.service';
import type { User } from '@prisma/client';

/**
 * Baseline testlar — Phase 0 (Engineering Contract). Bu yerda pairing/kvota
 * MUSTAHKAMLANMAYDI (TTL, urinish-limiti, LlmQuotaGuard — Phase 1 / SEC-01,
 * SEC-02). Maqsad: hozirgi xulqni pin qilish, shunda Phase 1'ning
 * qattiqlashtirishi aniq oldin/keyin solishtiruvga ega bo'ladi.
 */

function makeMockPrisma() {
  const companions: any[] = [];
  const commands: any[] = [];
  return {
    _companions: companions,
    _commands: commands,
    deviceCompanion: {
      create: jest.fn(async ({ data }: any) => {
        const row = { id: `c${companions.length + 1}`, createdAt: new Date(), updatedAt: new Date(), ...data };
        companions.push(row);
        return row;
      }),
      findMany: jest.fn(async ({ where }: any) => companions.filter((c) => c.userId === where.userId)),
      findUnique: jest.fn(async ({ where }: any) => companions.find((c) => c.pairingCode === where.pairingCode) ?? null),
      findFirst: jest.fn(async ({ where }: any) => {
        if (where.tokenHash !== undefined) return companions.find((c) => c.tokenHash === where.tokenHash) ?? null;
        return (
          companions.find(
            (c) => c.userId === where.userId && c.kind === where.kind && c.status === where.status,
          ) ?? null
        );
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const row = companions.find((c) => c.id === where.id);
        Object.assign(row, data);
        return row;
      }),
    },
    deviceCommand: {
      create: jest.fn(async ({ data }: any) => {
        const row = { id: `cmd${commands.length + 1}`, createdAt: new Date(), updatedAt: new Date(), ...data };
        commands.push(row);
        return row;
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        if (where.status === 'queued') {
          return (
            commands
              .filter((c) => c.companionId === where.companionId && c.status === 'queued')
              .sort((a, b) => a.createdAt - b.createdAt)[0] ?? null
          );
        }
        return commands.find((c) => c.id === where.id && c.companionId === where.companionId) ?? null;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const row = commands.find((c) => c.id === where.id);
        Object.assign(row, data);
        return row;
      }),
    },
  };
}

function makeMockDevice(allowed = true) {
  return {
    isAllowed: jest.fn(async () => allowed),
    logAction: jest.fn(async () => null),
  };
}

const user = { id: 'u1' } as unknown as User;

describe('DeviceCompanionService', () => {
  it('register — 6-xonali pairingCode bilan pending companion yaratadi', async () => {
    const prisma = makeMockPrisma();
    const svc = new DeviceCompanionService(prisma as any, makeMockDevice() as any, {} as any);
    const res = await svc.register(user, 'phone', 'Mening telefonim');
    expect(res.kind).toBe('phone');
    expect(res.pairingCode).toMatch(/^\d{6}$/);
    expect(prisma._companions[0].status).toBe('pending');
  });

  it('register — noma\'lum kind rad etiladi', async () => {
    const prisma = makeMockPrisma();
    const svc = new DeviceCompanionService(prisma as any, makeMockDevice() as any, {} as any);
    await expect(svc.register(user, 'toaster' as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('listCompanions — tokenHash hech qachon chiqmaydi, pairingCode faqat pending holatda ko\'rinadi', async () => {
    const prisma = makeMockPrisma();
    const svc = new DeviceCompanionService(prisma as any, makeMockDevice() as any, {} as any);
    await svc.register(user, 'computer');
    const [list] = [await svc.listCompanions(user)];
    expect(list[0]).not.toHaveProperty('tokenHash');
    expect(list[0].pairingCode).toEqual(expect.any(String));

    // Juftlangach pairingCode boshqa foydalanuvchiga ko'rinmasligi kerak
    prisma._companions[0].status = 'paired';
    const afterPair = await svc.listCompanions(user);
    expect(afterPair[0].pairingCode).toBeNull();
  });

  it('pair — noto\'g\'ri kod bilan 404', async () => {
    const prisma = makeMockPrisma();
    const svc = new DeviceCompanionService(prisma as any, makeMockDevice() as any, {} as any);
    await expect(svc.pair('000000')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('pair — to\'g\'ri kod bilan doimiy token beradi va companion "paired" bo\'ladi', async () => {
    const prisma = makeMockPrisma();
    const svc = new DeviceCompanionService(prisma as any, makeMockDevice() as any, {} as any);
    const { pairingCode } = await svc.register(user, 'phone');
    const res = await svc.pair(pairingCode!);
    expect(res.token).toEqual(expect.any(String));
    expect(prisma._companions[0].status).toBe('paired');
    expect(prisma._companions[0].pairingCode).toBeNull();
  });

  it('authCompanion — token orqali companion topadi, noto\'g\'ri tokenda null', async () => {
    const prisma = makeMockPrisma();
    const svc = new DeviceCompanionService(prisma as any, makeMockDevice() as any, {} as any);
    const { pairingCode } = await svc.register(user, 'phone');
    const { token } = await svc.pair(pairingCode!);
    expect(await svc.authCompanion(token)).not.toBeNull();
    expect(await svc.authCompanion('yalgon-token')).toBeNull();
    expect(await svc.authCompanion(undefined)).toBeNull();
  });

  it('enqueue — ruxsat yo\'q bo\'lsa ForbiddenException va blocked log yoziladi', async () => {
    const prisma = makeMockPrisma();
    const device = makeMockDevice(false);
    const svc = new DeviceCompanionService(prisma as any, device as any, {} as any);
    await expect(svc.enqueue(user, 'send_sms', { to: '+998901234567', text: 'hi' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(device.logAction).toHaveBeenCalledWith(
      user.id,
      expect.objectContaining({ status: 'blocked' }),
    );
  });

  it('enqueue — noma\'lum buyruq turi rad etiladi', async () => {
    const prisma = makeMockPrisma();
    const svc = new DeviceCompanionService(prisma as any, makeMockDevice() as any, {} as any);
    await expect(svc.enqueue(user, 'launch_missiles' as any, {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('enqueue — ruxsat bor lekin ulangan companion yo\'q -> 404', async () => {
    const prisma = makeMockPrisma();
    const svc = new DeviceCompanionService(prisma as any, makeMockDevice(true) as any, {} as any);
    await expect(svc.enqueue(user, 'send_sms', { to: '+998901234567', text: 'hi' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('enqueue -> poll -> result — to\'liq baxtli yo\'l', async () => {
    const prisma = makeMockPrisma();
    const svc = new DeviceCompanionService(prisma as any, makeMockDevice(true) as any, {} as any);
    const { pairingCode } = await svc.register(user, 'phone');
    await svc.pair(pairingCode!);

    const enq = await svc.enqueue(user, 'send_sms', { to: '+998901234567', text: 'salom' });
    expect(enq.status).toBe('queued');

    const companion = prisma._companions[0];
    const polled = await svc.poll(companion);
    expect(polled.command?.kind).toBe('send_sms');
    expect(prisma._commands[0].status).toBe('running');

    // Navbatda boshqa buyruq yo'q — ikkinchi poll bo'sh qaytadi
    expect((await svc.poll(companion)).command).toBeNull();

    const res = await svc.result(companion, polled.command!.id, 'done', { ok: true });
    expect(res.ok).toBe(true);
    expect(prisma._commands[0].status).toBe('done');
  });

  it('result — mavjud bo\'lmagan buyruq id\'sida 404', async () => {
    const prisma = makeMockPrisma();
    const svc = new DeviceCompanionService(prisma as any, makeMockDevice() as any, {} as any);
    const { pairingCode } = await svc.register(user, 'computer');
    await svc.pair(pairingCode!);
    await expect(svc.result(prisma._companions[0], 'yoq-id', 'done')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('result — noma\'lum status "done"ga tushadi', async () => {
    const prisma = makeMockPrisma();
    const svc = new DeviceCompanionService(prisma as any, makeMockDevice(true) as any, {} as any);
    const { pairingCode } = await svc.register(user, 'phone');
    await svc.pair(pairingCode!);
    const enq = await svc.enqueue(user, 'call', { to: '+998901234567' });
    await svc.result(prisma._companions[0], enq.id, 'garbage-status' as any);
    expect(prisma._commands[0].status).toBe('done');
  });

  it('computerUsePlan — telefon-companion rad etiladi (faqat computer)', async () => {
    const prisma = makeMockPrisma();
    const svc = new DeviceCompanionService(prisma as any, makeMockDevice() as any, {} as any);
    const phoneCompanion = { kind: 'phone', userId: user.id } as any;
    await expect(svc.computerUsePlan(phoneCompanion, { goal: 'x' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('computerUsePlan — screen ruxsati yo\'q bo\'lsa 403', async () => {
    const prisma = makeMockPrisma();
    const svc = new DeviceCompanionService(prisma as any, makeMockDevice(false) as any, {} as any);
    const computerCompanion = { kind: 'computer', userId: user.id } as any;
    await expect(svc.computerUsePlan(computerCompanion, { goal: 'x' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('computerUsePlan — ruxsat bor bo\'lsa engine\'ga proxy qiladi', async () => {
    const prisma = makeMockPrisma();
    const http = { post: jest.fn(() => of({ data: { action: 'done', summary: 'ok' } })) };
    const svc = new DeviceCompanionService(prisma as any, makeMockDevice(true) as any, http as any);
    const computerCompanion = { kind: 'computer', userId: user.id } as any;
    const res = await svc.computerUsePlan(computerCompanion, { goal: 'ochir dasturni' });
    expect(res).toEqual({ action: 'done', summary: 'ok' });
    expect(http.post).toHaveBeenCalledWith(
      expect.stringContaining('/computer-use/plan'),
      expect.objectContaining({ goal: 'ochir dasturni', history: [] }),
      expect.any(Object),
    );
  });
});
