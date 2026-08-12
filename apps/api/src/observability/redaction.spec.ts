import {
  REDACTED,
  isSensitiveHeader,
  isSensitiveKey,
  resetSecretValueCache,
  scrubHeaders,
  scrubText,
  scrubValue,
} from './redaction';

/**
 * Phase 5 (P5.1/P5.2/P5.8) — REDAKSIYA TESTLARI.
 *
 * Bu to'plam "sir telemetriyaga chiqmaydi" da'vosining YAGONA isboti.
 * Har test aniq bitta sir turini qamraydi; yangi sir turi qo'shilsa,
 * bu yerga ham test qo'shiladi (aks holda da'vo isbotsiz qoladi).
 */
describe('redaction — qiymat bo\'yicha (env sirlari)', () => {
  const env: NodeJS.ProcessEnv = {
    // ATAYLAB past-entropiyali (32 belgili hex, faqat 2 xil belgi):
    // gitleaks `generic-api-key` qoidasi `KEY` kalit so'zi + YUQORI
    // entropiyali qiymatni ushlaydi va bu fixture CI'ni qizartirardi.
    // Redaksiya testi uchun qiymatning TASODIFIYLIGI ahamiyatsiz —
    // muhimi u chiqishda UCHRAMASLIGI.
    ENCRYPTION_KEY: 'aaaaaaaabbbbbbbbaaaaaaaabbbbbbbb',
    INTERNAL_API_TOKEN: 'super-secret-internal-token-value',
    AUTH_JWT_SECRET: 'jwt-signing-secret-not-for-logs',
    ANTHROPIC_API_KEY: 'sk-ant-api03-REALKEYVALUE1234567890',
    DATABASE_URL: 'postgresql://agentnet:realpassword@db.internal:5432/agentnet',
    TELEGRAM_BOT_TOKEN: '123456789:AAFakeButRealShapedTelegramTokenXYZ',
  };

  beforeEach(() => resetSecretValueCache());
  afterEach(() => resetSecretValueCache());

  it('ENCRYPTION_KEY qiymati matndan olib tashlanadi', () => {
    const out = scrubText(`kalit: ${env.ENCRYPTION_KEY} bilan shifrlandi`, env);
    expect(out).not.toContain(env.ENCRYPTION_KEY);
    expect(out).toContain(REDACTED);
  });

  it('INTERNAL_API_TOKEN qiymati olib tashlanadi', () => {
    const out = scrubText(`x-internal-token: ${env.INTERNAL_API_TOKEN}`, env);
    expect(out).not.toContain(env.INTERNAL_API_TOKEN);
  });

  it('AUTH_JWT_SECRET qiymati olib tashlanadi', () => {
    const out = scrubText(`imzo kaliti = ${env.AUTH_JWT_SECRET}`, env);
    expect(out).not.toContain(env.AUTH_JWT_SECRET);
  });

  it('DATABASE_URL (parol bilan) olib tashlanadi', () => {
    const out = scrubText(`ulanish: ${env.DATABASE_URL}`, env);
    expect(out).not.toContain('realpassword');
  });

  it("8 belgidan qisqa env qiymati qidirilmaydi (yolg'on-musbat oldini olish)", () => {
    resetSecretValueCache();
    const shortEnv = { INTERNAL_API_TOKEN: 'dev' };
    // "dev" so'zi oddiy matnda uchraydi — u redaksiya qilinsa har log buzilardi.
    expect(scrubText('development rejimi', shortEnv)).toBe('development rejimi');
  });
});

