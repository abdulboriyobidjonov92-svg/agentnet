/**
 * EmailService — Resend integratsiyasi. Kalitsiz konfiguratsiya dev'da
 * halol jim turadi (log qiladi, OTP kodni loglaydi), prod'da esa email-OTP
 * so'ralganda ANIQ xato beradi (soxta "yuborildi" YO'Q).
 */

const sendMock = jest.fn();
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({ emails: { send: sendMock } })),
}));

import { Resend } from 'resend';
import { EmailService } from './email.service';

const ResendMock = Resend as unknown as jest.Mock;

describe('EmailService', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.RESEND_API_KEY;
    delete process.env.NODE_ENV;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("RESEND_API_KEY yo'q + dev -> kod yubormaydi, xato bermaydi (loglab qo'yadi)", async () => {
    const svc = new EmailService();

    await expect(svc.sendOtpCode('a@b.com', '123456')).resolves.toBeUndefined();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("RESEND_API_KEY yo'q + PROD -> aniq xato (soxta muvaffaqiyat YO'Q)", async () => {
    process.env.NODE_ENV = 'production';
    const svc = new EmailService();

    await expect(svc.sendOtpCode('a@b.com', '123456')).rejects.toThrow(
      "Email orqali kirish hozircha mavjud emas — iltimos telefon bilan kiring.",
    );
  });

  it('RESEND_API_KEY bor -> Resend orqali yuboradi, kodni HTML ichiga qo\'shadi', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    sendMock.mockResolvedValue({ error: null });
    const svc = new EmailService();

    await svc.sendOtpCode('user@agentnet.app', '654321');

    expect(ResendMock).toHaveBeenCalledWith('test-key');
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'user@agentnet.app', subject: expect.stringContaining('654321') }),
    );
    expect(sendMock.mock.calls[0][0].html).toContain('654321');
  });

  it('Resend xato qaytarsa -> aniq xato otiladi', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    sendMock.mockResolvedValue({ error: { message: 'rate limited' } });
    const svc = new EmailService();

    await expect(svc.sendOtpCode('a@b.com', '111111')).rejects.toThrow(
      "Email yuborib bo'lmadi, birozdan so'ng qayta urinib ko'ring",
    );
  });

  it("RESEND_FROM_EMAIL bo'lmasa standart 'AgentNet <login@agentnet.app>'dan yuboradi", async () => {
    process.env.RESEND_API_KEY = 'test-key';
    delete process.env.RESEND_FROM_EMAIL;
    sendMock.mockResolvedValue({ error: null });
    const svc = new EmailService();

    await svc.sendOtpCode('a@b.com', '222222');

    expect(sendMock.mock.calls[0][0].from).toBe('AgentNet <login@agentnet.app>');
  });
});
