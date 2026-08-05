import { BadRequestException, HttpException, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { OtpService } from './otp.service';

/**
 * OtpService — dev-login o'rnini bosuvchi haqiqiy autentifikatsiya oqimi.
 * Eng muhim tekshiruv: `completeTwoFactorLogin` 2FA yoqilmagan foydalanuvchi
 * uchun HECH QACHON token bermasligi kerak (aks holda TwoFactorService.verifyLogin
 * ning "2FA yo'q -> true" xulqi orqali autentifikatsiyasiz token olish mumkin bo'lardi).
 */

beforeAll(() => {
  process.env.AUTH_JWT_SECRET = 'test-secret-'.repeat(4);
});

function hashCode(identifier: string, code: string): string {
  const pepper = process.env.AUTH_JWT_SECRET!;
  return crypto.createHash('sha256').update(`${identifier}:${code}:${pepper}`).digest('hex');
}

function makeDeps() {
  const prisma: any = {
    otpCode: {
      findFirst: jest.fn(async () => null),
      create: jest.fn(async (a: any) => ({ id: 'otp1', attempts: 0, ...a.data })),
      update: jest.fn(async (a: any) => a),
    },
    user: {
      findUnique: jest.fn(async () => null),
    },
  };
  const email = { sendOtpCode: jest.fn(async () => undefined) };
  const sms = { isConfigured: jest.fn(() => false), sendOtpCode: jest.fn(async () => undefined) };
  const auth = {
    normalizePhone: jest.fn((p: string) => (/^\+?\d{7,15}$/.test(p.replace(/\s/g, '')) ? `+${p.replace(/\D/g, '')}` : null)),
    findOrCreateUser: jest.fn(async (input: any) => ({
      user: {
        id: 'u1',
        email: input.email ?? 'phone@x.agentnet',
        phone: input.phone ?? null,
        role: 'MEMBER',
        name: null,
        twoFactorEnabled: false,
      },
      isNewUser: false,
    })),
    issueSession: jest.fn((u: any, isNewUser: boolean) => ({
      userId: u.id,
      email: u.email,
      phone: u.phone,
      name: u.name,
      role: u.role,
      isNewUser,
      token: 'signed.jwt.token',
    })),
  };
  const auditLog = { record: jest.fn(async () => undefined) };
  const twoFactor = { verifyLogin: jest.fn(async () => true) };
  const referral = { applyReferralOnSignup: jest.fn(async () => true) };

  const svc = new OtpService(
    prisma,
    email as any,
    sms as any,
    auth as any,
    auditLog as any,
    twoFactor as any,
    referral as any,
  );
  return { svc, prisma, email, sms, auth, auditLog, twoFactor, referral };
}

describe('OtpService.requestOtp', () => {
  it('email uchun kod yaratadi, hash saqlaydi va yuboradi', async () => {
    const { svc, prisma, email } = makeDeps();
    const res = await svc.requestOtp({ email: 'A@B.com' });

    expect(res).toEqual({ sent: true, channel: 'email', expiresInSec: 600 });
    expect(prisma.otpCode.create).toHaveBeenCalledTimes(1);
    const data = prisma.otpCode.create.mock.calls[0][0].data;
    expect(data.identifier).toBe('a@b.com');
    expect(data.channel).toBe('email');
    expect(typeof data.codeHash).toBe('string');
    expect(email.sendOtpCode).toHaveBeenCalledWith('a@b.com', expect.stringMatching(/^\d{6}$/));
  });

  it("yaroqsiz email -> BadRequestException", async () => {
    const { svc } = makeDeps();
    await expect(svc.requestOtp({ email: 'not-an-email' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('so\'nggi kod hali amal qilsa (1 daqiqa ichida) -> 429', async () => {
    const { svc, prisma } = makeDeps();
    prisma.otpCode.findFirst.mockResolvedValueOnce({ id: 'recent', createdAt: new Date() });
    await expect(svc.requestOtp({ email: 'a@b.com' })).rejects.toBeInstanceOf(HttpException);
  });

  it('Eskiz sozlanmagan bo\'lsa telefon-OTP rad etiladi (jim yutqazmaydi)', async () => {
    const { svc, sms } = makeDeps();
    sms.isConfigured.mockReturnValue(false);
    await expect(svc.requestOtp({ phone: '+998901234567' })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('OtpService.verifyOtp', () => {
  it("to'g'ri kod -> foydalanuvchi topiladi/yaratiladi va sessiya beriladi (2FA yo'q)", async () => {
    const { svc, prisma, auth } = makeDeps();
    const code = '123456';
    prisma.otpCode.findFirst.mockResolvedValueOnce({
      id: 'otp1',
      attempts: 0,
      expiresAt: new Date(Date.now() + 60_000),
      codeHash: hashCode('a@b.com', code),
    });

    const res = await svc.verifyOtp({ email: 'A@B.com', code });

    expect(prisma.otpCode.update).toHaveBeenCalledWith({
      where: { id: 'otp1' },
      data: { consumedAt: expect.any(Date) },
    });
    expect(auth.findOrCreateUser).toHaveBeenCalledWith({ email: 'a@b.com' }, { action: 'auth.otp_login' });
    expect(res).toMatchObject({ needsTwoFactor: false, token: 'signed.jwt.token' });
  });

  it("noto'g'ri kod -> attempts oshadi, BadRequestException", async () => {
    const { svc, prisma } = makeDeps();
    prisma.otpCode.findFirst.mockResolvedValueOnce({
      id: 'otp1',
      attempts: 0,
      expiresAt: new Date(Date.now() + 60_000),
      codeHash: hashCode('a@b.com', '999999'),
    });

    await expect(svc.verifyOtp({ email: 'a@b.com', code: '111111' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.otpCode.update).toHaveBeenCalledWith({
      where: { id: 'otp1' },
      data: { attempts: { increment: 1 } },
    });
  });

  it("kod topilmasa yoki muddati o'tgan bo'lsa -> BadRequestException", async () => {
    const { svc, prisma } = makeDeps();
    prisma.otpCode.findFirst.mockResolvedValueOnce(null);
    await expect(svc.verifyOtp({ email: 'a@b.com', code: '123456' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('urinishlar tugagan bo\'lsa -> 429', async () => {
    const { svc, prisma } = makeDeps();
    prisma.otpCode.findFirst.mockResolvedValueOnce({
      id: 'otp1',
      attempts: 5,
      expiresAt: new Date(Date.now() + 60_000),
      codeHash: hashCode('a@b.com', '123456'),
    });
    await expect(svc.verifyOtp({ email: 'a@b.com', code: '123456' })).rejects.toBeInstanceOf(HttpException);
  });

  it('2FA yoqilgan foydalanuvchi -> token bermaydi, needsTwoFactor qaytaradi', async () => {
    const { svc, prisma, auth } = makeDeps();
    const code = '654321';
    prisma.otpCode.findFirst.mockResolvedValueOnce({
      id: 'otp1',
      attempts: 0,
      expiresAt: new Date(Date.now() + 60_000),
      codeHash: hashCode('a@b.com', code),
    });
    auth.findOrCreateUser.mockResolvedValueOnce({
      user: { id: 'u2', email: 'a@b.com', phone: null, role: 'MEMBER', name: null, twoFactorEnabled: true },
      isNewUser: false,
    });

    const res = await svc.verifyOtp({ email: 'a@b.com', code });
    expect(res).toEqual({ needsTwoFactor: true, userId: 'u2' });
  });
});

describe('OtpService.completeTwoFactorLogin — bypass himoyasi', () => {
  it("2FA yoqilmagan foydalanuvchi uchun UnauthorizedException (verifyLogin hech qachon chaqirilmaydi)", async () => {
    const { svc, prisma, twoFactor } = makeDeps();
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'u1', twoFactorEnabled: false });

    await expect(svc.completeTwoFactorLogin('u1', '000000')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(twoFactor.verifyLogin).not.toHaveBeenCalled();
  });

  it('foydalanuvchi topilmasa -> UnauthorizedException', async () => {
    const { svc, prisma } = makeDeps();
    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(svc.completeTwoFactorLogin('ghost', '000000')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("2FA yoqilgan + to'g'ri TOTP -> sessiya beradi", async () => {
    const { svc, prisma, twoFactor, auth } = makeDeps();
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'u1',
      email: 'a@b.com',
      phone: null,
      role: 'MEMBER',
      name: null,
      twoFactorEnabled: true,
    });
    twoFactor.verifyLogin.mockResolvedValueOnce(true);

    const res = await svc.completeTwoFactorLogin('u1', '123456');
    expect(twoFactor.verifyLogin).toHaveBeenCalledWith('u1', '123456');
    expect(auth.issueSession).toHaveBeenCalled();
    expect(res).toMatchObject({ needsTwoFactor: false, token: 'signed.jwt.token' });
  });

  it("2FA yoqilgan lekin noto'g'ri TOTP -> UnauthorizedException", async () => {
    const { svc, prisma, twoFactor } = makeDeps();
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'u1', twoFactorEnabled: true });
    twoFactor.verifyLogin.mockResolvedValueOnce(false);

    await expect(svc.completeTwoFactorLogin('u1', '000000')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
