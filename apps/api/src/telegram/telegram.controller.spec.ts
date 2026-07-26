import { UnauthorizedException } from '@nestjs/common';
import { TelegramController } from './telegram.controller';
import type { User } from '@prisma/client';

/**
 * TelegramController.handleWebhook — TELEGRAM_WEBHOOK_SECRET tekshiruvi.
 * Soxta update'lar (secret'siz yoki noto'g'ri secret bilan) rad etilishi
 * SHART, aks holda tashqi odam istalgan foydalanuvchi nomidan buyruq yubora oladi.
 */

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
});
afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('TelegramController.handleWebhook', () => {
  it("TELEGRAM_WEBHOOK_SECRET o'rnatilgan, sarlavha mos kelmasa -> 401, handleUpdate CHAQIRILMAYDI", async () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = 'shh';
    const telegram = { handleUpdate: jest.fn(async () => {}) } as any;
    const controller = new TelegramController(telegram);

    await expect(controller.handleWebhook({ message: {} }, 'noto\'g\'ri')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(telegram.handleUpdate).not.toHaveBeenCalled();
  });

  it("secret sarlavhasi mos kelsa -> handleUpdate chaqiriladi", async () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = 'shh';
    const telegram = { handleUpdate: jest.fn(async () => {}) } as any;
    const controller = new TelegramController(telegram);
    const update = { message: { text: 'salom' } };

    const res = await controller.handleWebhook(update, 'shh');

    expect(telegram.handleUpdate).toHaveBeenCalledWith(update);
    expect(res).toEqual({ ok: true });
  });

  it("TELEGRAM_WEBHOOK_SECRET sozlanmagan bo'lsa -> tekshiruvsiz o'tkazadi (orqaga-moslik)", async () => {
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    const telegram = { handleUpdate: jest.fn(async () => {}) } as any;
    const controller = new TelegramController(telegram);

    await expect(controller.handleWebhook({ message: {} })).resolves.toEqual({ ok: true });
    expect(telegram.handleUpdate).toHaveBeenCalled();
  });
});

describe('TelegramController.linkCode', () => {
  it("joriy foydalanuvchi bilan TelegramService.generateLinkCode'ni chaqiradi", () => {
    const telegram = { generateLinkCode: jest.fn(() => ({ url: 'https://t.me/x?start=abc', code: 'abc' })) } as any;
    const controller = new TelegramController(telegram);
    const user = { id: 'u1' } as unknown as User;

    const res = controller.linkCode(user);

    expect(telegram.generateLinkCode).toHaveBeenCalledWith(user);
    expect(res.code).toBe('abc');
  });
});
