import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DangerousActionKind, DangerousActionStatus, UserRole, type User } from '@prisma/client';
import { DangerousActionService } from './dangerous-action.service';
import {
  ADMIN_DAILY_CREDIT_CAP_TIYIN,
  APPROVAL_WINDOW_MS,
  DANGEROUS_ACTIONS,
  MAX_SINGLE_CREDIT_TIYIN,
  expectedConfirmation,
} from './dangerous-action.registry';

/**
 * SEC-12 — "Users yozish amallari": QO'LDA KREDIT va BLOK/BLOKDAN CHIQARISH
 * (§22–§25, §26 dagi "Manual credit" va "Block/unblock" bloklari).
 *
 * ASOSIY DA'VO: bu amallar IKKINCHI tasdiqlash mexanizmini yaratmaydi —
 * ular SEC-11 frameworkining O'ZIDAN o'tadi (sabab + TOTP + yozib
 * tasdiqlash + ikkita audit yozuvi + holat mashinasi). Shu sababli bu
 * yerda faqat YANGI qoidalar tekshiriladi; oqimning o'zi
 * `dangerous-action.spec.ts` da allaqachon qulflangan.
 */

const OWNER: User = {
  id: 'owner1',
  email: 'owner@a.b',
  role: UserRole.OWNER,
  twoFactorEnabled: true,
} as User;

const ADMIN: User = { ...OWNER, id: 'admin1', email: 'admin@a.b', role: UserRole.ADMIN } as User;

interface TargetRow {
  id: string;
  email: string;
  role: UserRole;
  twoFactorEnabled: boolean;
  blockedAt: Date | null;
}

const TARGET: TargetRow = {
  id: 'target1',
  email: 'target@a.b',
  role: UserRole.MEMBER,
  twoFactorEnabled: false,
  blockedAt: null,
};

function makeDeps(
  over: { target?: TargetRow | null; executedCredits?: string[]; blockCount?: number } = {},
) {
  const target = over.target === undefined ? TARGET : over.target;

  const walletCredit = jest.fn(async () => ({ id: 'led1', balanceAfter: 123_456n }));

  const prisma = {
    user: {
      findUnique: jest.fn(async () => target),
      count: jest.fn(async () => 2),
      update: jest.fn(async () => ({ tokenVersion: 9 })),
      updateMany: jest.fn(async () => ({ count: over.blockCount ?? 1 })) as unknown as jest.Mock<
        Promise<{ count: number }>,
        [{ where: Record<string, unknown>; data: Record<string, any> }]
      >,
    },
    dangerousAction: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'act1',
        status: DangerousActionStatus.pending,
        ...data,
      })),
      findUnique: jest.fn(async () => null),
      findMany: jest.fn(async () =>
        (over.executedCredits ?? []).map((amountTiyin) => ({ payload: { amountTiyin } })),
      ),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    // `$transaction(cb)` — callback shaklida chaqiriladi; lock uchun
    // `$executeRaw` mavjud bo'lishi kifoya.
    $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        $executeRaw: jest.fn(async () => 1),
        dangerousAction: {
          findMany: jest.fn(async () =>
            (over.executedCredits ?? []).map((amountTiyin) => ({ payload: { amountTiyin } })),
          ),
        },
      }),
    ),
  };

  const twoFactor = { verifyLogin: jest.fn(async () => true) };
  const audit = {
    record: jest.fn(async () => undefined) as unknown as jest.Mock<
      Promise<void>,
      [Record<string, any>]
    >,
  };
  const alerts = { dangerousActionRequested: jest.fn(async () => undefined) };
  const wallet = { credit: walletCredit };

  const svc = new DangerousActionService(
    prisma as never,
    twoFactor as never,
    audit as never,
    alerts as never,
    wallet as never,
  );
  return { svc, prisma, audit, wallet, walletCredit };
}

function creditDto(over: Record<string, unknown> = {}) {
  // Tasdiqlash satri NISHONGA bog'liq (server o'zi hisoblaydi) — nishonni
  // almashtirgan test satrni ham mos ravishda olishi kerak, aks holda
  // tekshiruv oldinroq (confirmation_mismatch) yiqilardi.
  const targetUserId = (over.targetUserId as string) ?? TARGET.id;
  return {
    kind: DangerousActionKind.credit_manual,
    targetUserId,
    reason: 'Kompensatsiya: uzilish tufayli yo\'qolgan balans qaytarilmoqda',
    totp: '123456',
    confirmation: expectedConfirmation(DangerousActionKind.credit_manual, targetUserId),
    amountTiyin: '1000000', // 10 000 so'm
    ...over,
  };
}

