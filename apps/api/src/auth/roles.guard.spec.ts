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
 * Naqsh `auth.guard.spec.ts` bilan bir xil (u ham sun'iy kontekst bilan).
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

/**
 * Bitta (endpoint-shakli × rol) katakchasini baholaydi.
 *
 * `twoFactorEnabled: true` — ATAYLAB: bu matritsa ROL mantig'ini o'lchaydi,
 * 2FA esa ortogonal o'lcham (SEC-11, Konstitutsiya #10). Ya'ni bu yerdagi
 * "admin" — qoidaga MOS admin. 2FA o'lchamining o'zi quyida alohida
 * `describe` blokida sinaladi (ikkala qiymat uchun).
 */
function allows(required: UserRole[] | undefined, role: UserRole): boolean {
  const guard = new RolesGuard(reflectorWith(required));
  try {
    return guard.canActivate(ctxWithUser({ id: 'u1', role, twoFactorEnabled: true }));
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

/**
 * SEC-11 (Konstitutsiya qoidasi #10) — "OWNER/ADMIN roli 2FA'siz berilmaydi".
 *
 * Jonli bo'shliq: login OTP (email/SMS) — fishing va SIM-swap'ga ochiq kanal.
 * 2FA'siz OWNER hisobini egallash butun platformani egallash demak edi.
 */
describe('RolesGuard — imtiyozli rol uchun 2FA majburiy (SEC-11)', () => {
  function attempt(required: UserRole[] | undefined, role: UserRole, twoFactorEnabled: boolean) {
    const guard = new RolesGuard(reflectorWith(required));
    return () => guard.canActivate(ctxWithUser({ id: 'u1', role, twoFactorEnabled }));
  }

  for (const role of ['OWNER', 'ADMIN'] as UserRole[]) {
    it(`${role} + 2FA yo'q -> imtiyozli yo'l RAD ETILADI`, () => {
      expect(attempt(['OWNER', 'ADMIN'], role, false)).toThrow(ForbiddenException);
    });

    it(`${role} + 2FA yo'q -> xato sababi 'two_factor_required' (UI aniq xabar bera oladi)`, () => {
      try {
        attempt(['OWNER', 'ADMIN'], role, false)();
        throw new Error('kutilgan ForbiddenException tashlanmadi');
      } catch (e) {
        expect((e as ForbiddenException).getResponse()).toEqual(
          expect.objectContaining({ reason: 'two_factor_required' }),
        );
      }
    });

    it(`${role} + 2FA bor -> imtiyozli yo'l ochiq`, () => {
      expect(attempt(['OWNER', 'ADMIN'], role, true)()).toBe(true);
    });

    it(`${role} + 2FA yo'q -> ODDIY (dekoratorsiz) yo'l ochiq — qulflab qo'ymaydi`, () => {
      // Aynan shu xulq 2FA'ni yoqish imkonini beradi: `/auth/2fa/*` — oddiy yo'l.
      expect(attempt(undefined, role, false)()).toBe(true);
    });
  }

  it("SUPPORT — Contract #10 uni nomma-nom aytmaydi, shuning uchun 2FA'siz ham o'tadi (SEC-12'da ko'riladi)", () => {
    expect(attempt(['SUPPORT'], 'SUPPORT', false)()).toBe(true);
  });

  it('MEMBER — imtiyozsiz rol, 2FA talab qilinmaydi', () => {
    expect(attempt(['MEMBER'], 'MEMBER', false)()).toBe(true);
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
