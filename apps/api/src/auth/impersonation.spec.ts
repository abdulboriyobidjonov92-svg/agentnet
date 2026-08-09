import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ImpersonationStatus, UserRole } from '@prisma/client';
import { AuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';
import { ImpersonationGuard } from './impersonation.guard';
import { ImpersonationAuditInterceptor } from './impersonation-audit.interceptor';
import { ImpersonationService } from './impersonation.service';
import { ROLES_KEY } from './roles.decorator';
import { canImpersonateRole, isForbiddenImpersonationRead } from './impersonation.policy';
import { outranks } from './role-rank';
import { IMPERSONATION_READ_ONLY, IMPERSONATION_TYP, signToken } from './token.util';
import type { ImpersonationContext } from './impersonation.types';

/**
 * SEC-12 — impersonation SESSIYASI va TAQIQLARI (§26 barcha bloklari).
 *
 * Bu testlar Contract §6.6 ning jim buziladigan kafolatlarini qulflaydi:
 * kim kimni ko'ra oladi, sessiya qachon o'ladi, nima taqiqlanadi va
 * jurnalda aktor bilan nishon chalkashmasligi.
 */

beforeAll(() => {
  process.env.AUTH_JWT_SECRET = 'k'.repeat(32);
});

const NOW = Date.now();

const ADMIN = {
  id: 'admin1',
  email: 'admin@a.b',
  role: UserRole.ADMIN,
  tokenVersion: 3,
  blockedAt: null,
  twoFactorEnabled: true,
};

const TARGET = {
  id: 'target1',
  email: 'member@a.b',
  name: 'Member',
  role: UserRole.MEMBER,
  tokenVersion: 7,
  blockedAt: null,
};

function activeSession(over: Record<string, unknown> = {}) {
  return {
    id: 'imp1',
    status: ImpersonationStatus.active,
    mode: IMPERSONATION_READ_ONLY,
    actorId: ADMIN.id,
    targetUserId: TARGET.id,
    reason: 'x'.repeat(25),
    actorTokenVersion: ADMIN.tokenVersion,
    expiresAt: new Date(NOW + 10 * 60 * 1000),
    endedAt: null,
    endedReason: null,
    requestCount: 0,
    notifiedAt: null,
    createdAt: new Date(NOW - 60 * 1000),
    ...over,
  };
}

function makeService(over: { session?: unknown; actor?: unknown; target?: unknown } = {}) {
  const session = over.session === undefined ? activeSession() : over.session;
  const actor = over.actor === undefined ? ADMIN : over.actor;
  const target = over.target === undefined ? TARGET : over.target;

  const prisma = {
    impersonationSession: {
      findUnique: jest.fn(async () => session),
      findFirst: jest.fn(async () => null),
      findMany: jest.fn(async () => []),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        ...activeSession(),
        ...data,
      })),
      update: jest.fn(async () => ({})),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    user: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        where.id === ADMIN.id ? actor : target,
      ),
    },
  };
  const audit = {
    record: jest.fn(async () => undefined) as unknown as jest.Mock<
      Promise<void>,
      [Record<string, any>]
    >,
  };
  const svc = new ImpersonationService(prisma as never, audit as never);
  return { svc, prisma, audit };
}

const impToken = (over: Record<string, unknown> = {}) =>
  signToken(
    {
      sub: TARGET.id,
      tv: TARGET.tokenVersion,
      typ: IMPERSONATION_TYP,
      act: ADMIN.id,
      imp: 'imp1',
      mode: IMPERSONATION_READ_ONLY,
      ...over,
    },
    600,
  );