function blockDto(kind: DangerousActionKind, over: Record<string, unknown> = {}) {
  const targetUserId = (over.targetUserId as string) ?? TARGET.id;
  return {
    kind,
    targetUserId,
    reason: 'Spam va suiiste\'mol: hisob vaqtincha to\'xtatilmoqda',
    totp: '123456',
    confirmation: expectedConfirmation(kind, targetUserId),
    ...over,
  };
}

/** `pending` qator — bajarish testlari uchun. */
function pending(
  kind: DangerousActionKind,
  payload: Record<string, unknown>,
  actorId: string = ADMIN.id,
) {
  const now = Date.now();
  return {
    id: 'act1',
    kind,
    status: DangerousActionStatus.pending,
    actorId,
    targetUserId: TARGET.id,
    reason: 'r'.repeat(25),
    payload,
    executableAfter: new Date(now - 1000),
    expiresAt: new Date(now + APPROVAL_WINDOW_MS),
    executedAt: null,
    cancelledAt: null,
    cancelledById: null,
    createdAt: new Date(now),
  };
}

// ----------------------------------------------------------------
// §22 — registr orqali o'tish
// ----------------------------------------------------------------
describe('SEC-12 — yozish amallari registrda', () => {
  it('uchala amal ham SEC-11 registrida e\'lon qilingan', () => {
    expect(DANGEROUS_ACTIONS.credit_manual).toBeDefined();
    expect(DANGEROUS_ACTIONS.user_block).toBeDefined();
    expect(DANGEROUS_ACTIONS.user_unblock).toBeDefined();
  });

  it('§6.1 — SUPPORT bu amallarni bajara olmaydi', () => {
    for (const kind of ['credit_manual', 'user_block', 'user_unblock'] as const) {
      expect(DANGEROUS_ACTIONS[kind].allowedRoles).not.toContain(UserRole.SUPPORT);
      expect(DANGEROUS_ACTIONS[kind].allowedRoles).toEqual(
        expect.arrayContaining([UserRole.OWNER, UserRole.ADMIN]),
      );
    }
  });

  it('rol tayinlash / sessiya bekor qilish FAQAT OWNER da qoladi (controller kengayganidan keyin ham)', () => {
    expect(DANGEROUS_ACTIONS.role_assign.allowedRoles).toEqual([UserRole.OWNER]);
    expect(DANGEROUS_ACTIONS.session_revoke.allowedRoles).toEqual([UserRole.OWNER]);
  });

  it('SUPPORT qo\'lda kredit so\'rasa -> 403', async () => {
    const { svc, prisma } = makeDeps();
    const support = { ...ADMIN, role: UserRole.SUPPORT } as User;

    await expect(svc.request(support, creditDto())).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.dangerousAction.create).not.toHaveBeenCalled();
  });
});

