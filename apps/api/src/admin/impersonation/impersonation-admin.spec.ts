import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ImpersonationStatus, UserRole, type User } from '@prisma/client';
import { ImpersonationAdminService } from './impersonation-admin.service';
import { IMPERSONATION_MAX_DURATION_MS } from '../../auth/impersonation.policy';

/**
 * SEC-12 §6.6 — impersonation OPERATOR yuzasi (§26 "Authorization",
 * "Notification", "Stop" bloklari).
 *
 * Fail-closed intizom SEC-11 bilan bir xil: har shubhali holatda RAD
 * ETILADI va rad etish AUDITLANADI.
 */

const SUPPORT: User = {
  id: 'sup1',
  email: 'support@a.b',
  role: UserRole.SUPPORT,
  twoFactorEnabled: true,
  tokenVersion: 1,
  blockedAt: null,
} as User;

const OWNER: User = { ...SUPPORT, id: 'own1', email: 'owner@a.b', role: UserRole.OWNER } as User;

const MEMBER = {
  id: 'mem1',
  email: 'member@a.b',
  name: 'Member',
  role: UserRole.MEMBER,
  tokenVersion: 4,
  blockedAt: null,
} as User;

function session(over: Record<string, unknown> = {}) {
  return {
    id: 'imp1',
    status: ImpersonationStatus.active,
    mode: 'READ_ONLY',
    actorId: SUPPORT.id,
    targetUserId: MEMBER.id,
    reason: 'r'.repeat(25),
    actorTokenVersion: SUPPORT.tokenVersion,
    expiresAt: new Date(Date.now() + IMPERSONATION_MAX_DURATION_MS),
    endedAt: null,
    endedReason: null,
    requestCount: 0,
    notifiedAt: null,
    createdAt: new Date(),
    ...over,
  };
}

function makeDeps(
  over: {
    target?: unknown;
    totpValid?: boolean;
    active?: unknown;
    existing?: unknown;
    endResult?: unknown;
  } = {},
) {
  const target = over.target === undefined ? MEMBER : over.target;

  const impersonation = {
    assertActorRoleAllowed: jest.fn(),
    loadTarget: jest.fn(async () => target),
    findActiveByActor: jest.fn(async () => over.existing ?? null),
    findById: jest.fn(async () => over.active ?? session()),
    create: jest.fn(async () => ({
      session: session(),
      token: 'signed.jwt.token',
      expiresAt: session().expiresAt,
    })),
    recordStart: jest.fn(async () => undefined),
    recordStartDenied: jest.fn(async () => undefined) as unknown as jest.Mock<
      Promise<void>,
      [{ denyReason: string }]
    >,
    end: jest.fn(async () =>
      over.endResult === undefined
        ? session({ status: ImpersonationStatus.ended, endedAt: new Date() })
        : over.endResult,
    ),
    markNotified: jest.fn(async () => undefined),
    expireDue: jest.fn(async () => []),
  };
  const twoFactor = { verifyLogin: jest.fn(async () => over.totpValid ?? true) };
  const notifier = { notifyEnded: jest.fn(async () => true) };
  const alerts = { impersonationStarted: jest.fn(async () => undefined) };
  const prisma = { impersonationSession: { findMany: jest.fn(async () => []) } };

  const svc = new ImpersonationAdminService(
    prisma as never,
    impersonation as never,
    twoFactor as never,
    notifier as never,
    alerts as never,
  );
  return { svc, impersonation, twoFactor, notifier, alerts };
}

const dto = { targetUserId: MEMBER.id, reason: 'q'.repeat(25), totp: '123456' };

const denyReasons = (m: { recordStartDenied: jest.Mock<Promise<void>, [{ denyReason: string }]> }) =>
  m.recordStartDenied.mock.calls.map((c) => c[0].denyReason);

