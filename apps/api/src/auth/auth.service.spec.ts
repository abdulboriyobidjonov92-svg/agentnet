import { ForbiddenException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { authenticator } from 'otplib';
import {
  AuditLogService,
  TwoFactorService,
  AuthService,
  TwoFactorEnforcementGuard,
  RolesGuard,
} from './auth.service';
import { verifyToken } from './token.util';
import { AUDIT_GENESIS, computeEntryHash } from './audit-hash';

/**
 * Auth xizmatlari uchun testlar: hash-chained audit-log, majburiy 2FA (TOTP),
 * lokal dev-login va RBAC guardlar.
 */

beforeAll(() => {
  process.env.AUTH_JWT_SECRET = 'test-secret-'.repeat(4);
});

// CryptoService o'rniga oddiy stub — bu testlar 2FA oqimini tekshiradi,
// AES-256-GCM'ni emas (u crypto.service.spec.ts'da alohida qoplangan).
function makeCryptoStub() {
  return {
    encrypt: jest.fn((s: string) => `enc:${s}`),
    decryptString: jest.fn((s: string | null) => (s == null ? null : s.startsWith('enc:') ? s.slice(4) : s)),
  } as any;
}

// ------------------------------------------------------------------
// AuditLogService
// ------------------------------------------------------------------

describe('AuditLogService.record — hash-chained audit jurnali', () => {
  // A17/ADR-008: hash endi SAQLANGAN qatordan hisoblanadi. `create` bo'sh
  // `entryHash` bilan yoziladi, so'ng DB qaytargan qiymatlardan hisoblangan
  // hash `update` bilan o'rnatiladi — shu sabab mock `update`ni ham beradi.
  function makePrisma(stored?: Record<string, unknown>) {
    const tx = {
      $executeRaw: jest.fn(),
      auditLog: {
        findFirst: jest.fn(async () => null as any),
        create: jest.fn(async (a: any) => ({
          id: 'log1',
          seq: 1,
          ...a.data,
          // DB normalizatsiyasini modellaymiz (jsonb kalitlarni qayta tartiblaydi)
          ...(stored ?? {}),
        })),
        update: jest.fn(async (a: any) => a),
      },
    };
    const prisma: any = {
      $transaction: jest.fn(async (fn: any) => fn(tx)),
    };
    return { prisma, tx };
  }

  /** `update` chaqiruvida o'rnatilgan yakuniy hash. */
  const writtenHash = (tx: any) => tx.auditLog.update.mock.calls[0][0].data.entryHash;

  it('birinchi yozuv -> prevHash = GENESIS', async () => {
    const { prisma, tx } = makePrisma();
    const svc = new AuditLogService(prisma);

    await svc.record({ actorId: 'u1', action: 'agent.create', resourceType: 'agent', resourceId: 'a1', metadata: { x: 1 } });

    expect(tx.$executeRaw).toHaveBeenCalled();
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ actorId: 'u1', action: 'agent.create', prevHash: AUDIT_GENESIS }),
    });
  });

  it('keyingi yozuv -> prevHash = shu AKTORdagi oldingi entryHash', async () => {
    const { prisma, tx } = makePrisma();
    tx.auditLog.findFirst.mockResolvedValue({ entryHash: 'abc123hash' } as any);
    const svc = new AuditLogService(prisma);

    await svc.record({ actorId: 'u2', action: '2fa.enable', resourceType: 'user', resourceId: 'u2' });

    // Oxirgi yozuv AYNAN shu aktor bo'yicha qidiriladi (per-actor zanjir).
    expect(tx.auditLog.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { actorId: 'u2' } }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ prevHash: 'abc123hash' }),
    });
  });

  it('entryHash SAQLANGAN qatordan hisoblanadi (kirish obyektidan EMAS)', async () => {
    // DB qaytargan metadata kirishdagidan boshqa kalit tartibida — eski
    // implementatsiya kirish obyektini hash qilgani uchun bu farq sezilmasdi
    // va zanjirni keyin tekshirib bo'lmasdi.
    const createdAt = new Date('2026-08-07T10:00:00.000Z');
    const { prisma, tx } = makePrisma({ metadata: { b: 2, a: 1 }, createdAt });
    const svc = new AuditLogService(prisma);

    await svc.record({ actorId: 'u3', action: 'test', resourceType: 'x', resourceId: 'r', metadata: { a: 1, b: 2 } });

    const expected = computeEntryHash(AUDIT_GENESIS, {
      actorId: 'u3',
      action: 'test',
      resourceType: 'x',
      resourceId: 'r',
      createdAt,
      metadata: { b: 2, a: 1 },
    });
    expect(writtenHash(tx)).toBe(expected);
  });

  it('lock PER-ACTOR olinadi (global emas)', async () => {
    const { prisma, tx } = makePrisma();
    const svc = new AuditLogService(prisma);

    await svc.record({ actorId: 'u4', action: 'x', resourceType: 'y' });

    // Prisma tagged-template: parametrlar orasida actorId bo'lishi SHART.
    const values = tx.$executeRaw.mock.calls[0].slice(1);
    expect(values).toContain('u4');
  });

  it('DB xatosi bo\'lsa ham record() throw qilmaydi (asosiy oqim bloklanmasligi kerak)', async () => {
    const prisma: any = { $transaction: jest.fn(async () => { throw new Error('db down'); }) };
    const svc = new AuditLogService(prisma);

    await expect(
      svc.record({ actorId: 'u1', action: 'x', resourceType: 'y' }),
    ).resolves.toBeUndefined();
  });
});

