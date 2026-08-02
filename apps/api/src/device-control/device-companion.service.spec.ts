import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { of } from 'rxjs';
import { DeviceCompanionService } from './device-companion.service';
import type { User } from '@prisma/client';

/**
 * Baseline testlar (Phase 0) + SEC-01 (Phase 1, Engineering Contract):
 * pairing endi 10 daqiqada muddati o'tadi, 12-belgili base32, muvaffaqiyatli
 * juftlashda bildirishnoma, token 30-kunlik rotatsiya (/companion/refresh).
 */

function makeMockPrisma(users: any[] = [{ id: 'u1', telegramChatId: null }]) {
  const companions: any[] = [];
  const commands: any[] = [];
  return {
    _companions: companions,
    _commands: commands,
    _users: users,
    user: {
      findUnique: jest.fn(async ({ where }: any) => users.find((u) => u.id === where.id) ?? null),
    },
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

function makeMockConnectors() {
  return { sendViaChannel: jest.fn(async () => ({ ok: true })) };
}

const user = { id: 'u1' } as unknown as User;

describe('DeviceCompanionService', () => {
  it('register — 12-belgili base32 pairingCode va 10-daqiqalik pairingExpiresAt bilan pending companion yaratadi', async () => {
    const prisma = makeMockPrisma();
    const svc = new DeviceCompanionService(prisma as any, makeMockDevice() as any, {} as any, makeMockConnectors() as any);
    const before = Date.now();
    const res = await svc.register(user, 'phone', 'Mening telefonim');
    expect(res.kind).toBe('phone');
    expect(res.pairingCode).toMatch(/^[A-Z2-7]{12}$/);
    expect(prisma._companions[0].status).toBe('pending');
    expect(res.pairingExpiresAt!.getTime()).toBeGreaterThan(before + 9 * 60_000);
    expect(res.pairingExpiresAt!.getTime()).toBeLessThanOrEqual(before + 10 * 60_000 + 1000);
  });

  it('register — noma\'lum kind rad etiladi', async () => {
    const prisma = makeMockPrisma();
    const svc = new DeviceCompanionService(prisma as any, makeMockDevice() as any, {} as any, makeMockConnectors() as any);
    await expect(svc.register(user, 'toaster' as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('listCompanions — tokenHash hech qachon chiqmaydi, pairingCode faqat pending holatda ko\'rinadi', async () => {
    const prisma = makeMockPrisma();
    const svc = new DeviceCompanionService(prisma as any, makeMockDevice() as any, {} as any, makeMockConnectors() as any);
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
    const svc = new DeviceCompanionService(prisma as any, makeMockDevice() as any, {} as any, makeMockConnectors() as any);
    await expect(svc.pair('AAAAAAAAAAAA')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('pair — muddati o\'tgan kod bilan 404 (o\'chirilganidan farqlanmaydigan xabar bilan)', async () => {
    const prisma = makeMockPrisma();
    const svc = new DeviceCompanionService(prisma as any, makeMockDevice() as any, {} as any, makeMockConnectors() as any);
    const { pairingCode } = await svc.register(user, 'phone');
    // Muddatni sun'iy ravishda o'tkazib yuboramiz (10 daqiqadan 1ms oshiq)
    prisma._companions[0].pairingExpiresAt = new Date(Date.now() - 1);
    await expect(svc.pair(pairingCode)).rejects.toBeInstanceOf(NotFoundException);
    // Muddati o'tgan urinish companionni "paired"ga o'tkazmasligi kerak
    expect(prisma._companions[0].status).toBe('pending');
  });

  it('pair — to\'g\'ri kod bilan doimiy token beradi, companion "paired" bo\'ladi, tokenIssuedAt o\'rnatiladi', async () => {
    const prisma = makeMockPrisma();
    const svc = new DeviceCompanionService(prisma as any, makeMockDevice() as any, {} as any, makeMockConnectors() as any);
    const { pairingCode } = await svc.register(user, 'phone');
    const res = await svc.pair(pairingCode!);
    expect(res.token).toEqual(expect.any(String));
    expect(prisma._companions[0].status).toBe('paired');
    expect(prisma._companions[0].pairingCode).toBeNull();
    expect(prisma._companions[0].pairingExpiresAt).toBeNull();
    expect(prisma._companions[0].tokenIssuedAt).toBeInstanceOf(Date);
  });

  it('pair — telegramChatId ulangan bo\'lsa bildirishnoma yuboriladi', async () => {
    const prisma = makeMockPrisma([{ id: 'u1', telegramChatId: '999888777' }]);
    const connectors = makeMockConnectors();
    const svc = new DeviceCompanionService(prisma as any, makeMockDevice() as any, {} as any, connectors as any);
    const { pairingCode } = await svc.register(user, 'phone');
    await svc.pair(pairingCode!);
    expect(connectors.sendViaChannel).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u1' }),
      'telegram',
      '999888777',
      expect.any(String),
    );
  });

  it('pair — telegramChatId ulanmagan bo\'lsa bildirishnoma sinab ko\'rilmaydi', async () => {
    const prisma = makeMockPrisma([{ id: 'u1', telegramChatId: null }]);
    const connectors = makeMockConnectors();
    const svc = new DeviceCompanionService(prisma as any, makeMockDevice() as any, {} as any, connectors as any);
    const { pairingCode } = await svc.register(user, 'phone');
    await svc.pair(pairingCode!);
    expect(connectors.sendViaChannel).not.toHaveBeenCalled();
  });

  it('pair — bildirishnoma yuborishda xato bo\'lsa ham juftlash muvaffaqiyatli yakunlanadi', async () => {
    const prisma = makeMockPrisma([{ id: 'u1', telegramChatId: '999888777' }]);
    const connectors = { sendViaChannel: jest.fn(async () => { throw new Error('telegram down'); }) };
    const svc = new DeviceCompanionService(prisma as any, makeMockDevice() as any, {} as any, connectors as any);
    const { pairingCode } = await svc.register(user, 'phone');
    const res = await svc.pair(pairingCode!);
    expect(res.token).toEqual(expect.any(String));
    expect(prisma._companions[0].status).toBe('paired');
  });

  it('refreshToken — yangi token beradi, eski tokenHash bilan endi topilmaydi', async () => {
    const prisma = makeMockPrisma();
    const svc = new DeviceCompanionService(prisma as any, makeMockDevice() as any, {} as any, makeMockConnectors() as any);
    const { pairingCode } = await svc.register(user, 'computer');
    const { token: oldToken } = await svc.pair(pairingCode!);
    const oldIssuedAt = prisma._companions[0].tokenIssuedAt;

    const { token: newToken } = await svc.refreshToken(prisma._companions[0]);
    expect(newToken).not.toBe(oldToken);
    expect(await svc.authCompanion(oldToken)).toBeNull();
    const found = await svc.authCompanion(newToken);
    expect(found?.id).toBe(prisma._companions[0].id);
    expect(prisma._companions[0].tokenIssuedAt.getTime()).toBeGreaterThanOrEqual(oldIssuedAt.getTime());
  });

  it('authCompanion — token orqali companion topadi, noto\'g\'ri tokenda null', async () => {
    const prisma = makeMockPrisma();
    const svc = new DeviceCompanionService(prisma as any, makeMockDevice() as any, {} as any, makeMockConnectors() as any);
    const { pairingCode } = await svc.register(user, 'phone');
    const { token } = await svc.pair(pairingCode!);
    expect(await svc.authCompanion(token)).not.toBeNull();
    expect(await svc.authCompanion('yalgon-token')).toBeNull();
    expect(await svc.authCompanion(undefined)).toBeNull();
  });

  it('enqueue — ruxsat yo\'q bo\'lsa ForbiddenException va blocked log yoziladi', async () => {
    const prisma = makeMockPrisma();
    const device = makeMockDevice(false);
    const svc = new DeviceCompanionService(prisma as any, device as any, {} as any, makeMockConnectors() as any);
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
    const svc = new DeviceCompanionService(prisma as any, makeMockDevice() as any, {} as any, makeMockConnectors() as any);
    await expect(svc.enqueue(user, 'launch_missiles' as any, {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('enqueue — ruxsat bor lekin ulangan companion yo\'q -> 404', async () => {
    const prisma = makeMockPrisma();
    const svc = new DeviceCompanionService(prisma as any, makeMockDevice(true) as any, {} as any, makeMockConnectors() as any);
    await expect(svc.enqueue(user, 'send_sms', { to: '+998901234567', text: 'hi' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('enqueue -> poll -> result — to\'liq baxtli yo\'l', async () => {
    const prisma = makeMockPrisma();
    const svc = new DeviceCompanionService(prisma as any, makeMockDevice(true) as any, {} as any, makeMockConnectors() as any);
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
    const svc = new DeviceCompanionService(prisma as any, makeMockDevice() as any, {} as any, makeMockConnectors() as any);
    const { pairingCode } = await svc.register(user, 'computer');
    await svc.pair(pairingCode!);
    await expect(svc.result(prisma._companions[0], 'yoq-id', 'done')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('result — noma\'lum status "done"ga tushadi', async () => {
    const prisma = makeMockPrisma();
    const svc = new DeviceCompanionService(prisma as any, makeMockDevice(true) as any, {} as any, makeMockConnectors() as any);
    const { pairingCode } = await svc.register(user, 'phone');
    await svc.pair(pairingCode!);
    const enq = await svc.enqueue(user, 'call', { to: '+998901234567' });
    await svc.result(prisma._companions[0], enq.id, 'garbage-status' as any);
    expect(prisma._commands[0].status).toBe('done');
  });

  it('computerUsePlan — telefon-companion rad etiladi (faqat computer)', async () => {
    const prisma = makeMockPrisma();
    const svc = new DeviceCompanionService(prisma as any, makeMockDevice() as any, {} as any, makeMockConnectors() as any);
    const phoneCompanion = { kind: 'phone', userId: user.id } as any;
    await expect(svc.computerUsePlan(phoneCompanion, { goal: 'x' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('computerUsePlan — screen ruxsati yo\'q bo\'lsa 403', async () => {
    const prisma = makeMockPrisma();
    const svc = new DeviceCompanionService(prisma as any, makeMockDevice(false) as any, {} as any, makeMockConnectors() as any);
    const computerCompanion = { kind: 'computer', userId: user.id } as any;
    await expect(svc.computerUsePlan(computerCompanion, { goal: 'x' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('computerUsePlan — ruxsat bor bo\'lsa engine\'ga proxy qiladi', async () => {
    const prisma = makeMockPrisma();
    const http = { post: jest.fn(() => of({ data: { action: 'done', summary: 'ok' } })) };
    const svc = new DeviceCompanionService(prisma as any, makeMockDevice(true) as any, http as any, makeMockConnectors() as any);
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
