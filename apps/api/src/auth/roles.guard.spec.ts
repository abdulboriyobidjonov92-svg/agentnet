import { ForbiddenException, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from './roles.decorator';

/**
 * SEC-05 DoD — "har rol uchun matritsa testi (5 rol × 8 namunaviy endpoint
 * = 40 assertion)".
 *
 * 8 ta "namunaviy endpoint" — 8 ta turli DEKORATOR-SHAKLI (haqiqiy
 * endpointlarning avtorizatsiya shakllari), sun'iy `ExecutionContext` bilan.
 * Bu ataylab: DoD'ni bajarish uchun 8 ta yangi ishlaydigan endpoint qo'shish
 * katta scope-creep bo'lardi va guard mantig'ini undan yaxshiroq sinamasdi.
 * Naqsh `clerk.guard.spec.ts` bilan bir xil (u ham sun'iy kontekst bilan).
 */

const ALL_ROLES: UserRole[] = ['OWNER', 'ADMIN', 'SUPPORT', 'MEMBER', 'VIEWER'];

/** `@Roles()` metadatasini qaytaradigan soxta Reflector. */
function reflectorWith(required: UserRole[] | undefined): Reflector {
  return {
    getAllAndOverride: (key: string) => (key === ROLES_KEY ? required : undefined),
  } as unknown as Reflector;
}

function ctxWithUser(user: unknown): ExecutionContext {
  const request: any = { dbUser: user };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

/** Bitta (endpoint-shakli × rol) katakchasini baholaydi. */
function allows(required: UserRole[] | undefined, role: UserRole): boolean {
  const guard = new RolesGuard(reflectorWith(required));
  try {
    return guard.canActivate(ctxWithUser({ id: 'u1', role }));
  } catch (e) {
    if (e instanceof ForbiddenException) return false;
    throw e;
  }
}

/**
 * Ruxsat matritsasi — 8 endpoint-shakli × 5 rol = 40 assertion.
 * Kutilgan qiymatlar §6.1 va AC #4 dan kelib chiqadi.
 */
const MATRIX: {
  name: string;
  required: UserRole[] | undefined;
  expected: Record<UserRole, boolean>;
}[] = [
  {
    name: '1. dekoratorsiz (default = kamida MEMBER)',
    required: undefined,
    expected: { OWNER: true, ADMIN: true, SUPPORT: true, MEMBER: true, VIEWER: false },
  },
  {
    name: '2. @Roles() bo\'sh massiv (dekoratorsiz bilan bir xil)',
    required: [],
    expected: { OWNER: true, ADMIN: true, SUPPORT: true, MEMBER: true, VIEWER: false },
  },
  {
    name: '3. @Roles(OWNER) — feedback list/setStatus kabi',
    required: ['OWNER'],
    expected: { OWNER: true, ADMIN: false, SUPPORT: false, MEMBER: false, VIEWER: false },
  },
  {
    name: '4. @Roles(OWNER, ADMIN) — moderatsiya kabi',
    required: ['OWNER', 'ADMIN'],
    expected: { OWNER: true, ADMIN: true, SUPPORT: false, MEMBER: false, VIEWER: false },
  },
  {
    name: '5. @Roles(OWNER, ADMIN, SUPPORT) — admin o\'qish kabi',
    required: ['OWNER', 'ADMIN', 'SUPPORT'],
    expected: { OWNER: true, ADMIN: true, SUPPORT: true, MEMBER: false, VIEWER: false },
  },
  {
    name: '6. @Roles(ADMIN) — meros YO\'Q, OWNER ham rad etiladi',
    required: ['ADMIN'],
    expected: { OWNER: false, ADMIN: true, SUPPORT: false, MEMBER: false, VIEWER: false },
  },
  {
    name: '7. @Roles(MEMBER) — faqat oddiy foydalanuvchi',
    required: ['MEMBER'],
    expected: { OWNER: false, ADMIN: false, SUPPORT: false, MEMBER: true, VIEWER: false },
  },
  {
    name: '8. @Roles(VIEWER) — faqat VIEWER',
    required: ['VIEWER'],
    expected: { OWNER: false, ADMIN: false, SUPPORT: false, MEMBER: false, VIEWER: true },
  },
];

describe('RolesGuard — ruxsat matritsasi (8 endpoint-shakli × 5 rol = 40 assertion)', () => {
  for (const row of MATRIX) {
    describe(row.name, () => {
      for (const role of ALL_ROLES) {
        const verdict = row.expected[role] ? 'RUXSAT' : 'RAD ETILADI';
        it(`${role} -> ${verdict}`, () => {
          expect(allows(row.required, role)).toBe(row.expected[role]);
        });
      }
    });
  }
});

describe('RolesGuard — autentifikatsiya qilinmagan yo\'llar', () => {
  /**
   * ENG MUHIM regressiya testi: `dbUser` yo'q bo'lsa guard ARALASHMASLIGI
   * shart. Aks holda global guard sifatida u ochiq endpointlarni, engine
   * ichki yo'llarini VA Payme/Click to'lov webhooklarini darhol buzardi.
   */
  it("dbUser yo'q (ochiq / webhook / internal-token yo'l) -> ruxsat, aralashmaydi", () => {
    const guard = new RolesGuard(reflectorWith(undefined));
    expect(guard.canActivate(ctxWithUser(undefined))).toBe(true);
  });

  it("dbUser yo'q, lekin endpointda @Roles(OWNER) bo'lsa ham -> ruxsat", () => {
    const guard = new RolesGuard(reflectorWith(['OWNER']));
    expect(guard.canActivate(ctxWithUser(undefined))).toBe(true);
  });
});

describe('RolesGuard — fail-closed holatlar', () => {
  it("dbUser bor, lekin roli yo'q -> ForbiddenException", () => {
    const guard = new RolesGuard(reflectorWith(undefined));
    expect(() => guard.canActivate(ctxWithUser({ id: 'u1' }))).toThrow(ForbiddenException);
  });

  it('noma\'lum rol qiymati -> ForbiddenException', () => {
    const guard = new RolesGuard(reflectorWith(undefined));
    expect(() => guard.canActivate(ctxWithUser({ id: 'u1', role: 'SUPERUSER' }))).toThrow(
      ForbiddenException,
    );
  });
});