// ------------------------------------------------------------------
// TwoFactorService
// ------------------------------------------------------------------

describe('TwoFactorService', () => {
  describe('generateSecret', () => {
    it('TOTP sirini generatsiya qiladi, shifrlab pending sifatida saqlaydi', async () => {
      const prisma: any = { user: { update: jest.fn() } };
      const audit = { record: jest.fn() } as any;
      const cryptoStub = makeCryptoStub();
      const svc = new TwoFactorService(audit, prisma, cryptoStub);

      const { secret, qrCodeDataUrl } = await svc.generateSecret('u1', 'a@b.com');

      expect(secret).toEqual(expect.any(String));
      expect(qrCodeDataUrl.startsWith('data:image')).toBe(true);
      expect(cryptoStub.encrypt).toHaveBeenCalledWith(secret);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { twoFactorSecretPending: `enc:${secret}` },
      });
    });
  });

  describe('verifyAndEnable', () => {
    it('pending sozlash boshlanmagan bo\'lsa -> ForbiddenException', async () => {
      const prisma: any = { user: { findUniqueOrThrow: jest.fn(async () => ({ twoFactorSecretPending: null })) } };
      const svc = new TwoFactorService({ record: jest.fn() } as any, prisma, makeCryptoStub());

      await expect(svc.verifyAndEnable('u1', '123456')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('noto\'g\'ri TOTP kod -> false, hech narsa yangilanmaydi', async () => {
      const secret = authenticator.generateSecret();
      const real = authenticator.generate(secret);
      const wrong = real === '000000' ? '111111' : '000000';
      const prisma: any = {
        user: {
          findUniqueOrThrow: jest.fn(async () => ({ twoFactorSecretPending: `enc:${secret}` })),
          update: jest.fn(),
        },
      };
      const svc = new TwoFactorService({ record: jest.fn() } as any, prisma, makeCryptoStub());

      const ok = await svc.verifyAndEnable('u1', wrong);

      expect(ok).toBe(false);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('to\'g\'ri TOTP kod -> true, secret faollashtiriladi, audit yoziladi', async () => {
      const secret = authenticator.generateSecret();
      const token = authenticator.generate(secret);
      const prisma: any = {
        user: {
          findUniqueOrThrow: jest.fn(async () => ({ twoFactorSecretPending: `enc:${secret}` })),
          update: jest.fn(),
        },
      };
      const audit = { record: jest.fn() } as any;
      const svc = new TwoFactorService(audit, prisma, makeCryptoStub());

      const ok = await svc.verifyAndEnable('u1', token);

      expect(ok).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: {
          twoFactorSecret: `enc:${secret}`,
          twoFactorSecretPending: null,
          twoFactorEnabled: true,
          // SEC-03: 2FA yoqilishi barcha mavjud tokenlarni bekor qiladi.
          tokenVersion: { increment: 1 },
        },
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ actorId: 'u1', action: '2fa.enable', resourceType: 'user', resourceId: 'u1' }),
      );
    });
  });

  describe('verifyLogin', () => {
    it('2FA yoqilmagan -> har doim true (kod tekshirilmaydi)', async () => {
      const prisma: any = { user: { findUniqueOrThrow: jest.fn(async () => ({ twoFactorEnabled: false })) } };
      const svc = new TwoFactorService({ record: jest.fn() } as any, prisma, makeCryptoStub());

      expect(await svc.verifyLogin('u1', 'har-qanday')).toBe(true);
    });

    it('2FA yoqilgan -> haqiqiy TOTP kod tekshiriladi', async () => {
      const secret = authenticator.generateSecret();
      const token = authenticator.generate(secret);
      const wrong = token === '000000' ? '111111' : '000000';
      const prisma: any = {
        user: { findUniqueOrThrow: jest.fn(async () => ({ twoFactorEnabled: true, twoFactorSecret: `enc:${secret}` })) },
      };
      const svc = new TwoFactorService({ record: jest.fn() } as any, prisma, makeCryptoStub());

      expect(await svc.verifyLogin('u1', token)).toBe(true);
      expect(await svc.verifyLogin('u1', wrong)).toBe(false);
    });
  });
});