// ----------------------------------------------------------------
// Boshlash — avtorizatsiya
// ----------------------------------------------------------------
describe('SEC-12 — impersonation boshlash', () => {
  it('SUPPORT -> MEMBER: token, muddat va rejim qaytadi', async () => {
    const { svc, impersonation, alerts } = makeDeps();

    const res = await svc.start(SUPPORT, dto);

    expect(res.token).toBe('signed.jwt.token');
    expect(res.mode).toBe('READ_ONLY');
    expect(res.maxDurationMs).toBe(IMPERSONATION_MAX_DURATION_MS);
    expect(res.target.id).toBe(MEMBER.id);
    expect(res.actor.id).toBe(SUPPORT.id);
    // §12 — boshlanish auditi va nazorat signali
    expect(impersonation.recordStart).toHaveBeenCalled();
    expect(alerts.impersonationStarted).toHaveBeenCalled();
  });

  it('§6 — muddat 30 daqiqadan oshmaydi', async () => {
    const { svc } = makeDeps();
    const res = await svc.start(SUPPORT, dto);

    const remaining = new Date(res.expiresAt).getTime() - Date.now();
    expect(remaining).toBeLessThanOrEqual(IMPERSONATION_MAX_DURATION_MS + 1000);
  });

  it('MEMBER/VIEWER rad etiladi (rol darvozasi servis ichida ham bor)', async () => {
    const { svc, impersonation } = makeDeps();
    impersonation.assertActorRoleAllowed.mockImplementation(() => {
      throw new ForbiddenException({ reason: 'impersonation_role_forbidden' });
    });

    await expect(
      svc.start({ ...SUPPORT, role: UserRole.MEMBER } as User, dto),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('§9 — OWNER nishonini impersonation qilib bo\'lmaydi', async () => {
    const { svc, impersonation } = makeDeps({ target: { ...MEMBER, role: UserRole.OWNER } });

    await expect(svc.start(OWNER, dto)).rejects.toBeInstanceOf(ForbiddenException);
    expect(denyReasons(impersonation)).toContain('target_role_protected');
    expect(impersonation.create).not.toHaveBeenCalled();
  });

  it('§9 — SUPPORT ADMIN ni impersonation qila olmaydi', async () => {
    const { svc, impersonation } = makeDeps({ target: { ...MEMBER, role: UserRole.ADMIN } });

    await expect(svc.start(SUPPORT, dto)).rejects.toBeInstanceOf(ForbiddenException);
    expect(denyReasons(impersonation)).toContain('target_role_protected');
  });

  it('§15 — o\'zini impersonation qilish taqiqlangan', async () => {
    const { svc, impersonation } = makeDeps();

    await expect(
      svc.start(SUPPORT, { ...dto, targetUserId: SUPPORT.id }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(denyReasons(impersonation)).toContain('self_impersonation_forbidden');
  });

  it('§15 — mavjud bo\'lmagan nishon -> 404 (va auditlanadi)', async () => {
    const { svc, impersonation } = makeDeps({ target: null });

    await expect(svc.start(SUPPORT, dto)).rejects.toBeInstanceOf(NotFoundException);
    expect(denyReasons(impersonation)).toContain('target_not_found');
  });

  it('§15 — bloklangan nishon uchun sessiya ochilmaydi', async () => {
    const { svc, impersonation } = makeDeps({ target: { ...MEMBER, blockedAt: new Date() } });

    await expect(svc.start(SUPPORT, dto)).rejects.toBeInstanceOf(BadRequestException);
    expect(denyReasons(impersonation)).toContain('target_blocked');
  });
});

// ----------------------------------------------------------------
// Boshlash — qayta autentifikatsiya
// ----------------------------------------------------------------
describe('SEC-12 — TOTP qayta-autentifikatsiya', () => {
  it('2FA yoqilmagan operator -> 403, sessiya YARATILMAYDI', async () => {
    const { svc, impersonation } = makeDeps();

    await expect(
      svc.start({ ...SUPPORT, twoFactorEnabled: false } as User, dto),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(impersonation.create).not.toHaveBeenCalled();
    expect(denyReasons(impersonation)).toContain('two_factor_required');
  });

  it('noto\'g\'ri TOTP -> 401, sessiya YARATILMAYDI', async () => {
    const { svc, impersonation } = makeDeps({ totpValid: false });

    await expect(svc.start(SUPPORT, dto)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(impersonation.create).not.toHaveBeenCalled();
    expect(denyReasons(impersonation)).toContain('invalid_totp');
  });
});

// ----------------------------------------------------------------
// Bir vaqtda bitta sessiya
// ----------------------------------------------------------------
describe('SEC-12 — parallel sessiyalar', () => {
  it('yangi sessiya ochilishidan oldin operatorning eskisi YOPILADI', async () => {
    const old = session({ id: 'old-imp' });
    const { svc, impersonation, notifier } = makeDeps({ existing: old });

    await svc.start(SUPPORT, dto);

    expect(impersonation.end).toHaveBeenCalledWith(old, 'manual');
    // Eski sessiya yopilgani uchun nishonga bildirishnoma ham chiqadi
    expect(notifier.notifyEnded).toHaveBeenCalled();
  });
});

// ----------------------------------------------------------------
// To'xtatish (§17) va bildirishnoma (§21)
// ----------------------------------------------------------------
describe('SEC-12 — to\'xtatish', () => {
  it('egasi to\'xtata oladi; nishonga bildirishnoma yuboriladi', async () => {
    const { svc, impersonation, notifier } = makeDeps();

    const res = await svc.stop(SUPPORT, 'imp1');

    expect(res.alreadyEnded).toBe(false);
    expect(impersonation.end).toHaveBeenCalledWith(expect.objectContaining({ id: 'imp1' }), 'manual');
    expect(notifier.notifyEnded).toHaveBeenCalled();
    expect(impersonation.markNotified).toHaveBeenCalledWith('imp1');
  });

  it('OWNER boshqa operatorning sessiyasini to\'xtata oladi (nazorat)', async () => {
    const { svc } = makeDeps();
    await expect(svc.stop(OWNER, 'imp1')).resolves.toEqual(
      expect.objectContaining({ alreadyEnded: false }),
    );
  });

  it('begona operator (ADMIN, egasi emas) to\'xtata OLMAYDI', async () => {
    const { svc } = makeDeps();
    const stranger = { ...SUPPORT, id: 'other', role: UserRole.ADMIN } as User;

    await expect(svc.stop(stranger, 'imp1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('mavjud bo\'lmagan sessiya -> 404', async () => {
    const { svc, impersonation } = makeDeps();
    impersonation.findById.mockResolvedValueOnce(null as never);

    await expect(svc.stop(SUPPORT, 'nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allaqachon tugagan sessiyani to\'xtatish IDEMPOTENT (qayta audit yozilmaydi)', async () => {
    const { svc, impersonation } = makeDeps({
      active: session({ status: ImpersonationStatus.ended }),
    });

    const res = await svc.stop(SUPPORT, 'imp1');

    expect(res.alreadyEnded).toBe(true);
    expect(impersonation.end).not.toHaveBeenCalled();
  });

  it('§25 — poygada `end()` null qaytarsa, bildirishnoma TAKRORLANMAYDI', async () => {
    const { svc, notifier } = makeDeps({ endResult: null });

    await svc.stop(SUPPORT, 'imp1');

    expect(notifier.notifyEnded).not.toHaveBeenCalled();
  });

  it('allaqachon xabar berilgan sessiya uchun bildirishnoma qayta yuborilmaydi', async () => {
    const { svc, notifier } = makeDeps({
      endResult: session({ status: ImpersonationStatus.ended, notifiedAt: new Date() }),
    });

    await svc.stop(SUPPORT, 'imp1');

    expect(notifier.notifyEnded).not.toHaveBeenCalled();
  });
});

// ----------------------------------------------------------------
// Muddati o'tganlarni tozalash (§13)
// ----------------------------------------------------------------
describe('SEC-12 — muddat tozalash', () => {
  it('muddati o\'tgan sessiyalar yopiladi va nishonga xabar beriladi', async () => {
    const expired = session({ status: ImpersonationStatus.expired, endedAt: new Date() });
    const { svc, impersonation, notifier } = makeDeps();
    impersonation.expireDue.mockResolvedValueOnce([expired] as never);

    await svc.expireDueSessions();

    expect(notifier.notifyEnded).toHaveBeenCalledTimes(1);
  });

  it('xato bo\'lsa cron yiqilmaydi (log bilan yutiladi)', async () => {
    const { svc, impersonation } = makeDeps();
    impersonation.expireDue.mockRejectedValueOnce(new Error('db down') as never);

    await expect(svc.expireDueSessions()).resolves.toBeUndefined();
  });
});
