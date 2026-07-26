import { ForbiddenException } from '@nestjs/common';

const verifyMock = jest.fn();
jest.mock('svix', () => ({
  Webhook: jest.fn().mockImplementation(() => ({ verify: verifyMock })),
}));

import { AuthController } from './auth.controller';

/**
 * dev-login production'da butunlay o'chirilganini tekshiradi — bu FAZA X
 * auditida topilgan eng jiddiy zaiflikning tuzatilishi: production'da
 * dev-login orqali istalgan email/telefon bilan hisobga kirib bo'lmasligi kerak.
 */
describe('AuthController.devLogin — production gate', () => {
  const clerkSync = { devLogin: jest.fn(async () => ({ token: 'x' })) } as any;
  const twoFactor = {} as any;
  const otp = {} as any;

  afterEach(() => {
    delete process.env.NODE_ENV;
    jest.clearAllMocks();
  });

  it('NODE_ENV=production bo\'lsa ForbiddenException otadi va devLogin chaqirilmaydi', async () => {
    process.env.NODE_ENV = 'production';
    const controller = new AuthController(clerkSync, twoFactor, otp);

    await expect(controller.devLogin({ email: 'a@b.com' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(clerkSync.devLogin).not.toHaveBeenCalled();
  });

  it('production bo\'lmasa oddiy ishlaydi', async () => {
    process.env.NODE_ENV = 'test';
    const controller = new AuthController(clerkSync, twoFactor, otp);

    const res = await controller.devLogin({ email: 'a@b.com' });
    expect(res).toEqual({ token: 'x' });
    expect(clerkSync.devLogin).toHaveBeenCalledWith({ email: 'a@b.com' });
  });
});

/**
 * AuthController.clerkWebhook — svix imzo tekshiruvi XOM baytlar ustida
 * ishlashi SHART (main.ts'dagi rawBody:true shu yerga bog'liq). Soxta yoki
 * eskirgan imzo bilan hech qanday webhook DB'ga tegmasligi kerak.
 */
describe('AuthController.clerkWebhook', () => {
  const ORIGINAL_ENV = process.env;
  const clerkSync = { devLogin: jest.fn(), handleWebhook: jest.fn(async () => {}) } as any;
  const twoFactor = {} as any;
  const otp = {} as any;
  const headers = { 'svix-id': 'id1', 'svix-timestamp': 'ts1', 'svix-signature': 'sig1' };

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, CLERK_WEBHOOK_SECRET: 'whsec_test' };
    jest.clearAllMocks();
    verifyMock.mockReset();
  });
  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("CLERK_WEBHOOK_SECRET sozlanmagan bo'lsa -> BadRequestException, verify chaqirilmaydi", async () => {
    delete process.env.CLERK_WEBHOOK_SECRET;
    const controller = new AuthController(clerkSync, twoFactor, otp);
    const req = { rawBody: Buffer.from('{}') } as any;

    await expect(
      controller.clerkWebhook('id1', 'ts1', 'sig1', req),
    ).rejects.toMatchObject({ status: 400 });
    expect(clerkSync.handleWebhook).not.toHaveBeenCalled();
  });

  it("req.rawBody yo'q bo'lsa -> BadRequestException ('rawBody: true' sozlanmagan holatni tutadi)", async () => {
    const controller = new AuthController(clerkSync, twoFactor, otp);
    const req = {} as any;

    await expect(
      controller.clerkWebhook('id1', 'ts1', 'sig1', req),
    ).rejects.toMatchObject({ status: 400 });
    expect(clerkSync.handleWebhook).not.toHaveBeenCalled();
  });

  it("svix imzosi yaroqsiz bo'lsa (wh.verify istisno tashlaydi) -> BadRequestException, DB'ga tegilmaydi", async () => {
    verifyMock.mockImplementation(() => {
      throw new Error('imzo mos kelmadi');
    });
    const controller = new AuthController(clerkSync, twoFactor, otp);
    const req = { rawBody: Buffer.from('{"type":"user.created"}') } as any;

    await expect(
      controller.clerkWebhook('id1', 'ts1', 'sig1', req),
    ).rejects.toMatchObject({ status: 400 });
    expect(clerkSync.handleWebhook).not.toHaveBeenCalled();
  });

  it("imzo yaroqli bo'lsa -> xom baytlar ustida tekshiriladi va tasdiqlangan event ClerkSyncService'ga uzatiladi", async () => {
    const event = { type: 'user.created', data: { id: 'clerk_1' } };
    verifyMock.mockReturnValue(event);
    const controller = new AuthController(clerkSync, twoFactor, otp);
    const req = { rawBody: Buffer.from('{"type":"user.created"}') } as any;

    const res = await controller.clerkWebhook('id1', 'ts1', 'sig1', req);

    expect(verifyMock).toHaveBeenCalledWith('{"type":"user.created"}', headers);
    expect(clerkSync.handleWebhook).toHaveBeenCalledWith(event);
    expect(res).toEqual({ received: true });
  });
});