// ----------------------------------------------------------------
// §3 / §9 — avtorizatsiya matritsasi
// ----------------------------------------------------------------
describe('SEC-12 — kim kimni impersonation qila oladi', () => {
  it('OWNER/ADMIN/SUPPORT — MEMBER ni ko\'ra oladi', () => {
    expect(canImpersonateRole(UserRole.OWNER, UserRole.MEMBER)).toBe(true);
    expect(canImpersonateRole(UserRole.ADMIN, UserRole.MEMBER)).toBe(true);
    expect(canImpersonateRole(UserRole.SUPPORT, UserRole.MEMBER)).toBe(true);
  });

  it('MEMBER va VIEWER umuman impersonation qila OLMAYDI', () => {
    expect(canImpersonateRole(UserRole.MEMBER, UserRole.VIEWER)).toBe(false);
    expect(canImpersonateRole(UserRole.VIEWER, UserRole.MEMBER)).toBe(false);
  });

  it('§9 — HECH KIM OWNER ni impersonation qila olmaydi (OWNER ham)', () => {
    for (const actor of [UserRole.OWNER, UserRole.ADMIN, UserRole.SUPPORT]) {
      expect(canImpersonateRole(actor, UserRole.OWNER)).toBe(false);
    }
  });

  it('§9 — teng rol tegilmas: ADMIN->ADMIN, SUPPORT->SUPPORT rad etiladi', () => {
    expect(canImpersonateRole(UserRole.ADMIN, UserRole.ADMIN)).toBe(false);
    expect(canImpersonateRole(UserRole.SUPPORT, UserRole.SUPPORT)).toBe(false);
  });

  it('§9 — past rol yuqorini ko\'ra olmaydi: SUPPORT -> ADMIN rad etiladi', () => {
    expect(canImpersonateRole(UserRole.SUPPORT, UserRole.ADMIN)).toBe(false);
  });

  it('ierarxiya `outranks` bilan bir xil manbadan keladi', () => {
    expect(outranks(UserRole.OWNER, UserRole.ADMIN)).toBe(true);
    expect(outranks(UserRole.ADMIN, UserRole.OWNER)).toBe(false);
  });
});

