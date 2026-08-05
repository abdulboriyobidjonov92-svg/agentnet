import { ForbiddenException } from '@nestjs/common';
import { AuthController } from './auth.controller';

/**
 * dev-login production'da butunlay o'chirilganini tekshiradi — bu FAZA X
 * auditida topilgan eng jiddiy zaiflikning tuzatilishi: production'da
 * dev-login orqali istalgan email/telefon bilan hisobga kirib bo'lmasligi kerak.
 */
describe('AuthController.devLogin — production gate', () => {
  const auth = { devLogin: jest.fn(async () => ({ token: 'x' })) } as any;
  const twoFactor = {} as any;
  const otp = {} as any;

  afterEach(() => {
    delete process.env.NODE_ENV;
    jest.clearAllMocks();
  });

  it('NODE_ENV=production bo\'lsa ForbiddenException otadi va devLogin chaqirilmaydi', async () => {
    process.env.NODE_ENV = 'production';
    const controller = new AuthController(auth, twoFactor, otp);

    await expect(controller.devLogin({ email: 'a@b.com' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(auth.devLogin).not.toHaveBeenCalled();
  });

  it('production bo\'lmasa oddiy ishlaydi', async () => {
    process.env.NODE_ENV = 'test';
    const controller = new AuthController(auth, twoFactor, otp);

    const res = await controller.devLogin({ email: 'a@b.com' });
    expect(res).toEqual({ token: 'x' });
    expect(auth.devLogin).toHaveBeenCalledWith({ email: 'a@b.com' });
  });
});

// SEC-03
describe('AuthController.refreshSession', () => {
  it('joriy foydalanuvchi bilan auth.refreshSession chaqiradi va uning natijasini qaytaradi', async () => {
    const auth = { refreshSession: jest.fn(() => ({ token: 'fresh-token' })) } as any;
    const controller = new AuthController(auth, {} as any, {} as any);
    const user = { id: 'u1', email: 'a@b.com', tokenVersion: 2 } as any;

    const res = controller.refreshSession(user);

    expect(auth.refreshSession).toHaveBeenCalledWith(user);
    expect(res).toEqual({ token: 'fresh-token' });
  });
});
