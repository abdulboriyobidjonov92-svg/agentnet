import type { ErrorEvent } from '@sentry/node';
import { REDACTED, resetSecretValueCache } from './redaction';
import {
  captureException,
  isSentryInitialized,
  resetSentryInitState,
  resolveSentryConfig,
  scrubBreadcrumb,
  scrubSentryEvent,
} from './sentry';

/**
 * Phase 5 (P5.1) — Sentry testlari.
 *
 * IKKI DA'VONI isbotlaydi:
 *   1. Sozlanmagan Sentry ilovani HECH QANDAY yo'l bilan buzmaydi
 *      (dev/test'da ixtiyoriy);
 *   2. Sozlangan holatda ham hodisaga sir/PII BIRIKMAYDI.
 */
describe('Sentry — konfiguratsiya (ixtiyoriylik)', () => {
  afterEach(() => resetSentryInitState());

  it("DSN yo'q — o'chirilgan (dev/test'da majburiy emas)", () => {
    const config = resolveSentryConfig({ NODE_ENV: 'development' });
    expect(config.enabled).toBe(false);
    expect(config.reason).toBe('dsn_missing');
  });

  it("NODE_ENV=test — DSN bo'lsa ham o'chirilgan (test tarmoqqa chiqmaydi)", () => {
    const config = resolveSentryConfig({
      NODE_ENV: 'test',
      SENTRY_DSN: 'https://key@o1.ingest.sentry.io/1',
    });
    expect(config.enabled).toBe(false);
    expect(config.reason).toBe('test_env');
  });

  it("SENTRY_ENABLED=0 — operator favqulodda o'chirgichi ishlaydi", () => {
    const config = resolveSentryConfig({
      NODE_ENV: 'production',
      SENTRY_DSN: 'https://key@o1.ingest.sentry.io/1',
      SENTRY_ENABLED: '0',
    });
    expect(config.enabled).toBe(false);
    expect(config.reason).toBe('disabled_by_env');
  });

  it('production + DSN — yoqiladi', () => {
    const config = resolveSentryConfig({
      NODE_ENV: 'production',
      SENTRY_DSN: 'https://key@o1.ingest.sentry.io/1',
      SENTRY_ENVIRONMENT: 'production',
      SENTRY_RELEASE: 'abc123',
    });
    expect(config.enabled).toBe(true);
    expect(config.environment).toBe('production');
    expect(config.release).toBe('abc123');
  });

  it('trace namunasi 0..1 dan tashqarida bo‘lsa 0 ga tushadi', () => {
    expect(resolveSentryConfig({ SENTRY_TRACES_SAMPLE_RATE: '5' }).tracesSampleRate).toBe(0);
    expect(resolveSentryConfig({ SENTRY_TRACES_SAMPLE_RATE: '-1' }).tracesSampleRate).toBe(0);
    expect(resolveSentryConfig({ SENTRY_TRACES_SAMPLE_RATE: 'abc' }).tracesSampleRate).toBe(0);
    expect(resolveSentryConfig({ SENTRY_TRACES_SAMPLE_RATE: '0.25' }).tracesSampleRate).toBe(0.25);
  });

  it("sozlanmagan Sentry'da captureException TASHLAMAYDI va init qilmaydi", () => {
    resetSentryInitState();
    expect(isSentryInitialized()).toBe(false);
    expect(() => captureException(new Error('x'), { requestId: 'r1' })).not.toThrow();
    expect(isSentryInitialized()).toBe(false);
  });
});