// ------------------------------------------------------------------
// AuthService
// ------------------------------------------------------------------

describe('AuthService', () => {
  function makeSvc() {
    const prisma: any = {
      user: {
        create: jest.fn(async (a: any) => ({ id: 'newid', ...a.data })),
        findUnique: jest.fn(async () => null),
      },
    };
    const audit = { record: jest.fn() } as any;
    return { svc: new AuthService(audit, prisma), prisma, audit };
  }

  describe('devLogin — email bilan', () => {
    it('yaroqsiz email -> BadRequestException', async () => {
      const { svc } = makeSvc();
      await expect(svc.devLogin({ email: 'not-an-email' })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('mavjud foydalanuvchi -> yangi yaratilmaydi, imzolangan token qaytadi', async () => {
      const { svc, prisma } = makeSvc();
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', phone: null, role: 'MEMBER', name: 'A' });

      const res = await svc.devLogin({ email: 'A@B.com' });

      expect(res.isNewUser).toBe(false);
      expect(res.userId).toBe('u1');
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(verifyToken(res.token)?.sub).toBe('u1');
    });

    it('yangi foydalanuvchi -> yaratiladi, imzolangan token qaytadi', async () => {
      const { svc, prisma } = makeSvc();

      const res = await svc.devLogin({ email: 'new@b.com', name: 'New' });

      expect(res.isNewUser).toBe(true);
      expect(prisma.user.create).toHaveBeenCalled();
      expect(verifyToken(res.token)?.sub).toBe('newid');
    });
  });

  describe('devLogin — telefon bilan', () => {
    it('yaroqsiz raqam -> BadRequestException', async () => {
      const { svc } = makeSvc();
      await expect(svc.devLogin({ phone: '123' })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('yaroqli raqam -> E.164 normallashtiriladi, sintetik email yaratiladi', async () => {
      const { svc, prisma } = makeSvc();

      const res = await svc.devLogin({ phone: '901234567' });

      expect(res.isNewUser).toBe(true);
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ phone: '+901234567', email: '901234567@phone.agentnet' }),
        }),
      );
    });

    it('mavjud telefon -> mavjud foydalanuvchi qaytadi (yangisi yaratilmaydi)', async () => {
      const { svc, prisma } = makeSvc();
      prisma.user.findUnique.mockResolvedValue({ id: 'u9', email: 'x@phone.agentnet', phone: '+998901234567', role: 'MEMBER', name: null });

      const res = await svc.devLogin({ phone: '+998901234567' });

      expect(res.isNewUser).toBe(false);
      expect(res.userId).toBe('u9');
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  // SEC-03
  describe('issueSession', () => {
    it('token payload joriy tokenVersion\'ni tv sifatida oladi', () => {
      const { svc } = makeSvc();
      const res = svc.issueSession(
        { id: 'u1', email: 'a@b.com', phone: null, role: 'MEMBER', name: null, tokenVersion: 3 },
        false,
      );
      expect(verifyToken(res.token)?.tv).toBe(3);
    });

    it('tokenVersion 0 bo\'lganda ham tv=0 sifatida to\'g\'ri qo\'yiladi (falsy qiymat yo\'qolmaydi)', () => {
      const { svc } = makeSvc();
      const res = svc.issueSession(
        { id: 'u1', email: 'a@b.com', phone: null, role: 'MEMBER', name: null, tokenVersion: 0 },
        false,
      );
      expect(verifyToken(res.token)?.tv).toBe(0);
    });
  });

  describe('refreshSession', () => {
    it('joriy tokenVersion bilan yangi token beradi', () => {
      const { svc } = makeSvc();
      const res = svc.refreshSession({ id: 'u1', email: 'a@b.com', tokenVersion: 2 });
      const payload = verifyToken(res.token);
      expect(payload?.sub).toBe('u1');
      expect(payload?.tv).toBe(2);
      // Yangi token yangi 7-kunlik TTL bilan (SEC-03 sukut TTL)
      expect(payload!.exp - payload!.iat).toBe(60 * 60 * 24 * 7);
    });
  });
});

// ------------------------------------------------------------------
// RBAC Guardlar
// ------------------------------------------------------------------

const ctxWithUser = (user: any) =>
  ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as any;

describe('TwoFactorEnforcementGuard', () => {
  it('foydalanuvchi yo\'q -> UnauthorizedException', async () => {
    const guard = new TwoFactorEnforcementGuard();
    await expect(guard.canActivate(ctxWithUser(undefined))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('biznes hisob + 2FA o\'chirilgan -> ForbiddenException', async () => {
    const guard = new TwoFactorEnforcementGuard();
    await expect(
      guard.canActivate(ctxWithUser({ isBusinessAccount: true, twoFactorEnabled: false })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('biznes hisob + 2FA yoqilgan -> ruxsat', async () => {
    const guard = new TwoFactorEnforcementGuard();
    await expect(
      guard.canActivate(ctxWithUser({ isBusinessAccount: true, twoFactorEnabled: true })),
    ).resolves.toBe(true);
  });

  it('oddiy (biznes bo\'lmagan) hisob -> 2FA'
    + ' talab qilinmaydi', async () => {
    const guard = new TwoFactorEnforcementGuard();
    await expect(
      guard.canActivate(ctxWithUser({ isBusinessAccount: false, twoFactorEnabled: false })),
    ).resolves.toBe(true);
  });
});

describe('RolesGuard', () => {
  it('foydalanuvchi yo\'q -> UnauthorizedException', () => {
    const guard = new RolesGuard(['ADMIN']);
    expect(() => guard.canActivate(ctxWithUser(undefined))).toThrow(UnauthorizedException);
  });

  it('ruxsat etilmagan rol -> ForbiddenException', () => {
    const guard = new RolesGuard(['ADMIN', 'OWNER']);
    expect(() => guard.canActivate(ctxWithUser({ role: 'MEMBER' }))).toThrow(ForbiddenException);
  });

  it('ruxsat etilgan rol -> ruxsat', () => {
    const guard = new RolesGuard(['ADMIN', 'OWNER']);
    expect(guard.canActivate(ctxWithUser({ role: 'OWNER' }))).toBe(true);
  });
});
