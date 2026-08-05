import { UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from './auth.guard';
import { signToken } from './token.util';
import { IS_PUBLIC_KEY } from './public.decorator';

/**
 * Lokal auth guard — endi shunchaki userId emas, server tomonda imzolangan
 * JWT talab qiladi. Bu testlar tasdiqlaydi: tokensiz/soxta/muddati o'tgan
 * so'rovlar rad etiladi, yaroqli token esa foydalanuvchini request'ga biriktiradi.
 */

/** `@Public()` metadatasini HECH QACHON qaytarmaydigan soxta Reflector — mavjud testlar uchun. */
const noopReflector = { getAllAndOverride: () => undefined } as unknown as Reflector;

/** `@Public()` metadatasini DOIM qaytaradigan soxta Reflector. */
function publicReflector(): Reflector {
  return { getAllAndOverride: (key: string) => (key === IS_PUBLIC_KEY ? true : undefined) } as unknown as Reflector;
}

function ctxWith(headers: Record<string, any>): { ctx: ExecutionContext; request: any } {
  const request: any = { headers };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
  return { ctx, request };
}

describe('AuthGuard', () => {
  beforeAll(() => {
    process.env.AUTH_JWT_SECRET = 'b'.repeat(32);
  });

  it('Authorization sarlavhasi yo\'q -> UnauthorizedException', async () => {
    const prisma = { user: { findUnique: jest.fn() } } as any;
    const guard = new AuthGuard(prisma, noopReflector);
    const { ctx } = ctxWith({});

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('"Bearer" bo\'lmagan sxema -> UnauthorizedException', async () => {
    const prisma = { user: { findUnique: jest.fn() } } as any;
    const guard = new AuthGuard(prisma, noopReflector);
    const { ctx } = ctxWith({ authorization: 'Basic dXNlcjpwYXNz' });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('soxta/imzosiz token -> UnauthorizedException (userId endi kirish uchun yetarli emas)', async () => {
    const prisma = { user: { findUnique: jest.fn() } } as any;
    const guard = new AuthGuard(prisma, noopReflector);
    const { ctx } = ctxWith({ authorization: 'Bearer just-a-user-id' });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('muddati o\'tgan token -> UnauthorizedException', async () => {
    const expired = signToken({ sub: 'u1' }, -10);
    const prisma = { user: { findUnique: jest.fn() } } as any;
    const guard = new AuthGuard(prisma, noopReflector);
    const { ctx } = ctxWith({ authorization: `Bearer ${expired}` });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('yaroqli token, lekin foydalanuvchi bazada yo\'q -> UnauthorizedException', async () => {
    const token = signToken({ sub: 'ghost' });
    const prisma = { user: { findUnique: jest.fn(async () => null) } } as any;
    const guard = new AuthGuard(prisma, noopReflector);
    const { ctx } = ctxWith({ authorization: `Bearer ${token}` });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('yaroqli token + mavjud foydalanuvchi + mos tv -> ruxsat, request.dbUser biriktiriladi', async () => {
    const token = signToken({ sub: 'u1', email: 'a@b.com', tv: 0 });
    const user = { id: 'u1', email: 'a@b.com', tokenVersion: 0 };
    const prisma = { user: { findUnique: jest.fn(async () => user) } } as any;
    const guard = new AuthGuard(prisma, noopReflector);
    const { ctx, request } = ctxWith({ authorization: `Bearer ${token}` });

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(request.dbUser).toEqual(user);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'u1' } });
  });

  // SEC-03
  it('DoD: deploy\'dan oldingi eski token (tv yo\'q) -> UnauthorizedException', async () => {
    // Deploy'dan oldin berilgan har qanday token — tv maydoni umuman yo'q.
    const oldToken = signToken({ sub: 'u1', email: 'a@b.com' });
    const user = { id: 'u1', email: 'a@b.com', tokenVersion: 0 };
    const prisma = { user: { findUnique: jest.fn(async () => user) } } as any;
    const guard = new AuthGuard(prisma, noopReflector);
    const { ctx } = ctxWith({ authorization: `Bearer ${oldToken}` });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('tv mos kelmasa (bekor qilingan — masalan 2FA yoqilgandan keyingi eski token) -> UnauthorizedException', async () => {
    const staleToken = signToken({ sub: 'u1', email: 'a@b.com', tv: 0 });
    // Foydalanuvchi keyinchalik 2FA yoqdi -> tokenVersion 1ga oshdi
    const user = { id: 'u1', email: 'a@b.com', tokenVersion: 1 };
    const prisma = { user: { findUnique: jest.fn(async () => user) } } as any;
    const guard = new AuthGuard(prisma, noopReflector);
    const { ctx } = ctxWith({ authorization: `Bearer ${staleToken}` });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('yangi (oshirilgan) tv bilan berilgan token -> ruxsat', async () => {
    const freshToken = signToken({ sub: 'u1', email: 'a@b.com', tv: 1 });
    const user = { id: 'u1', email: 'a@b.com', tokenVersion: 1 };
    const prisma = { user: { findUnique: jest.fn(async () => user) } } as any;
    const guard = new AuthGuard(prisma, noopReflector);
    const { ctx, request } = ctxWith({ authorization: `Bearer ${freshToken}` });

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(request.dbUser).toEqual(user);
  });

  // SEC-05 (Option B)
  it("@Public() -> ruxsat, token butunlay tekshirilmaydi (dbUser o'rnatilmaydi)", async () => {
    const prisma = { user: { findUnique: jest.fn() } } as any;
    const guard = new AuthGuard(prisma, publicReflector());
    const { ctx, request } = ctxWith({}); // Authorization sarlavhasi UMUMAN yo'q

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(request.dbUser).toBeUndefined();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