// ----------------------------------------------------------------
// §23 — qo'lda kredit: validatsiya
// ----------------------------------------------------------------
describe('SEC-12 — qo\'lda kredit validatsiyasi', () => {
  it('summasiz so\'rov rad etiladi', async () => {
    const { svc } = makeDeps();
    await expect(
      svc.request(OWNER, creditDto({ amountTiyin: undefined })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('nol summa rad etiladi', async () => {
    const { svc } = makeDeps();
    await expect(svc.request(OWNER, creditDto({ amountTiyin: '0' }))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('MANFIY summa rad etiladi — "kredit" orqali balans yechib bo\'lmaydi', async () => {
    const { svc } = makeDeps();
    await expect(svc.request(OWNER, creditDto({ amountTiyin: '-500' }))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('bitta amaldagi mutlaq chegaradan katta summa rad etiladi', async () => {
    const { svc } = makeDeps();
    const tooBig = (MAX_SINGLE_CREDIT_TIYIN + 1n).toString();

    await expect(svc.request(OWNER, creditDto({ amountTiyin: tooBig }))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('O\'ZIGA kredit yozish taqiqlangan', async () => {
    const { svc } = makeDeps({ target: { ...TARGET, id: OWNER.id } });

    await expect(
      svc.request(OWNER, creditDto({ targetUserId: OWNER.id })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('yaroqli so\'rov -> `pending` amal, summa payload\'da SATR sifatida', async () => {
    const { svc, prisma } = makeDeps();

    await svc.request(OWNER, creditDto());

    const created = prisma.dangerousAction.create.mock.calls[0][0].data as Record<string, any>;
    expect(created.kind).toBe(DangerousActionKind.credit_manual);
    expect(created.payload).toEqual({ amountTiyin: '1000000' });
  });
});

// ----------------------------------------------------------------
// §6.1 — ADMIN kunlik chegarasi
// ----------------------------------------------------------------
describe('SEC-12 — ADMIN kunlik kredit chegarasi (500k so\'m)', () => {
  it('chegara ichidagi summa o\'tadi', async () => {
    const { svc } = makeDeps({ executedCredits: ['10000000'] }); // 100k so'm
    await expect(svc.request(ADMIN, creditDto({ amountTiyin: '10000000' }))).resolves.toBeDefined();
  });

  it('chegaradan oshsa -> 403', async () => {
    const { svc } = makeDeps({ executedCredits: [ADMIN_DAILY_CREDIT_CAP_TIYIN.toString()] });

    await expect(svc.request(ADMIN, creditDto({ amountTiyin: '1' }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('OWNER chegara bilan CHEKLANMAYDI', async () => {
    const { svc } = makeDeps({ executedCredits: [ADMIN_DAILY_CREDIT_CAP_TIYIN.toString()] });

    await expect(
      svc.request(OWNER, creditDto({ amountTiyin: MAX_SINGLE_CREDIT_TIYIN.toString() })),
    ).resolves.toBeDefined();
  });

  it('§25 — chegara BAJARISH bosqichida (lock ostida) QAYTA tekshiriladi', async () => {
    // So'rov paytida chegara bo'sh edi; bajarishgacha boshqa kreditlar
    // o'tib ketdi -> bajarish RAD etiladi va pul YOZILMAYDI.
    const { svc, prisma, walletCredit } = makeDeps({
      executedCredits: [ADMIN_DAILY_CREDIT_CAP_TIYIN.toString()],
    });
    prisma.dangerousAction.findUnique.mockResolvedValue(
      pending(DangerousActionKind.credit_manual, { amountTiyin: '1000000' }) as never,
    );

    await expect(svc.execute(ADMIN, 'act1', { totp: '123456' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(walletCredit).not.toHaveBeenCalled();
    // Holat `pending` ga QAYTARILADI — amal "bajarilgan" bo'lib qolmaydi
    expect(prisma.dangerousAction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: DangerousActionStatus.pending }),
      }),
    );
  });
});

// ----------------------------------------------------------------
// §23 — bajarish: atomik pul yo'li
// ----------------------------------------------------------------
describe('SEC-12 — qo\'lda kredit bajarilishi', () => {
  function armExecute(deps: ReturnType<typeof makeDeps>, actorId: string = OWNER.id) {
    deps.prisma.dangerousAction.findUnique.mockResolvedValue(
      pending(DangerousActionKind.credit_manual, { amountTiyin: '1000000' }, actorId) as never,
    );
  }

  it('MAVJUD `WalletCreditService` orqali, `admin_credit` daftar turi bilan', async () => {
    const deps = makeDeps();
    armExecute(deps);

    const res = (await deps.svc.execute(OWNER, 'act1', { totp: '123456' })) as Record<string, any>;

    expect(deps.walletCredit).toHaveBeenCalledTimes(1);
    const [userId, amount, meta, , kind] = deps.walletCredit.mock.calls[0] as unknown as [
      string,
      bigint,
      Record<string, unknown>,
      unknown,
      string,
    ];
    expect(userId).toBe(TARGET.id);
    expect(amount).toBe(1_000_000n);
    expect(kind).toBe('admin_credit');
    expect(meta).toEqual(
      expect.objectContaining({ source: 'admin_manual_credit', dangerousActionId: 'act1' }),
    );
    expect(res.amountTiyin).toBe('1000000');
  });

  it('pul TRANZAKSIYA ichida (advisory-lock bilan) yoziladi', async () => {
    const deps = makeDeps();
    armExecute(deps);

    await deps.svc.execute(OWNER, 'act1', { totp: '123456' });

    expect(deps.prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("boshqa operatorning kutilayotgan amalini BAJARIB bo'lmaydi", async () => {
    // Sabab va TOTP bergan odam bilan ijro etgan odam ajralmasligi shart;
    // pul yo'lida bu ADMIN kunlik chegarasini chetlab o'tish yo'li bo'lardi.
    const deps = makeDeps();
    armExecute(deps, 'some-other-owner');

    await expect(deps.svc.execute(OWNER, 'act1', { totp: '123456' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(deps.walletCredit).not.toHaveBeenCalled();
  });

  it('§25 — TAKROR bajarish: `pending` sharti tushmasa pul YOZILMAYDI', async () => {
    const deps = makeDeps();
    armExecute(deps);
    deps.prisma.dangerousAction.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(deps.svc.execute(OWNER, 'act1', { totp: '123456' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(deps.walletCredit).not.toHaveBeenCalled();
  });

  it('ikkita audit yozuvi: `intent` (so\'rovda) va `result` (bajarishda)', async () => {
    const deps = makeDeps();

    await deps.svc.request(OWNER, creditDto());
    expect(deps.audit.record.mock.calls[0][0].action).toBe('dangerous.credit_manual.intent');

    armExecute(deps);
    await deps.svc.execute(OWNER, 'act1', { totp: '123456' });
    const last = deps.audit.record.mock.calls.at(-1)![0];
    expect(last.action).toBe('dangerous.credit_manual.result');
    expect(last.metadata).toEqual(expect.objectContaining({ amountTiyin: '1000000' }));
  });
});

// ----------------------------------------------------------------
// §24 — blok / blokdan chiqarish
// ----------------------------------------------------------------
describe('SEC-12 — blok / blokdan chiqarish', () => {
  it('§24 — OWNER nishonini bloklab bo\'lmaydi (imtiyozli hisob)', async () => {
    const { svc } = makeDeps({ target: { ...TARGET, role: UserRole.OWNER } });

    await expect(
      svc.request(OWNER, blockDto(DangerousActionKind.user_block)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('§24 — ADMIN boshqa ADMIN ni bloklay olmaydi (teng rol)', async () => {
    const { svc } = makeDeps({ target: { ...TARGET, role: UserRole.ADMIN } });

    await expect(
      svc.request(ADMIN, blockDto(DangerousActionKind.user_block)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('§24 — o\'zini bloklash taqiqlangan (self-lockout)', async () => {
    const { svc } = makeDeps({ target: { ...TARGET, id: ADMIN.id } });

    await expect(
      svc.request(ADMIN, blockDto(DangerousActionKind.user_block, { targetUserId: ADMIN.id })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allaqachon bloklangan foydalanuvchini qayta bloklash rad etiladi', async () => {
    const { svc } = makeDeps({ target: { ...TARGET, blockedAt: new Date() } });

    await expect(
      svc.request(ADMIN, blockDto(DangerousActionKind.user_block)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('bloklanmagan foydalanuvchini blokdan chiqarish rad etiladi', async () => {
    const { svc } = makeDeps();

    await expect(
      svc.request(ADMIN, blockDto(DangerousActionKind.user_unblock)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('bloklash ATOMIK shartli UPDATE + `tokenVersion++` (sessiyalar o\'ladi)', async () => {
    const deps = makeDeps();
    deps.prisma.dangerousAction.findUnique.mockResolvedValue(
      pending(DangerousActionKind.user_block, { previouslyBlocked: false }) as never,
    );

    const res = (await deps.svc.execute(ADMIN, 'act1', { totp: '123456' })) as Record<string, any>;

    expect(res.blocked).toBe(true);
    expect(deps.prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: TARGET.id, blockedAt: null },
      data: expect.objectContaining({
        blockedById: ADMIN.id,
        tokenVersion: { increment: 1 },
      }),
    });
  });

  it('blokdan chiqarish shartli UPDATE bilan; `tokenVersion` OSHIRILMAYDI', async () => {
    const deps = makeDeps();
    deps.prisma.dangerousAction.findUnique.mockResolvedValue(
      pending(DangerousActionKind.user_unblock, { previouslyBlocked: true }) as never,
    );

    const res = (await deps.svc.execute(ADMIN, 'act1', { totp: '123456' })) as Record<string, any>;

    expect(res.blocked).toBe(false);
    const call = deps.prisma.user.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: TARGET.id, blockedAt: { not: null } });
    expect(call.data).toEqual({ blockedAt: null, blockedReason: null, blockedById: null });
    expect(call.data.tokenVersion).toBeUndefined();
  });

  it('§25 — POYGA: holat bu orada o\'zgargan bo\'lsa (count 0) bajarish rad etiladi', async () => {
    const deps = makeDeps({ blockCount: 0 });
    deps.prisma.dangerousAction.findUnique.mockResolvedValue(
      pending(DangerousActionKind.user_block, { previouslyBlocked: false }) as never,
    );

    await expect(deps.svc.execute(ADMIN, 'act1', { totp: '123456' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('blok sababi qatorga yoziladi (kim va nega)', async () => {
    const deps = makeDeps();
    const action = pending(DangerousActionKind.user_block, { previouslyBlocked: false });
    deps.prisma.dangerousAction.findUnique.mockResolvedValue(action as never);

    await deps.svc.execute(ADMIN, 'act1', { totp: '123456' });

    const data = deps.prisma.user.updateMany.mock.calls[0][0].data;
    expect(data.blockedReason).toBe(action.reason);
    expect(data.blockedAt).toBeInstanceOf(Date);
  });
});