// ----------------------------------------------------------------
// §6 / §16 — sessiyaning yashash sharti
// ----------------------------------------------------------------
describe('SEC-12 — sessiyani tekshirish (resolve)', () => {
  const payload = () => ({
    sub: TARGET.id,
    tv: TARGET.tokenVersion,
    typ: IMPERSONATION_TYP as typeof IMPERSONATION_TYP,
    act: ADMIN.id,
    imp: 'imp1',
    mode: IMPERSONATION_READ_ONLY as typeof IMPERSONATION_READ_ONLY,
    iat: 0,
    exp: 0,
  });

  it('faol sessiya -> kontekst: aktor va nishon ALOHIDA saqlanadi', async () => {
    const { svc } = makeService();
    const { context, target } = await svc.resolve(payload());

    expect(context.realActorId).toBe(ADMIN.id);
    expect(context.targetUserId).toBe(TARGET.id);
    expect(context.realActorRole).toBe(UserRole.ADMIN);
    expect(context.mode).toBe(IMPERSONATION_READ_ONLY);
    expect(target.id).toBe(TARGET.id);
  });

  it('sessiya topilmasa -> 401', async () => {
    const { svc } = makeService({ session: null });
    await expect(svc.resolve(payload())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('token boshqa sessiyaga tegishli bo\'lsa (nishon mos emas) -> 401', async () => {
    const { svc } = makeService({ session: activeSession({ targetUserId: 'someone-else' }) });
    await expect(svc.resolve(payload())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('aktor da\'vosi qator bilan mos kelmasa -> 401', async () => {
    const { svc } = makeService({ session: activeSession({ actorId: 'other-admin' }) });
    await expect(svc.resolve(payload())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('to\'xtatilgan sessiya (ended) -> 401 — token QAYTA ISHLATILMAYDI', async () => {
    const { svc } = makeService({
      session: activeSession({ status: ImpersonationStatus.ended, endedReason: 'manual' }),
    });
    await expect(svc.resolve(payload())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('§6 — muddati o\'tgan sessiya -> 401 VA holat `expired` ga o\'tadi + tugash auditi', async () => {
    const { svc, prisma, audit } = makeService({
      session: activeSession({ expiresAt: new Date(NOW - 1000) }),
    });

    await expect(svc.resolve(payload())).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.impersonationSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'imp1', status: ImpersonationStatus.active },
        data: expect.objectContaining({ status: ImpersonationStatus.expired }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'impersonation.end' }),
    );
  });

  it('§16 — aktor sessiyalari bekor qilinsa (tokenVersion o\'zgardi) -> 401 va sessiya yopiladi', async () => {
    const { svc, prisma } = makeService({ actor: { ...ADMIN, tokenVersion: 99 } });

    await expect(svc.resolve(payload())).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.impersonationSession.updateMany).toHaveBeenCalled();
  });

  it('§16 — aktor roli tushirilsa (MEMBER) -> 401 va sessiya yopiladi', async () => {
    const { svc, prisma } = makeService({ actor: { ...ADMIN, role: UserRole.MEMBER } });

    await expect(svc.resolve(payload())).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.impersonationSession.updateMany).toHaveBeenCalled();
  });

  it('aktor bloklansa -> 401 va sessiya yopiladi', async () => {
    const { svc } = makeService({ actor: { ...ADMIN, blockedAt: new Date() } });
    await expect(svc.resolve(payload())).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

// ----------------------------------------------------------------
// §13 / §17 — tugatish
// ----------------------------------------------------------------
describe('SEC-12 — sessiyani tugatish', () => {
  it('§17 — aniq to\'xtatish atomik va auditlanadi', async () => {
    const { svc, prisma, audit } = makeService();

    await svc.end(activeSession() as never, 'manual');

    expect(prisma.impersonationSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'imp1', status: ImpersonationStatus.active },
        data: expect.objectContaining({ status: ImpersonationStatus.ended, endedReason: 'manual' }),
      }),
    );
    const entry = audit.record.mock.calls[0][0] as Record<string, any>;
    expect(entry.action).toBe('impersonation.end');
    expect(entry.actorId).toBe(ADMIN.id);
    expect(entry.impersonatedUserId).toBe(TARGET.id);
    expect(entry.metadata.endReason).toBe('manual');
  });

  it('§25 — POYGA: ikki parallel to\'xtatishda faqat BITTASI yozadi', async () => {
    const { svc, prisma, audit } = makeService();
    prisma.impersonationSession.updateMany.mockResolvedValueOnce({ count: 0 });

    const result = await svc.end(activeSession() as never, 'manual');

    expect(result).toBeNull();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('§13 — muddat bilan tugash `expired` sifatida FARQLANADI', async () => {
    const { svc, audit } = makeService();

    await svc.end(activeSession() as never, 'expired');

    const entry = audit.record.mock.calls[0][0] as Record<string, any>;
    expect(entry.metadata.endReason).toBe('expired');
  });
});

// ----------------------------------------------------------------
// §7 / §8 — read-only va taqiqlangan yo'llar
// ----------------------------------------------------------------
describe('SEC-12 — ImpersonationGuard (read-only)', () => {
  function ctxFor(method: string, url: string, impersonation?: ImpersonationContext) {
    const request: any = { method, url, originalUrl: url, impersonation };
    return {
      ctx: {
        switchToHttp: () => ({ getRequest: () => request }),
        getHandler: () => () => undefined,
        getClass: () => class {},
      } as unknown as ExecutionContext,
      request,
    };
  }

  const context: ImpersonationContext = {
    impersonationId: 'imp1',
    realActorId: ADMIN.id,
    realActorRole: UserRole.ADMIN,
    realActorEmail: ADMIN.email,
    targetUserId: TARGET.id,
    mode: IMPERSONATION_READ_ONLY,
    issuedAt: new Date(NOW),
    expiresAt: new Date(NOW + 600_000),
  };

  function makeGuard() {
    const impersonation = { recordRequest: jest.fn(async () => undefined) };
    return { guard: new ImpersonationGuard(impersonation as never), impersonation };
  }

  it('impersonation BO\'LMAGAN so\'rovga umuman aralashmaydi', async () => {
    const { guard, impersonation } = makeGuard();
    const { ctx } = ctxFor('POST', '/api/agents');

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(impersonation.recordRequest).not.toHaveBeenCalled();
  });

  it('GET — ruxsat', async () => {
    const { guard } = makeGuard();
    const { ctx } = ctxFor('GET', '/api/agents', context);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it.each(['POST', 'PATCH', 'PUT', 'DELETE'])('%s — 403 (read-only)', async (method) => {
    const { guard } = makeGuard();
    const { ctx } = ctxFor(method, '/api/agents', context);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each([
    ['hisobni o\'chirish', 'DELETE', '/api/users/me'],
    ['profilni o\'zgartirish', 'PATCH', '/api/users/me'],
    ['2FA sozlash', 'POST', '/api/auth/2fa/setup'],
    ['konnektor sirini yozish', 'POST', '/api/connectors/telegram-bot/configure'],
    ['konnektor chaqiruvi', 'POST', '/api/connectors/telegram-bot/invoke'],
    ['to\'lov (topup)', 'POST', '/api/billing/topup'],
    ['obuna', 'POST', '/api/platform/subscribe'],
    ['payout', 'POST', '/api/marketplace/creator/payout'],
    ['qurilma buyrug\'i', 'POST', '/api/device/command'],
    ['xavfli amal', 'POST', '/api/admin/dangerous-actions'],
    ['sessiya yangilash', 'POST', '/api/auth/session/refresh'],
  ])('§8 taqiqlangan amal — %s -> 403', async (_label, method, url) => {
    const { guard } = makeGuard();
    const { ctx } = ctxFor(method, url, context);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each([
    ['qo\'ng\'iroq yozuvi', '/api/device/recordings/rec1'],
    ['qurilma holati', '/api/device/status'],
    ['GDPR eksport', '/api/users/me/export'],
    ['2FA yuzasi', '/api/auth/2fa/setup'],
  ])('§6.6 taqiqlangan O\'QISH — %s -> 403', async (_label, url) => {
    const { guard } = makeGuard();
    const { ctx } = ctxFor('GET', url, context);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rad etilgan so\'rov AUDITLANADI (§13)', async () => {
    const { guard, impersonation } = makeGuard();
    const { ctx } = ctxFor('POST', '/api/agents', context);

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);

    expect(impersonation.recordRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'denied',
        method: 'POST',
        route: 'agents',
        denyReason: 'impersonation_read_only',
      }),
    );
  });

  it('prefiks siyosati: `device` ostidagi YANGI yo\'l ham avtomatik yopiladi', () => {
    expect(isForbiddenImpersonationRead('device/brand-new-endpoint')).toBe(true);
    expect(isForbiddenImpersonationRead('devices')).toBe(false); // prefiks aniq
    expect(isForbiddenImpersonationRead('agents')).toBe(false);
  });
});

// ----------------------------------------------------------------
// §10 — impersonation imtiyozli yo'lga o'ta olmaydi
// ----------------------------------------------------------------
describe('SEC-12 — RolesGuard va impersonation', () => {
  function ctxWith(user: unknown, roles: UserRole[] | undefined, impersonation?: unknown) {
    const request: any = { dbUser: user, impersonation };
    const reflector = {
      getAllAndOverride: (key: string) => (key === ROLES_KEY ? roles : undefined),
    } as unknown as Reflector;
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => () => undefined,
      getClass: () => class {},
    } as unknown as ExecutionContext;
    return { guard: new RolesGuard(reflector), ctx };
  }

  const impersonationCtx = { impersonationId: 'imp1', realActorId: ADMIN.id };

  it('§10 — nishon ADMIN bo\'lsa ham `@Roles(ADMIN)` yo\'li 403 beradi', () => {
    // "Confused deputy": impersonation paytida dbUser — NISHON. Agar rol
    // solishtiruvi ishlaganda edi, SUPPORT operatori ADMIN yuzasiga kirardi.
    const adminTarget = { role: UserRole.ADMIN, twoFactorEnabled: true };
    const { guard, ctx } = ctxWith(adminTarget, [UserRole.ADMIN], impersonationCtx);

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('§10 — OWNER nishon bilan ham `@Roles(OWNER)` yo\'li 403', () => {
    const ownerTarget = { role: UserRole.OWNER, twoFactorEnabled: true };
    const { guard, ctx } = ctxWith(ownerTarget, [UserRole.OWNER], impersonationCtx);

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('impersonationSIZ o\'sha nishon o\'sha yo\'ldan O\'TADI (tekshiruv aynan impersonationga tegishli)', () => {
    const adminUser = { role: UserRole.ADMIN, twoFactorEnabled: true };
    const { guard, ctx } = ctxWith(adminUser, [UserRole.ADMIN], undefined);

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('dekoratorsiz (oddiy foydalanuvchi) yo\'l impersonation uchun OCHIQ qoladi', () => {
    const memberTarget = { role: UserRole.MEMBER, twoFactorEnabled: false };
    const { guard, ctx } = ctxWith(memberTarget, undefined, impersonationCtx);

    expect(guard.canActivate(ctx)).toBe(true);
  });
});

// ----------------------------------------------------------------
// §11 — har so'rov auditi
// ----------------------------------------------------------------
describe('SEC-12 — har so\'rov auditi', () => {
  const context: ImpersonationContext = {
    impersonationId: 'imp1',
    realActorId: ADMIN.id,
    realActorRole: UserRole.ADMIN,
    realActorEmail: ADMIN.email,
    targetUserId: TARGET.id,
    mode: IMPERSONATION_READ_ONLY,
    issuedAt: new Date(NOW),
    expiresAt: new Date(NOW + 600_000),
  };

  it('aktor va nishon ALOHIDA maydonlarda — chalkashtirib bo\'lmaydi', async () => {
    const { svc, audit } = makeService();

    await svc.recordRequest({
      context,
      method: 'GET',
      route: 'agents',
      outcome: 'allowed',
      statusCode: 200,
    });

    const entry = audit.record.mock.calls[0][0] as Record<string, any>;
    expect(entry.actorId).toBe(ADMIN.id); // HAQIQIY operator
    expect(entry.impersonatedUserId).toBe(TARGET.id); // ko'rilgan hisob
    expect(entry.action).toBe('impersonation.request');
    expect(entry.metadata).toEqual(
      expect.objectContaining({ method: 'GET', route: 'agents', statusCode: 200 }),
    );
  });

  it('rad etilgan so\'rov alohida `action` bilan yoziladi', async () => {
    const { svc, audit } = makeService();

    await svc.recordRequest({
      context,
      method: 'POST',
      route: 'agents',
      outcome: 'denied',
      statusCode: 403,
      denyReason: 'impersonation_read_only',
    });

    const entry = audit.record.mock.calls[0][0] as Record<string, any>;
    expect(entry.action).toBe('impersonation.request.denied');
    expect(entry.metadata.denyReason).toBe('impersonation_read_only');
  });

  it('interceptor impersonationSIZ so\'rovga tegmaydi', (done) => {
    const impersonation = { recordRequest: jest.fn(async () => undefined) };
    const interceptor = new ImpersonationAuditInterceptor(impersonation as never);
    const request: any = { method: 'GET', url: '/api/agents' };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({ statusCode: 200 }) }),
    } as unknown as ExecutionContext;
    const next = { handle: () => ({ subscribe: (o: any) => o.complete?.() }) } as never;

    interceptor.intercept(ctx, next);
    expect(impersonation.recordRequest).not.toHaveBeenCalled();
    done();
  });
});

// ----------------------------------------------------------------
// AuthGuard integratsiyasi
// ----------------------------------------------------------------
describe('SEC-12 — AuthGuard impersonation shoxi', () => {
  const noopReflector = { getAllAndOverride: () => undefined } as unknown as Reflector;

  function ctxWith(headers: Record<string, unknown>) {
    const request: any = { headers, method: 'GET', url: '/api/agents' };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => () => undefined,
      getClass: () => class {},
    } as unknown as ExecutionContext;
    return { ctx, request };
  }

  it('impersonation tokeni -> dbUser NISHON, request.impersonation to\'ldiriladi', async () => {
    const { svc } = makeService();
    const prisma = { user: { findUnique: jest.fn() } } as never;
    const guard = new AuthGuard(prisma, noopReflector, svc);
    const { ctx, request } = ctxWith({ authorization: `Bearer ${impToken()}` });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.dbUser.id).toBe(TARGET.id);
    expect(request.impersonation.realActorId).toBe(ADMIN.id);
    expect(request.impersonation.mode).toBe(IMPERSONATION_READ_ONLY);
  });

  it('nishon sessiyalari bekor qilingan bo\'lsa (tv mos emas) -> 401', async () => {
    const { svc } = makeService({ target: { ...TARGET, tokenVersion: 999 } });
    const prisma = { user: { findUnique: jest.fn() } } as never;
    const guard = new AuthGuard(prisma, noopReflector, svc);
    const { ctx } = ctxWith({ authorization: `Bearer ${impToken()}` });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('§24 — BLOKLANGAN nishon uchun impersonation ham ochilmaydi', async () => {
    const { svc } = makeService({ target: { ...TARGET, blockedAt: new Date() } });
    const prisma = { user: { findUnique: jest.fn() } } as never;
    const guard = new AuthGuard(prisma, noopReflector, svc);
    const { ctx } = ctxWith({ authorization: `Bearer ${impToken()}` });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('§24 — bloklangan foydalanuvchining ODDIY sessiyasi 403 oladi', async () => {
    const blocked = { id: 'u1', email: 'a@b', tokenVersion: 0, blockedAt: new Date() };
    const prisma = { user: { findUnique: jest.fn(async () => blocked) } } as never;
    const guard = new AuthGuard(prisma, noopReflector, {} as never);
    const { ctx } = ctxWith({ authorization: `Bearer ${signToken({ sub: 'u1', tv: 0 })}` });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
