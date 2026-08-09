import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { DangerousActionKind, DangerousActionStatus, UserRole } from '@prisma/client';
import { DangerousActionService } from './dangerous-action.service';
import { APPROVAL_WINDOW_MS, expectedConfirmation } from './dangerous-action.registry';
import type { User } from '@prisma/client';

/**
 * SEC-11 §6.5 — xavfli amallar frameworki.
 *
 * Bu testlar oqimning HAR BIR majburiy bosqichini va holat mashinasining
 * HAR BIR taqiqlangan o'tishini qulflaydi. Xavfli amal "fail-closed"
 * bo'lishi shart: har qanday shubhali holatda RAD ETILADI.
 */

const OWNER: User = {
  id: 'owner1',
  email: 'owner@a.b',
  role: UserRole.OWNER,
  twoFactorEnabled: true,
} as User;

interface TargetUser {
  id: string;
  email: string;
  role: UserRole;
  twoFactorEnabled: boolean;
}

const TARGET: TargetUser = {
  id: 'target1',
  email: 'target@a.b',
  role: UserRole.MEMBER,
  twoFactorEnabled: true,
};

function makeDeps(overrides: { target?: TargetUser | null; ownerCount?: number } = {}) {
  const target = overrides.target === undefined ? TARGET : overrides.target;

  const prisma = {
    user: {
      findUnique: jest.fn(async () => target),
      count: jest.fn(async () => overrides.ownerCount ?? 2),
      update: jest.fn(async () => ({ tokenVersion: 7 })),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    dangerousAction: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'act1',
        status: DangerousActionStatus.pending,
        ...data,
      })),
      findUnique: jest.fn(async () => null),
      updateMany: jest.fn(async () => ({ count: 1 })) as unknown as jest.Mock<
        Promise<{ count: number }>,
        [{ where: Record<string, unknown>; data: Record<string, unknown> }]
      >,
    },
  };
  const twoFactor = { verifyLogin: jest.fn(async () => true) };
  const audit = {
    record: jest.fn(async () => undefined) as unknown as jest.Mock<
      Promise<void>,
      [{ action: string; metadata: Record<string, unknown> }]
    >,
  };
  const alerts = { dangerousActionRequested: jest.fn(async () => undefined) };

  const svc = new DangerousActionService(
    prisma as never,
    twoFactor as never,
    audit as never,
    alerts as never,
  );
  return { svc, prisma, twoFactor, audit, alerts };
}

const validRequest = {
  kind: DangerousActionKind.role_assign,
  targetUserId: TARGET.id,
  reason: 'Bu foydalanuvchi qo\'llab-quvvatlash jamoasiga qo\'shildi',
  totp: '123456',
  confirmation: expectedConfirmation(DangerousActionKind.role_assign, TARGET.id),
  newRole: UserRole.SUPPORT,
};

/** `pending` amal yozuvi (holat-mashina testlari uchun). */
function pendingAction(over: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    id: 'act1',
    kind: DangerousActionKind.session_revoke,
    status: DangerousActionStatus.pending,
    actorId: OWNER.id,
    targetUserId: TARGET.id,
    reason: 'x'.repeat(25),
    payload: {},
    executableAfter: new Date(now - 1000),
    expiresAt: new Date(now + APPROVAL_WINDOW_MS),
    executedAt: null,
    cancelledAt: null,
    cancelledById: null,
    createdAt: new Date(now),
    ...over,
  };
}