describe('Sentry — hodisa tozalash (beforeSend)', () => {
  const env: NodeJS.ProcessEnv = {
    INTERNAL_API_TOKEN: 'internal-token-value-secret-123',
    ENCRYPTION_KEY: 'ffeeddccbbaa99887766554433221100',
  };

  beforeEach(() => resetSecretValueCache());
  afterEach(() => resetSecretValueCache());

  function baseEvent(): ErrorEvent {
    return {
      type: undefined,
      message: 'nomalum xato',
    } as ErrorEvent;
  }

  it('so‘rov sarlavhalari (authorization/cookie) tozalanadi', () => {
    const event = baseEvent();
    event.request = {
      headers: {
        authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.abcdefghij.klmnopqrst',
        cookie: 'agentnet_token=abc; agentnet_imp=def',
        'x-internal-token': env.INTERNAL_API_TOKEN as string,
        'x-request-id': 'req-1234-5678',
      },
    };
    const out = scrubSentryEvent(event, undefined, env)!;
    expect(out.request!.headers!.authorization).toBe(REDACTED);
    expect(out.request!.headers!.cookie).toBe(REDACTED);
    expect(out.request!.headers!['x-internal-token']).toBe(REDACTED);
    expect(out.request!.headers!['x-request-id']).toBe('req-1234-5678');
  });

  it('cookie obyekti butunlay almashtiriladi', () => {
    const event = baseEvent();
    event.request = { cookies: { agentnet_token: 'jwt-value', agentnet_imp: 'imp-value' } };
    const out = scrubSentryEvent(event, undefined, env)!;
    expect(JSON.stringify(out.request!.cookies)).not.toContain('jwt-value');
    expect(JSON.stringify(out.request!.cookies)).not.toContain('imp-value');
  });

  it('so‘rov tanasi (parol) tozalanadi', () => {
    const event = baseEvent();
    event.request = { data: { email: 'a@b.uz', password: 'hunter2', otp: '123456' } };
    const out = scrubSentryEvent(event, undefined, env)!;
    const data = out.request!.data as Record<string, unknown>;
    expect(data.password).toBe(REDACTED);
    expect(data.otp).toBe(REDACTED);
  });

  it('exception matni va stack-frame lokal o‘zgaruvchilari tozalanadi', () => {
    const event = baseEvent();
    event.exception = {
      values: [
        {
          type: 'Error',
          value: `engine chaqiruvi muvaffaqiyatsiz: token=${env.INTERNAL_API_TOKEN}`,
          stacktrace: {
            frames: [{ filename: 'x.ts', vars: { encryptionKey: env.ENCRYPTION_KEY as string } }],
          },
        },
      ],
    };
    const out = scrubSentryEvent(event, undefined, env)!;
    const value = out.exception!.values![0];
    expect(value.value).not.toContain(env.INTERNAL_API_TOKEN);
    expect(value.stacktrace!.frames![0].vars!.encryptionKey).toBe(REDACTED);
  });

  it('foydalanuvchi kontekstidan FAQAT id qoladi (email/IP tushmaydi)', () => {
    const event = baseEvent();
    event.user = { id: 'u_123', email: 'ali@example.uz', ip_address: '10.0.0.5', username: 'ali' };
    const out = scrubSentryEvent(event, undefined, env)!;
    expect(out.user).toEqual({ id: 'u_123' });
  });

  it('extra va tag qiymatlari tozalanadi', () => {
    const event = baseEvent();
    event.extra = { connectorCredential: 'secret-value', note: 'ok' };
    event.tags = { dsn: `token ${env.INTERNAL_API_TOKEN}` };
    const out = scrubSentryEvent(event, undefined, env)!;
    expect((out.extra as Record<string, unknown>).connectorCredential).toBe(REDACTED);
    expect(out.tags!.dsn).not.toContain(env.INTERNAL_API_TOKEN);
  });

  it('breadcrumb matni va data si tozalanadi', () => {
    const crumb = scrubBreadcrumb(
      {
        category: 'http',
        message: `GET /api/x?token=${env.INTERNAL_API_TOKEN}`,
        data: { authorization: 'Bearer abcdefghijkl' },
      },
      env,
    )!;
    expect(crumb.message).not.toContain(env.INTERNAL_API_TOKEN);
    expect((crumb.data as Record<string, unknown>).authorization).toBe(REDACTED);
  });

  it('query string va URL tozalanadi', () => {
    const event = baseEvent();
    event.request = {
      url: `https://api.agentnet.app/api/x?internal=${env.INTERNAL_API_TOKEN}`,
      query_string: `internal=${env.INTERNAL_API_TOKEN}`,
    };
    const out = scrubSentryEvent(event, undefined, env)!;
    expect(out.request!.url).not.toContain(env.INTERNAL_API_TOKEN);
    expect(out.request!.query_string).not.toContain(env.INTERNAL_API_TOKEN);
  });
});
