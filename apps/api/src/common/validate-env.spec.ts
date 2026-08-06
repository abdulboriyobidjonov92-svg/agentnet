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