// ----------------------------------------------------------------
// §6.5(2) TOTP qayta-autentifikatsiya
// ----------------------------------------------------------------
describe('SEC-11 — TOTP qayta-autentifikatsiya', () => {
  it("noto'g'ri TOTP -> Unauthorized, amal YARATILMAYDI", async () => {
    const { svc, twoFactor, prisma } = makeDeps();
    twoFactor.verifyLogin.mockResolvedValue(false);

    await expect(svc.request(OWNER, validRequest)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.dangerousAction.create).not.toHaveBeenCalled();
  });

  it("2FA YOQILMAGAN aktor -> rad etiladi (verifyLogin'ning login-semantikasiga tayanmaydi)", async () => {
    // `TwoFactorService.verifyLogin` 2FA o'chiq bo'lsa `true` qaytaradi —
    // bu login uchun to'g'ri, xavfli amal uchun XAVFLI. Framework buni
    // alohida tekshiradi.
    const { svc, twoFactor, prisma } = makeDeps();
    const noTwoFa = { ...OWNER, twoFactorEnabled: false } as User;

    await expect(svc.request(noTwoFa, validRequest)).rejects.toBeInstanceOf(ForbiddenException);
    expect(twoFactor.verifyLogin).not.toHaveBeenCalled();
    expect(prisma.dangerousAction.create).not.toHaveBeenCalled();
  });

  it('bajarish bosqichida TOTP QAYTA so\'raladi (24s oyna ichida o\'g\'irlangan sessiya ijro etolmasin)', async () => {
    const { svc, prisma, twoFactor } = makeDeps();
    prisma.dangerousAction.findUnique.mockResolvedValue(pendingAction() as never);
    twoFactor.verifyLogin.mockResolvedValue(false);

    await expect(svc.execute(OWNER, 'act1', { totp: '000000' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.dangerousAction.updateMany).not.toHaveBeenCalled();
  });
});

// ----------------------------------------------------------------
// §6.5(3) Yozib tasdiqlash
// ----------------------------------------------------------------
describe('SEC-11 — yozib tasdiqlash', () => {
  it("noto'g'ri tasdiqlash satri -> rad etiladi", async () => {
    const { svc, prisma } = makeDeps();
    await expect(
      svc.request(OWNER, { ...validRequest, confirmation: 'ROLE boshqa-id' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.dangerousAction.create).not.toHaveBeenCalled();
  });

  it("mijoz bayrog'i ('confirmed: true') tasdiq o'rnini BOSMAYDI", async () => {
    const { svc } = makeDeps();
    await expect(
      svc.request(OWNER, { ...validRequest, confirmation: 'true' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("to'g'ri satr (VERB + targetId) -> qabul qilinadi", async () => {
    const { svc, prisma } = makeDeps();
    await svc.request(OWNER, validRequest);
    expect(prisma.dangerousAction.create).toHaveBeenCalledTimes(1);
  });
});

// ----------------------------------------------------------------
// §6.1 Avtorizatsiya
// ----------------------------------------------------------------
describe('SEC-11 — avtorizatsiya (registr darajasida)', () => {
  it.each([UserRole.ADMIN, UserRole.SUPPORT, UserRole.MEMBER, UserRole.VIEWER])(
    '%s rol tayinlay OLMAYDI (faqat OWNER)',
    async (role) => {
      const { svc, prisma } = makeDeps();
      const actor = { ...OWNER, role } as User;
      await expect(svc.request(actor, validRequest)).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.dangerousAction.create).not.toHaveBeenCalled();
    },
  );

  it('SUPPORT sessiya bekor qila OLMAYDI', async () => {
    const { svc } = makeDeps();
    const support = { ...OWNER, role: UserRole.SUPPORT } as User;
    await expect(
      svc.request(support, {
        ...validRequest,
        kind: DangerousActionKind.session_revoke,
        confirmation: expectedConfirmation(DangerousActionKind.session_revoke, TARGET.id),
        newRole: undefined,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('bajarish bosqichida ham rol tekshiriladi (tasdiq berilgan bo\'lsa ham)', async () => {
    const { svc, prisma } = makeDeps();
    prisma.dangerousAction.findUnique.mockResolvedValue(pendingAction() as never);
    const admin = { ...OWNER, role: UserRole.ADMIN } as User;

    await expect(svc.execute(admin, 'act1', { totp: '123456' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});

// ----------------------------------------------------------------
// Rol tayinlash invariantlari
// ----------------------------------------------------------------
describe('SEC-11 — rol tayinlash invariantlari', () => {
  it("O'ZINI ko'tarish/tushirish taqiqlanadi", async () => {
    const { svc } = makeDeps({ target: { ...TARGET, id: OWNER.id } });
    await expect(
      svc.request(OWNER, {
        ...validRequest,
        targetUserId: OWNER.id,
        confirmation: expectedConfirmation(DangerousActionKind.role_assign, OWNER.id),
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("2FA'siz foydalanuvchiga OWNER/ADMIN BERILMAYDI (Konstitutsiya #10)", async () => {
    const { svc } = makeDeps({ target: { ...TARGET, twoFactorEnabled: false } });
    await expect(
      svc.request(OWNER, { ...validRequest, newRole: UserRole.ADMIN }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("2FA'siz foydalanuvchiga imtiyozsiz rol BERILADI", async () => {
    const { svc, prisma } = makeDeps({ target: { ...TARGET, twoFactorEnabled: false } });
    await svc.request(OWNER, { ...validRequest, newRole: UserRole.VIEWER });
    expect(prisma.dangerousAction.create).toHaveBeenCalledTimes(1);
  });

  it('OXIRGI OWNER rolini tushirib bo\'lmaydi (§6.7 bus factor)', async () => {
    const { svc } = makeDeps({
      target: { ...TARGET, role: UserRole.OWNER },
      ownerCount: 1,
    });
    await expect(
      svc.request(OWNER, { ...validRequest, newRole: UserRole.ADMIN }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('ikkinchi OWNER bor bo\'lsa tushirish mumkin', async () => {
    const { svc, prisma } = makeDeps({
      target: { ...TARGET, role: UserRole.OWNER },
      ownerCount: 2,
    });
    await svc.request(OWNER, { ...validRequest, newRole: UserRole.ADMIN });
    expect(prisma.dangerousAction.create).toHaveBeenCalledTimes(1);
  });

  it("bir xil rol -> rad etiladi (ma'nosiz amal)", async () => {
    const { svc } = makeDeps();
    await expect(
      svc.request(OWNER, { ...validRequest, newRole: UserRole.MEMBER }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('`newRole` berilmasa -> rad etiladi', async () => {
    const { svc } = makeDeps();
    await expect(
      svc.request(OWNER, { ...validRequest, newRole: undefined }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('nishon topilmasa -> NotFound', async () => {
    const { svc } = makeDeps({ target: null });
    await expect(svc.request(OWNER, validRequest)).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ----------------------------------------------------------------
// §6.5(4) Ikkita audit yozuvi + §6.5(6) signal
// ----------------------------------------------------------------
describe('SEC-11 — audit va signal', () => {
  it("so'rovda `intent` audit yoziladi (sabab bilan) va OWNER signali ketadi", async () => {
    const { svc, audit, alerts } = makeDeps();
    await svc.request(OWNER, validRequest);

    expect(audit.record).toHaveBeenCalledTimes(1);
    const entry = audit.record.mock.calls[0][0];
    expect(entry.action).toBe('dangerous.role_assign.intent');
    expect(entry.metadata).toEqual(
      expect.objectContaining({ reason: validRequest.reason, newRole: UserRole.SUPPORT }),
    );
    expect(alerts.dangerousActionRequested).toHaveBeenCalledTimes(1);
  });

  it('bajarishda `result` audit yoziladi (ikkinchi yozuv)', async () => {
    const { svc, prisma, audit } = makeDeps();
    prisma.dangerousAction.findUnique.mockResolvedValue(pendingAction() as never);

    await svc.execute(OWNER, 'act1', { totp: '123456' });

    const actions = audit.record.mock.calls.map((c) => c[0].action);
    expect(actions).toEqual(['dangerous.session_revoke.result']);
  });

  it('bekor qilishda ham audit yoziladi', async () => {
    const { svc, prisma, audit } = makeDeps();
    prisma.dangerousAction.findUnique.mockResolvedValue(pendingAction() as never);

    await svc.cancel(OWNER, 'act1');

    expect(audit.record.mock.calls[0][0].action).toBe(
      'dangerous.session_revoke.cancelled',
    );
  });
});

// ----------------------------------------------------------------
// Holat mashinasi
// ----------------------------------------------------------------
describe('SEC-11 — holat mashinasi', () => {
  it.each([DangerousActionStatus.executed, DangerousActionStatus.cancelled, DangerousActionStatus.expired])(
    '`%s` holatdagi amal BAJARILMAYDI',
    async (status) => {
      const { svc, prisma } = makeDeps();
      prisma.dangerousAction.findUnique.mockResolvedValue(pendingAction({ status }) as never);
      await expect(svc.execute(OWNER, 'act1', { totp: '123456' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    },
  );

  it.each([DangerousActionStatus.executed, DangerousActionStatus.cancelled])(
    '`%s` holatdagi amal BEKOR QILINMAYDI',
    async (status) => {
      const { svc, prisma } = makeDeps();
      prisma.dangerousAction.findUnique.mockResolvedValue(pendingAction({ status }) as never);
      await expect(svc.cancel(OWNER, 'act1')).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it("muddati o'tgan tasdiq BAJARILMAYDI va `expired` ga o'tkaziladi", async () => {
    const { svc, prisma } = makeDeps();
    prisma.dangerousAction.findUnique.mockResolvedValue(
      pendingAction({ expiresAt: new Date(Date.now() - 1000) }) as never,
    );

    await expect(svc.execute(OWNER, 'act1', { totp: '123456' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.dangerousAction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: DangerousActionStatus.expired } }),
    );
  });

  it("muddati o'tgan tasdiq BEKOR ham QILINMAYDI", async () => {
    const { svc, prisma } = makeDeps();
    prisma.dangerousAction.findUnique.mockResolvedValue(
      pendingAction({ expiresAt: new Date(Date.now() - 1000) }) as never,
    );
    await expect(svc.cancel(OWNER, 'act1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('kutish muddati tugamagan amal bajarilmaydi (o\'chirish sinfi uchun)', async () => {
    const { svc, prisma } = makeDeps();
    prisma.dangerousAction.findUnique.mockResolvedValue(
      pendingAction({ executableAfter: new Date(Date.now() + 60_000) }) as never,
    );
    await expect(svc.execute(OWNER, 'act1', { totp: '123456' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('mavjud bo\'lmagan amal -> NotFound', async () => {
    const { svc } = makeDeps();
    await expect(svc.execute(OWNER, 'yoq', { totp: '123456' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

// ----------------------------------------------------------------
// Poyga / takroriy so'rov
// ----------------------------------------------------------------
describe('SEC-11 — poyga va takroriylik', () => {
  it('TAKRORIY bajarish: shartli UPDATE 0 qator qaytarsa rad etiladi', async () => {
    const { svc, prisma } = makeDeps();
    prisma.dangerousAction.findUnique.mockResolvedValue(pendingAction() as never);
    // Parallel `execute` allaqachon `pending -> executed` ni egallab olgan.
    prisma.dangerousAction.updateMany.mockResolvedValue({ count: 0 } as never);

    await expect(svc.execute(OWNER, 'act1', { totp: '123456' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    // Amalning O'ZI bajarilmaydi (sessiya bekor qilinmaydi).
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('execute vs cancel poygasi: cancel 0 qator olsa rad etiladi', async () => {
    const { svc, prisma } = makeDeps();
    prisma.dangerousAction.findUnique.mockResolvedValue(pendingAction() as never);
    prisma.dangerousAction.updateMany.mockResolvedValue({ count: 0 } as never);

    await expect(svc.cancel(OWNER, 'act1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it("bajarish YIQILSA holat `pending` ga QAYTADI (amal 'bajarilgan' bo'lib qolmaydi)", async () => {
    const { svc, prisma } = makeDeps();
    prisma.dangerousAction.findUnique.mockResolvedValue(pendingAction() as never);
    prisma.user.update.mockRejectedValue(new Error('DB yiqildi'));

    await expect(svc.execute(OWNER, 'act1', { totp: '123456' })).rejects.toThrow('DB yiqildi');

    const revert = prisma.dangerousAction.updateMany.mock.calls.at(-1)![0];
    expect(revert.data).toEqual({ status: DangerousActionStatus.pending, executedAt: null });
  });

  it('rol o\'zgargan bo\'lsa (poyga) eskirgan qaror QO\'LLANMAYDI', async () => {
    const { svc, prisma } = makeDeps();
    prisma.dangerousAction.findUnique.mockResolvedValue(
      pendingAction({
        kind: DangerousActionKind.role_assign,
        payload: { previousRole: UserRole.MEMBER, newRole: UserRole.SUPPORT },
      }) as never,
    );
    // `where: { role: previousRole }` mos kelmadi.
    prisma.user.updateMany.mockResolvedValue({ count: 0 } as never);

    await expect(svc.execute(OWNER, 'act1', { totp: '123456' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

// ----------------------------------------------------------------
// Amallarning O'ZI
// ----------------------------------------------------------------
describe('SEC-11 — sessiya bekor qilish', () => {
  it('mavjud `tokenVersion` mexanizmini ishlatadi (parallel mexanizm YO\'Q)', async () => {
    const { svc, prisma } = makeDeps();
    prisma.dangerousAction.findUnique.mockResolvedValue(pendingAction() as never);

    const res = await svc.execute(OWNER, 'act1', { totp: '123456' });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TARGET.id },
        data: { tokenVersion: { increment: 1 } },
      }),
    );
    expect(res).toEqual(expect.objectContaining({ sessionsRevoked: true, tokenVersion: 7 }));
  });
});

describe('SEC-11 — rol tayinlash bajarilishi', () => {
  it('rol ATOMIK o\'zgaradi va sessiyalar bekor qilinadi', async () => {
    const { svc, prisma } = makeDeps();
    prisma.dangerousAction.findUnique.mockResolvedValue(
      pendingAction({
        kind: DangerousActionKind.role_assign,
        payload: { previousRole: UserRole.MEMBER, newRole: UserRole.SUPPORT },
      }) as never,
    );

    const res = await svc.execute(OWNER, 'act1', { totp: '123456' });

    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      // Shartli: rol hali ham kutilgan qiymatda bo'lsagina o'zgaradi.
      where: { id: TARGET.id, role: UserRole.MEMBER },
      data: { role: UserRole.SUPPORT, tokenVersion: { increment: 1 } },
    });
    expect(res).toEqual(
      expect.objectContaining({ previousRole: UserRole.MEMBER, newRole: UserRole.SUPPORT }),
    );
  });
});
