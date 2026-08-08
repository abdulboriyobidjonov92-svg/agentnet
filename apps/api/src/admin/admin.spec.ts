import { NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { AdminController } from './admin.controller';
import { AdminQueryService } from './admin-query.service';
import { AdminUsersService } from './admin-users.service';
import { AdminAuditService } from './admin-audit.service';
import { AdminFeedbackService } from './admin-feedback.service';
import { RolesGuard } from '../auth/roles.guard';
import { ROLES_KEY } from '../auth/roles.decorator';

/**
 * Phase 4 — admin o'qish yuzasi.
 *
 * Bu testlar Contract §6.1/§6.2 ning JIM BUZILADIGAN kafolatlarini qulflaydi:
 *   • har admin so'rovi `AdminQueryService` dan o'tadi (SEC-06),
 *   • SUPPORT qat'iy faqat o'qish (yuzada mutatsiya YO'Q),
 *   • MEMBER/VIEWER admin yuzasiga umuman kira olmaydi,
 *   • sirlar (`twoFactorSecret*`) hech qachon tanlanmaydi,
 *   • pagination shartnomasi (kursor + limit) buzilmaydi.
 */

/** `paginate(delegate, args, query)` — tiplanmagan `jest.fn` `calls: []` beradi. */
type PaginateArgs = [unknown, { where?: unknown; orderBy?: unknown; select?: unknown }, { limit?: number; cursor?: string }];
type PaginateMock = jest.Mock<Promise<unknown>, PaginateArgs>;

function makeAdminQuerySpy() {
  const page = { items: [{ id: 'u1' }], nextCursor: null, hasMore: false };
  return {
    paginate: jest.fn(async () => page) as unknown as PaginateMock,
    count: jest.fn(async () => 1),
    findUnique: jest.fn(async () => ({ id: 'u1', email: 'a@b.c' })),
    findMany: jest.fn(async () => []),
    findFirst: jest.fn(async () => null),
  };
}

/** Birinchi `paginate` chaqiruvining `args` (2-argument). */
const argsOf = (aq: { paginate: PaginateMock }) => aq.paginate.mock.calls[0][1];
/** Birinchi `paginate` chaqiruvining `query` (3-argument). */
const queryOf = (aq: { paginate: PaginateMock }) => aq.paginate.mock.calls[0][2];

const prisma = {
  user: { __model: 'user' },
  agent: { __model: 'agent' },
  conversation: { __model: 'conversation' },
  auditLog: { __model: 'auditLog' },
  feedback: { __model: 'feedback' },
} as never;

describe('AdminUsersService', () => {
  it('ro\'yxat AdminQueryService orqali o\'tadi (SEC-06 yagona nuqta)', async () => {
    const aq = makeAdminQuerySpy();
    const svc = new AdminUsersService(prisma, aq as never);

    await svc.list({ limit: 25 });

    expect(aq.paginate).toHaveBeenCalledTimes(1);
    expect(queryOf(aq)).toEqual(expect.objectContaining({ limit: 25 }));
  });

  it('SIRLAR tanlanmaydi — twoFactorSecret/Pending select ichida YO\'Q', async () => {
    const aq = makeAdminQuerySpy();
    await new AdminUsersService(prisma, aq as never).list({});

    const select = argsOf(aq).select as Record<string, unknown>;
    expect(select).not.toHaveProperty('twoFactorSecret');
    expect(select).not.toHaveProperty('twoFactorSecretPending');
    // Ijobiy tekshiruv: kutilgan maydonlar bor (select "ruxsat etilganlar" ro'yxati)
    expect(select).toEqual(expect.objectContaining({ id: true, email: true, role: true }));
  });

  it('deterministik tartib — createdAt desc (paginate id tiebreaker qo\'shadi)', async () => {
    const aq = makeAdminQuerySpy();
    await new AdminUsersService(prisma, aq as never).list({});
    expect(argsOf(aq).orderBy).toEqual({ createdAt: 'desc' });
  });

  it('filtr: rol va platformPlan where ichiga tushadi', async () => {
    const aq = makeAdminQuerySpy();
    await new AdminUsersService(prisma, aq as never).list({
      role: UserRole.ADMIN,
      platformPlan: 'pro',
    });
    expect(argsOf(aq).where).toEqual({
      role: 'ADMIN',
      platformPlan: 'pro',
    });
  });

  it('qidiruv INDEKSDAN foydalanadigan shaklda (aniq id / prefiks) — `%...%` YO\'Q', async () => {
    const aq = makeAdminQuerySpy();
    await new AdminUsersService(prisma, aq as never).list({ q: 'ali@' });

    const where = argsOf(aq).where as { OR: unknown[] };
    expect(where.OR).toEqual([
      { id: 'ali@' },
      { email: { startsWith: 'ali@', mode: 'insensitive' } },
      { phone: { startsWith: 'ali@' } },
    ]);
    // `contains` (ikki tomonlama qidiruv) seq scan berardi — bo'lmasligi shart.
    expect(JSON.stringify(where)).not.toContain('contains');
  });

  it('bo\'sh/probel qidiruv filtr QO\'SHMAYDI', async () => {
    const aq = makeAdminQuerySpy();
    await new AdminUsersService(prisma, aq as never).list({ q: '   ' });
    expect(argsOf(aq).where).toEqual({});
  });

  it('detal — topilmasa NotFoundException', async () => {
    const aq = makeAdminQuerySpy();
    aq.findUnique.mockResolvedValue(null as never);
    await expect(new AdminUsersService(prisma, aq as never).detail('yoq')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('detal — agent/suhbat sanoqlari ham AdminQueryService orqali', async () => {
    const aq = makeAdminQuerySpy();
    const res = await new AdminUsersService(prisma, aq as never).detail('u1');
    expect(aq.count).toHaveBeenCalledTimes(2);
    expect(res).toEqual(expect.objectContaining({ agentCount: 1, conversationCount: 1 }));
  });
});

describe('AdminAuditService', () => {
  const auditLog = { verifyChain: jest.fn(async () => ({ ok: true, checked: 3 })) };

  it('AdminQueryService orqali, `seq desc` bilan (monotonik tartib)', async () => {
    const aq = makeAdminQuerySpy();
    await new AdminAuditService(prisma, aq as never, auditLog as never).list({});

    expect(aq.paginate).toHaveBeenCalledTimes(1);
    expect(argsOf(aq).orderBy).toEqual({ seq: 'desc' });
  });

  it('filtrlar (actorId/action/resourceType) where ichiga tushadi', async () => {
    const aq = makeAdminQuerySpy();
    await new AdminAuditService(prisma, aq as never, auditLog as never).list({
      actorId: 'u1',
      action: 'agent.create',
      resourceType: 'agent',
    });
    expect(argsOf(aq).where).toEqual({
      actorId: 'u1',
      action: 'agent.create',
      resourceType: 'agent',
    });
  });

  it('verifyChain A17 servisiga o\'tkazadi (qayta implementatsiya YO\'Q)', async () => {
    const aq = makeAdminQuerySpy();
    const res = await new AdminAuditService(prisma, aq as never, auditLog as never).verifyChain('u1');

    expect(auditLog.verifyChain).toHaveBeenCalledWith('u1');
    expect(res).toEqual({ ok: true, checked: 3 });
  });
});

describe('AdminFeedbackService', () => {
  it('AdminQueryService orqali, holat filtri bilan', async () => {
    const aq = makeAdminQuerySpy();
    await new AdminFeedbackService(prisma, aq as never).list({ status: 'new' });

    expect(aq.paginate).toHaveBeenCalledTimes(1);
    expect(argsOf(aq).where).toEqual({ status: 'new' });
  });

  it('filtrsiz — bo\'sh where (hamma fikrlar)', async () => {
    const aq = makeAdminQuerySpy();
    await new AdminFeedbackService(prisma, aq as never).list({});
    expect(argsOf(aq).where).toEqual({});
  });
});

describe('AdminController — avtorizatsiya yuzasi', () => {
  /** Controller darajasidagi `@Roles(...)` metadatasi. */
  const declared = new Reflector().get<UserRole[]>(ROLES_KEY, AdminController);

  it('`@Roles(OWNER, ADMIN, SUPPORT)` — §6.1 matritsasi', () => {
    expect(declared).toEqual([UserRole.OWNER, UserRole.ADMIN, UserRole.SUPPORT]);
  });

  it.each([UserRole.OWNER, UserRole.ADMIN, UserRole.SUPPORT])(
    '%s (2FA bilan) -> admin yuzasi OCHIQ',
    (role) => {
      const guard = new RolesGuard({
        getAllAndOverride: () => declared,
      } as never);
      const ctx = {
        switchToHttp: () => ({ getRequest: () => ({ dbUser: { id: 'x', role, twoFactorEnabled: true } }) }),
        getHandler: () => () => undefined,
        getClass: () => AdminController,
      } as never;
      expect(guard.canActivate(ctx)).toBe(true);
    },
  );

  it.each([UserRole.MEMBER, UserRole.VIEWER])('%s -> admin yuzasi YOPIQ', (role) => {
    const guard = new RolesGuard({ getAllAndOverride: () => declared } as never);
    const ctx = {
      switchToHttp: () => ({ getRequest: () => ({ dbUser: { id: 'x', role, twoFactorEnabled: true } }) }),
      getHandler: () => () => undefined,
      getClass: () => AdminController,
    } as never;
    expect(() => guard.canActivate(ctx)).toThrow();
  });

  it('OWNER/ADMIN 2FA\'siz -> YOPIQ (SEC-11 buzilmagan)', () => {
    for (const role of [UserRole.OWNER, UserRole.ADMIN]) {
      const guard = new RolesGuard({ getAllAndOverride: () => declared } as never);
      const ctx = {
        switchToHttp: () => ({ getRequest: () => ({ dbUser: { id: 'x', role, twoFactorEnabled: false } }) }),
        getHandler: () => () => undefined,
        getClass: () => AdminController,
      } as never;
      expect(() => guard.canActivate(ctx)).toThrow();
    }
  });

  it('SUPPORT QAT\'IY faqat o\'qish — yuzada bironta mutatsiya metodi YO\'Q', () => {
    // Read-only xususiyat "unutilgan tekshiruv" bilan emas, YUZANING O'ZI
    // bilan kafolatlanadi: prototipda faqat GET-handler'lar bo'lishi shart.
    const methods = Object.getOwnPropertyNames(AdminController.prototype).filter((m) => m !== 'constructor');
    expect(methods.sort()).toEqual(
      ['listAudit', 'listFeedback', 'listUsers', 'userDetail', 'verifyChain'].sort(),
    );

    // Nest metodga HTTP-metodini `path`/`method` metadatasi bilan biriktiradi;
    // 0 = GET. Mutatsiya (POST=1, PUT=2, DELETE=3, PATCH=6) bo'lmasligi shart.
    for (const name of methods) {
      const handler = (AdminController.prototype as unknown as Record<string, object>)[name];
      const httpMethod = Reflect.getMetadata('method', handler);
      expect(httpMethod).toBe(0);
    }
  });
});

describe('AdminQueryService — pagination shartnomasiga o\'tkazish', () => {
  it('umumiy `paginate()` helper\'iga o\'tkazadi (mantiq takrorlanmaydi)', async () => {
    const svc = new AdminQueryService();
    const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const delegate = {
      findMany: jest.fn(async () => rows) as unknown as jest.Mock<
        Promise<Array<{ id: string }>>,
        [Record<string, unknown>]
      >,
    };

    const page = await svc.paginate(delegate, { orderBy: { createdAt: 'desc' } }, { limit: 2 });

    // `limit + 1` naqshi va `id` teng-buzuvchisi — helper'dan keladi.
    const args = delegate.findMany.mock.calls[0][0];
    expect(args.take).toBe(3);
    expect(args.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
    expect(page).toEqual({ items: [{ id: 'a' }, { id: 'b' }], nextCursor: 'b', hasMore: true });
  });

  it('eskirgan kursor -> bo\'sh sahifa, xato YO\'Q', async () => {
    const svc = new AdminQueryService();
    const delegate = { findMany: jest.fn(async () => []) };
    await expect(svc.paginate(delegate, {}, { cursor: 'ochirilgan' })).resolves.toEqual({
      items: [],
      nextCursor: null,
      hasMore: false,
    });
  });
});
