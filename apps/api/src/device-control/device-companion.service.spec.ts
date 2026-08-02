import { BadRequestException, ForbiddenException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { DeviceCompanionService } from './device-companion.service';
import type { User } from '@prisma/client';

/**
 * Baseline testlar (Phase 0) + SEC-01 (pairing hardening) + SEC-02 (Engineering
 * Contract, Phase 1): computerUsePlan() endi chargeForMessage + consumeChat
 * orqali o'tadi — agents.service.ts run() bilan bir xil prepaid naqsh.
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
      findUniqueOrThrow: jest.fn(async ({ where }: any) => {
        const u = users.find((x) => x.id === where.id);
        if (!u) throw new Error('User topilmadi');
        return u;
      }),
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

/** chargeOk=false -> chargeForMessage 402 tashlaydi (agents.service.ts'dagi bilan bir xil shakl). */
function makeMockBilling(chargeOk = true) {
  return {
    chargeForMessage: jest.fn(async () => {
      if (!chargeOk) {
        throw new HttpException(
          { message: 'Balansingiz yetarli emas', reason: 'insufficient_balance' },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
      return { id: 'ledger1' };
    }),
    refund: jest.fn(async () => ({ id: 'refund1' })),
  };
}

/** consumeOk=false -> consumeChat 429 tashlaydi. */
function makeMockUsage(consumeOk = true) {
  return {
    consumeChat: jest.fn(async () => {
      if (!consumeOk) {
        throw new HttpException(
          { message: 'Kunlik limitga yetdingiz', reason: 'user_daily_cap' },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      return { remaining: 5, plan: 'free' };
    }),
  };
}

const user = { id: 'u1' } as unknown as User;

function makeService(overrides: {
  prisma?: any;
  device?: any;
  http?: any;
  connectors?: any;
  billing?: any;
  usage?: any;
} = {}) {
  const prisma = overrides.prisma ?? makeMockPrisma();
  const device = overrides.device ?? makeMockDevice();
  const http = overrides.http ?? {};
  const connectors = overrides.connectors ?? makeMockConnectors();
  const billing = overrides.billing ?? makeMockBilling();
  const usage = overrides.usage ?? makeMockUsage();
  const svc = new DeviceCompanionService(prisma, device, http, connectors, billing, usage);
  return { svc, prisma, device, http, connectors, billing, usage };
}

describe('DeviceCompanionService', () => {
  it('register — 12-belgili base32 pairingCode va 10-daqiqalik pairingExpiresAt bilan pending companion yaratadi', async () => {
    const { svc, prisma } = makeService();
    const before = Date.now();
    const res = await svc.register(user, 'phone', 'Mening telefonim');
    expect(res.kind).toBe('phone');
    expect(res.pairingCode).toMatch(/^[A-Z2-7]{12}$/);
    expect(prisma._companions[0].status).toBe('pending');
    expect(res.pairingExpiresAt!.getTime()).toBeGreaterThan(before + 9 * 60_000);
    expect(res.pairingExpiresAt!.getTime()).toBeLessThanOrEqual(before + 10 * 60_000 + 1000);
  });

  it('register — noma\'lum kind rad etiladi', async () => {
    const { svc } = makeService();
    await expect(svc.register(user, 'toaster' as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('listCompanions — tokenHash hech qachon chiqmaydi, pairingCode faqat pending holatda ko\'rinadi', async () => {
    const { svc, prisma } = makeService();
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
    const { svc } = makeService();
    await expect(svc.pair('AAAAAAAAAAAA')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('pair — muddati o\'tgan kod bilan 404 (o\'chirilganidan farqlanmaydigan xabar bilan)', async () => {
    const { svc, prisma } = makeService();
    const { pairingCode } = await svc.register(user, 'phone');
    // Muddatni sun'iy ravishda o'tkazib yuboramiz (10 daqiqadan 1ms oshiq)
    prisma._companions[0].pairingExpiresAt = new Date(Date.now() - 1);
    await expect(svc.pair(pairingCode)).rejects.toBeInstanceOf(NotFoundException);
    // Muddati o'tgan urinish companionni "paired"ga o'tkazmasligi kerak
    expect(prisma._companions[0].status).toBe('pending');
  });

  it('pair — to\'g\'ri kod bilan doimiy token beradi, companion "paired" bo\'ladi, tokenIssuedAt o\'rnatiladi', async () => {
    const { svc, prisma } = makeService();
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
    const { svc, connectors } = makeService({ prisma });
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
    const { svc, connectors } = makeService();
    const { pairingCode } = await svc.register(user, 'phone');
    await svc.pair(pairingCode!);
    expect(connectors.sendViaChannel).not.toHaveBeenCalled();
  });

  it('pair — bildirishnoma yuborishda xato bo\'lsa ham juftlash muvaffaqiyatli yakunlanadi', async () => {
    const prisma = makeMockPrisma([{ id: 'u1', telegramChatId: '999888777' }]);
    const connectors = { sendViaChannel: jest.fn(async () => { throw new Error('telegram down'); }) };
    const { svc } = makeService({ prisma, connectors });
    const { pairingCode } = await svc.register(user, 'phone');
    const res = await svc.pair(pairingCode!);
    expect(res.token).toEqual(expect.any(String));
    expect(prisma._companions[0].status).toBe('paired');
  });

  it('refreshToken — yangi token beradi, eski tokenHash bilan endi topilmaydi', async () => {
    const { svc, prisma } = makeService();
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
    const { svc } = makeService();
    const { pairingCode } = await svc.register(user, 'phone');
    const { token } = await svc.pair(pairingCode!);
    expect(await svc.authCompanion(token)).not.toBeNull();
    expect(await svc.authCompanion('yalgon-token')).toBeNull();
    expect(await svc.authCompanion(undefined)).toBeNull();
  });

  it('enqueue — ruxsat yo\'q bo\'lsa ForbiddenException va blocked log yoziladi', async () => {
    const device = makeMockDevice(false);
    const { svc } = makeService({ device });
    await expect(svc.enqueue(user, 'send_sms', { to: '+998901234567', text: 'hi' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(device.logAction).toHaveBeenCalledWith(
      user.id,
      expect.objectContaining({ status: 'blocked' }),
    );
  });

  it('enqueue — noma\'lum buyruq turi rad etiladi', async () => {
    const { svc } = makeService();
    await expect(svc.enqueue(user, 'launch_missiles' as any, {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('enqueue — ruxsat bor lekin ulangan companion yo\'q -> 404', async () => {
    const { svc } = makeService({ device: makeMockDevice(true) });
    await expect(svc.enqueue(user, 'send_sms', { to: '+998901234567', text: 'hi' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('enqueue -> poll -> result — to\'liq baxtli yo\'l', async () => {
    const { svc, prisma } = makeService({ device: makeMockDevice(true) });
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
    const { svc, prisma } = makeService();
    const { pairingCode } = await svc.register(user, 'computer');
    await svc.pair(pairingCode!);
    await expect(svc.result(prisma._companions[0], 'yoq-id', 'done')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('result — noma\'lum status "done"ga tushadi', async () => {
    const { svc, prisma } = makeService({ device: makeMockDevice(true) });
    const { pairingCode } = await svc.register(user, 'phone');
    await svc.pair(pairingCode!);
    const enq = await svc.enqueue(user, 'call', { to: '+998901234567' });
    await svc.result(prisma._companions[0], enq.id, 'garbage-status' as any);
    expect(prisma._commands[0].status).toBe('done');
  });

  it('computerUsePlan — telefon-companion rad etiladi (faqat computer)', async () => {
    const { svc } = makeService();
    const phoneCompanion = { kind: 'phone', userId: user.id } as any;
    await expect(svc.computerUsePlan(phoneCompanion, { goal: 'x' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('computerUsePlan — screen ruxsati yo\'q bo\'lsa 403', async () => {
    const { svc } = makeService({ device: makeMockDevice(false) });
    const computerCompanion = { kind: 'computer', userId: user.id } as any;
    await expect(svc.computerUsePlan(computerCompanion, { goal: 'x' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('computerUsePlan — ruxsat bor bo\'lsa engine\'ga proxy qiladi (SEC-02: charge -> consume -> engine tartibida)', async () => {
    const http = { post: jest.fn(() => of({ data: { action: 'done', summary: 'ok' } })) };
    const { svc, billing, usage } = makeService({ device: makeMockDevice(true), http });
    const computerCompanion = { id: 'comp1', kind: 'computer', userId: user.id } as any;
    const res = await svc.computerUsePlan(computerCompanion, { goal: 'ochir dasturni' });
    expect(res).toEqual({ action: 'done', summary: 'ok' });
    expect(http.post).toHaveBeenCalledWith(
      expect.stringContaining('/computer-use/plan'),
      expect.objectContaining({ goal: 'ochir dasturni', history: [] }),
      expect.any(Object),
    );

    // SEC-02 AC: pul va kvota chaqirilgan bo'lishi, va tartib charge -> consume -> engine
    expect(billing.chargeForMessage).toHaveBeenCalledTimes(1);
    expect(usage.consumeChat).toHaveBeenCalledTimes(1);
    const chargeOrder = billing.chargeForMessage.mock.invocationCallOrder[0];
    const consumeOrder = usage.consumeChat.mock.invocationCallOrder[0];
    const postOrder = http.post.mock.invocationCallOrder[0];
    expect(chargeOrder).toBeLessThan(consumeOrder);
    expect(consumeOrder).toBeLessThan(postOrder);
    expect(billing.refund).not.toHaveBeenCalled();
  });

  it('computerUsePlan — SEC-02 AC: balans yetarli bo\'lmasa 402, engine chaqirilmaydi', async () => {
    const http = { post: jest.fn(() => of({ data: { action: 'done' } })) };
    const { svc, billing, usage } = makeService({
      device: makeMockDevice(true),
      http,
      billing: makeMockBilling(false),
    });
    const computerCompanion = { id: 'comp1', kind: 'computer', userId: user.id } as any;
    await expect(svc.computerUsePlan(computerCompanion, { goal: 'x' })).rejects.toMatchObject({
      status: HttpStatus.PAYMENT_REQUIRED,
    });
    expect(usage.consumeChat).not.toHaveBeenCalled();
    expect(http.post).not.toHaveBeenCalled();
    expect(billing.refund).not.toHaveBeenCalled(); // charge o'zi muvaffaqiyatsiz — qaytarish shart emas
  });

  it('computerUsePlan — SEC-02 AC: kvota tugagan bo\'lsa 429 va yechilgan pul qaytariladi', async () => {
    const http = { post: jest.fn(() => of({ data: { action: 'done' } })) };
    const { svc, billing } = makeService({
      device: makeMockDevice(true),
      http,
      usage: makeMockUsage(false),
    });
    const computerCompanion = { id: 'comp1', kind: 'computer', userId: user.id } as any;
    await expect(svc.computerUsePlan(computerCompanion, { goal: 'x' })).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
    expect(billing.chargeForMessage).toHaveBeenCalledTimes(1);
    expect(http.post).not.toHaveBeenCalled();
    expect(billing.refund).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1' }), 'rate_limited');
  });

  it('computerUsePlan — engine xato bersa yechilgan pul qaytariladi, xato tashqariga chiqadi', async () => {
    const http = { post: jest.fn(() => throwError(() => new Error('engine down'))) };
    const { svc, billing } = makeService({ device: makeMockDevice(true), http });
    const computerCompanion = { id: 'comp1', kind: 'computer', userId: user.id } as any;
    await expect(svc.computerUsePlan(computerCompanion, { goal: 'x' })).rejects.toThrow('engine down');
    expect(billing.refund).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1' }), 'computer_use_failed');
  });

  it('computerUsePlan — har iteratsiya alohida hisoblanadi (ketma-ket 2 chaqiruv = 2 marta charge/consume)', async () => {
    const http = { post: jest.fn(() => of({ data: { action: 'click', x: 1, y: 1 } })) };
    const { svc, billing, usage } = makeService({ device: makeMockDevice(true), http });
    const computerCompanion = { id: 'comp1', kind: 'computer', userId: user.id } as any;
    await svc.computerUsePlan(computerCompanion, { goal: 'x', history: [] });
    await svc.computerUsePlan(computerCompanion, { goal: 'x', history: [{ action: 'click' }] });
    expect(billing.chargeForMessage).toHaveBeenCalledTimes(2);
    expect(usage.consumeChat).toHaveBeenCalledTimes(2);
    expect(http.post).toHaveBeenCalledTimes(2);
  });
});