describe('redaction — shakl bo\'yicha (env\'siz ham ishlaydi)', () => {
  beforeEach(() => resetSecretValueCache());

  it('HS256 JWT (sessiya tokeni) olib tashlanadi', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzEyMyIsInR2IjoxfQ.4f9Xk2Lm7Qw1Zb8Nc0Vd3Ye6Rf5Tg2Hj';
    const out = scrubText(`Authorization qiymati: ${jwt}`, {});
    expect(out).not.toContain('eyJhbGciOiJIUzI1NiI');
    expect(out).toContain(REDACTED);
  });

  it('`Bearer <token>` olib tashlanadi', () => {
    const out = scrubText('header: Bearer abc123def456ghi789', {});
    expect(out).not.toContain('abc123def456ghi789');
  });

  it('`sk-ant-...` LLM kaliti olib tashlanadi', () => {
    const out = scrubText('anthropic: sk-ant-api03-AAAABBBBCCCCDDDD', {});
    expect(out).not.toContain('sk-ant-api03-AAAABBBBCCCCDDDD');
  });

  it('Resend kaliti (`re_...`) olib tashlanadi', () => {
    const out = scrubText('resend: re_ABCDEFGH12345678ijkl', {});
    expect(out).not.toContain('re_ABCDEFGH12345678ijkl');
  });

  it('Telegram bot tokeni olib tashlanadi', () => {
    const out = scrubText('bot 987654321:AAHfakeTelegramTokenValue0123456789abcdef ishlatildi', {});
    expect(out).not.toContain('AAHfakeTelegramTokenValue0123456789abcdef');
  });

  it("kredensialli ulanish satri (env'da bo'lmasa ham) olib tashlanadi", () => {
    const out = scrubText('redis://user:pass@cache.internal:6379/0', {});
    expect(out).not.toContain('pass@cache.internal');
  });

  it('Sentry DSN ning o‘zi ham sir sifatida olib tashlanadi', () => {
    const out = scrubText('dsn=https://abc123def456@o1.ingest.sentry.io/42', {});
    expect(out).not.toContain('abc123def456@o1.ingest.sentry.io');
  });

  it('cuid identifikatorlari SAQLANADI (diagnostika buzilmasin)', () => {
    const text = 'agent clx1k2j3m4n5o6p7q8r9s0t1 yaratildi';
    expect(scrubText(text, {})).toBe(text);
  });
});

describe('redaction — nom bo\'yicha', () => {
  it('sir sarlavhalar aniqlanadi', () => {
    for (const header of ['authorization', 'Cookie', 'X-Internal-Token', 'x-companion-token']) {
      expect(isSensitiveHeader(header)).toBe(true);
    }
    expect(isSensitiveHeader('x-request-id')).toBe(false);
    expect(isSensitiveHeader('content-type')).toBe(false);
  });

  it('sir kalit nomlari aniqlanadi', () => {
    for (const key of [
      'password',
      'refreshToken',
      'apiKey',
      'clientSecret',
      'encryptedValue',
      'storageState',
      'totpSecret',
    ]) {
      expect(isSensitiveKey(key)).toBe(true);
    }
  });

  it("billing/auth hisoblagichlari SIR EMAS (allowlist)", () => {
    // Bularni o'chirish kuzatuvni foydasiz qilardi — ular son, sir emas.
    for (const key of ['tokensIn', 'tokensOut', 'tokenVersion', 'maxTokens']) {
      expect(isSensitiveKey(key)).toBe(false);
    }
  });

  it('sarlavhalar tozalanadi, sir bo‘lmaganlari qoladi', () => {
    const out = scrubHeaders({
      authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.x.y',
      cookie: 'agentnet_token=abc',
      'x-request-id': 'abc-123-def-456',
      'content-type': 'application/json',
    });
    expect(out.authorization).toBe(REDACTED);
    expect(out.cookie).toBe(REDACTED);
    expect(out['x-request-id']).toBe('abc-123-def-456');
    expect(out['content-type']).toBe('application/json');
  });
});

describe('redaction — chuqur obyekt', () => {
  beforeEach(() => resetSecretValueCache());

  it('ichma-ich joylashgan sir kalitlar tozalanadi', () => {
    const out = scrubValue(
      { user: { id: 'u1', profile: { password: 'hunter2', name: 'Ali' } } },
      {},
    ) as Record<string, any>;
    expect(out.user.profile.password).toBe(REDACTED);
    expect(out.user.profile.name).toBe('Ali');
    expect(out.user.id).toBe('u1');
  });

  it('massiv ichidagi obyektlar ham tozalanadi', () => {
    const out = scrubValue([{ apiKey: 'k1' }, { apiKey: 'k2' }], {}) as any[];
    expect(out.every((item) => item.apiKey === REDACTED)).toBe(true);
  });

  it('Error obyekti tozalangan shaklda qaytadi', () => {
    const err = new Error('token bilan xato: Bearer abcdef1234567890');
    const out = scrubValue(err, {}) as { name: string; message: string };
    expect(out.name).toBe('Error');
    expect(out.message).not.toContain('abcdef1234567890');
  });

  it("chuqurlik chegarasidan keyin qiymat JIMGINA o'tib ketmaydi", () => {
    let deep: any = { password: 'leak' };
    for (let i = 0; i < 12; i += 1) deep = { nested: deep };
    const out = JSON.stringify(scrubValue(deep, {}));
    expect(out).not.toContain('leak');
    expect(out).toContain('Depth limit');
  });

  it('funksiya/symbol telemetriyaga chiqmaydi', () => {
    const out = scrubValue({ fn: () => 1, ok: 2 }, {}) as Record<string, unknown>;
    expect(out.fn).toBeUndefined();
    expect(out.ok).toBe(2);
  });
});
