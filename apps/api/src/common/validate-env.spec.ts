import { Logger } from '@nestjs/common';
import { validateEnv } from './validate-env';

/**
 * SEC-10: engine Render'da private service bo'lgani uchun AGENT_ENGINE_URL
 * endi blueprint'dan emas, operator tomonidan kiritiladi. Kodda
 * `http://localhost:8000` fallback'i borligi sababli, u kiritilmasa prod
 * JIMGINA ishlamay qolardi (har engine chaqiruvi uzilardi, boot esa muvaffaqiyatli
 * ko'rinardi). Shu testlar shu env prod'da MAJBURIY ekanini va lokal ishlab
 * chiqish (dev) hech qanday yangi talab olmasligini qulflaydi.
 */
describe('validateEnv — AGENT_ENGINE_URL (SEC-10)', () => {
  const OLD_ENV = process.env;
  let exitSpy: jest.SpyInstance;

  // Prod uchun qolgan HAMMA majburiy env to'liq — shunda test aynan
  // AGENT_ENGINE_URL ta'sirini o'lchaydi, boshqa yetishmovchilikni emas.
  const PROD_ENV_WITHOUT_ENGINE_URL = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    AUTH_JWT_SECRET: 'x'.repeat(32),
    ENCRYPTION_KEY: 'y'.repeat(32),
    INTERNAL_API_TOKEN: 'z'.repeat(32),
    NEXT_PUBLIC_APP_URL: 'https://app.example.com',
    RESEND_API_KEY: 're_test_key',
  };

  beforeEach(() => {
    process.env = { ...PROD_ENV_WITHOUT_ENGINE_URL } as NodeJS.ProcessEnv;
    exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = OLD_ENV;
    jest.restoreAllMocks();
  });

  it('prod: AGENT_ENGINE_URL yo\'q -> boot to\'xtaydi (fail-closed)', () => {
    validateEnv();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('prod: AGENT_ENGINE_URL (xususiy tarmoq manzili) bor -> boot davom etadi', () => {
    process.env.AGENT_ENGINE_URL = 'http://agentnet-engine-2j3e:8000';
    validateEnv();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('prod: bo\'sh/probel qiymat yo\'q deb hisoblanadi', () => {
    process.env.AGENT_ENGINE_URL = '   ';
    validateEnv();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('dev: AGENT_ENGINE_URL yo\'q bo\'lsa ham bloklamaydi (lokal ishlab chiqish saqlanadi)', () => {
    process.env.NODE_ENV = 'development';
    validateEnv();
    expect(exitSpy).not.toHaveBeenCalled();
  });
});

/**
 * SEC-14 — prod'da OCHIQ-OYDIN MA'LUM dev qiymatlari.
 *
 * `INTERNAL_API_TOKEN` ning dev fallback'i (`agentnet-internal-dev`) kodda
 * ham, `.env.example` da ham ochiq turadi — lokal ishlab chiqish uchun
 * ataylab. Prod'da o'sha qiymat qolib ketsa, "ichki server-to-server"
 * darvozasi amalda OCHIQ bo'lardi. `has()` buni ushlamaydi: qiymat MAVJUD.
 */
describe('validateEnv — ommaviy ma\'lum dev qiymatlari (SEC-14)', () => {
  const OLD_ENV = process.env;
  let exitSpy: jest.SpyInstance;

  const FULL_PROD_ENV = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    AUTH_JWT_SECRET: 'x'.repeat(32),
    ENCRYPTION_KEY: 'y'.repeat(32),
    INTERNAL_API_TOKEN: 'z'.repeat(32),
    NEXT_PUBLIC_APP_URL: 'https://app.example.com',
    AGENT_ENGINE_URL: 'http://agentnet-engine-2j3e:8000',
    RESEND_API_KEY: 're_test_key',
  };

  beforeEach(() => {
    process.env = { ...FULL_PROD_ENV } as NodeJS.ProcessEnv;
    exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = OLD_ENV;
    jest.restoreAllMocks();
  });

  it('to\'liq prod konfiguratsiyasi -> boot davom etadi (bazaviy holat)', () => {
    validateEnv();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('prod: INTERNAL_API_TOKEN dev qiymatida qolgan -> boot TO\'XTAYDI', () => {
    process.env.INTERNAL_API_TOKEN = 'agentnet-internal-dev';
    validateEnv();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('xato xabari qiymatning O\'ZINI logga yozmaydi', () => {
    process.env.INTERNAL_API_TOKEN = 'agentnet-internal-dev';
    const errorSpy = jest.spyOn(Logger.prototype, 'error');
    validateEnv();
    const logged = errorSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).toContain('INTERNAL_API_TOKEN');
    expect(logged).not.toContain('agentnet-internal-dev');
  });

  it('dev: o\'sha qiymat BLOKLAMAYDI (lokal ishlab chiqish saqlanadi)', () => {
    process.env.NODE_ENV = 'development';
    process.env.INTERNAL_API_TOKEN = 'agentnet-internal-dev';
    validateEnv();
    expect(exitSpy).not.toHaveBeenCalled();
  });
});
