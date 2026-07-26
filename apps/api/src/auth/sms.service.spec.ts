import { SmsService } from './sms.service';

/**
 * SmsService — Eskiz.uz token-keshlash (auth/login har safar chaqirilmasin),
 * 401 bo'lsa bir marta majburiy qayta autentifikatsiya, va sozlanmagan
 * holatda halol rad (soxta "yuborildi" YO'Q).
 */

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe('SmsService', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, ESKIZ_EMAIL: 'bot@agentnet.app', ESKIZ_PASSWORD: 'secret' };
    global.fetch = jest.fn();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('isConfigured — ESKIZ_EMAIL/ESKIZ_PASSWORD ikkalasi ham kerak', () => {
    const svc = new SmsService();
    expect(svc.isConfigured()).toBe(true);

    delete process.env.ESKIZ_PASSWORD;
    expect(new SmsService().isConfigured()).toBe(false);
  });

  it("sozlanmagan bo'lsa fetch UMUMAN chaqirilmasdan rad etadi", async () => {
    delete process.env.ESKIZ_EMAIL;
    delete process.env.ESKIZ_PASSWORD;
    const svc = new SmsService();

    await expect(svc.sendOtpCode('+998901234567', '123456')).rejects.toThrow(
      'SMS orqali kirish hozircha mavjud emas',
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("muvaffaqiyatli yuborish — login qilib token oladi, '+' ni telefon raqamidan olib tashlaydi", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(jsonResponse({ data: { token: 'tok-1' } })) // auth/login
      .mockResolvedValueOnce(jsonResponse({ ok: true })); // message/sms/send
    const svc = new SmsService();

    await svc.sendOtpCode('+998901234567', '654321');

    expect(global.fetch).toHaveBeenCalledTimes(2);
    const [loginUrl] = (global.fetch as jest.Mock).mock.calls[0];
    const [sendUrl, sendOpts] = (global.fetch as jest.Mock).mock.calls[1];
    expect(loginUrl).toContain('/auth/login');
    expect(sendUrl).toContain('/message/sms/send');
    expect(sendOpts.headers.Authorization).toBe('Bearer tok-1');
    const body = JSON.parse(sendOpts.body);
    expect(body.mobile_phone).toBe('998901234567');
    expect(body.message).toContain('654321');
  });

  it('tokenni keshlaydi — ketma-ket ikkita yuborishda login FAQAT bir marta chaqiriladi', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(jsonResponse({ data: { token: 'tok-1' } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const svc = new SmsService();

    await svc.sendOtpCode('998901234567', '111111');
    await svc.sendOtpCode('998901234567', '222222');

    const loginCalls = (global.fetch as jest.Mock).mock.calls.filter(([url]) => url.includes('/auth/login'));
    expect(loginCalls).toHaveLength(1);
  });

  it('yuborish 401 qaytarsa — token tozalanadi va BIR MARTA qayta autentifikatsiya qilib qayta urinadi', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(jsonResponse({ data: { token: 'eskirgan' } })) // 1-login
      .mockResolvedValueOnce(jsonResponse({}, false, 401)) // 1-urinish -> 401
      .mockResolvedValueOnce(jsonResponse({ data: { token: 'yangi' } })) // 2-login
      .mockResolvedValueOnce(jsonResponse({ ok: true })); // 2-urinish -> muvaffaqiyat
    const svc = new SmsService();

    await expect(svc.sendOtpCode('998901234567', '333333')).resolves.toBeUndefined();
    expect(global.fetch).toHaveBeenCalledTimes(4);
    const lastCall = (global.fetch as jest.Mock).mock.calls[3];
    expect(lastCall[1].headers.Authorization).toBe('Bearer yangi');
  });

  it("muvaffaqiyatsiz (non-401) javob -> aniq xato", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(jsonResponse({ data: { token: 'tok-1' } }))
      .mockResolvedValueOnce(jsonResponse({}, false, 500));
    const svc = new SmsService();

    await expect(svc.sendOtpCode('998901234567', '444444')).rejects.toThrow(
      "SMS yuborib bo'lmadi, birozdan so'ng qayta urinib ko'ring",
    );
  });

  it("Eskiz autentifikatsiyasi muvaffaqiyatsiz bo'lsa -> aniq xato", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse({}, false, 500));
    const svc = new SmsService();

    await expect(svc.sendOtpCode('998901234567', '555555')).rejects.toThrow(
      "Eskiz autentifikatsiyasi muvaffaqiyatsiz bo'ldi",
    );
  });

  it("login javobida token bo'lmasa -> aniq xato", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse({ data: {} }));
    const svc = new SmsService();

    await expect(svc.sendOtpCode('998901234567', '666666')).rejects.toThrow('Eskiz token qaytarilmadi');
  });
});
