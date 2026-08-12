import { REDACTED, resetSecretValueCache } from './redaction';
import {
  REDACT_PATHS,
  buildPinoHttpOptions,
  isHealthPath,
  resolveLogLevel,
  scrubLogArguments,
  serializeError,
  serializeRequest,
  serializeResponse,
} from './logger.config';

/** Phase 5 (P5.2) — strukturaviy log va uning redaksiyasi. */
describe('pino konfiguratsiyasi', () => {
  it("prod'da JSON (pretty transport YO'Q)", () => {
    const options = buildPinoHttpOptions({ env: { NODE_ENV: 'production' } }) as Record<string, unknown>;
    expect(options.transport).toBeUndefined();
    expect(options.level).toBe('info');
  });

  it("dev'da odam o'qiydigan chiqish (pino-pretty)", () => {
    const options = buildPinoHttpOptions({ env: { NODE_ENV: 'development' } }) as Record<string, any>;
    expect(options.transport?.target).toBe('pino-pretty');
    expect(options.level).toBe('debug');
  });

  it("test'da loglar jim (test chiqishini ifloslantirmaydi)", () => {
    const options = buildPinoHttpOptions({ env: { NODE_ENV: 'test' } }) as Record<string, unknown>;
    expect(options.level).toBe('silent');
    expect(options.transport).toBeUndefined();
  });

  it('LOG_LEVEL env ustun turadi', () => {
    const options = buildPinoHttpOptions({ env: { NODE_ENV: 'production', LOG_LEVEL: 'warn' } }) as any;
    expect(options.level).toBe('warn');
  });

  it("MAJBURIY bazaviy maydonlar bor (service, env) — ADR-014", () => {
    const options = buildPinoHttpOptions({
      env: { NODE_ENV: 'production', SENTRY_ENVIRONMENT: 'production' },
    }) as any;
    expect(options.base.service).toBe('agentnet-api');
    expect(options.base.env).toBe('production');
  });

  it('vaqt ISO-8601 formatida', () => {
    const options = buildPinoHttpOptions({ env: {} }) as any;
    const stamp = options.timestamp();
    expect(stamp).toMatch(/^,"time":"\d{4}-\d{2}-\d{2}T[\d:.]+Z"$/);
  });

  it('daraja NOM sifatida chiqadi (raqam emas)', () => {
    const options = buildPinoHttpOptions({ env: {} }) as any;
    expect(options.formatters.level('warn')).toEqual({ level: 'warn' });
  });

  it('genReqId — kanonik ID ni sarlavhaga va javobga yozadi', () => {
    const options = buildPinoHttpOptions({ env: {} }) as any;
    const req = { headers: { 'x-request-id': 'invalid value' } };
    const setHeader = jest.fn();
    const res = { headersSent: false, setHeader };
    const id = options.genReqId(req, res);
    expect(id).not.toContain(' ');
    expect(req.headers['x-request-id']).toBe(id);
    expect(setHeader).toHaveBeenCalledWith('X-Request-Id', id);
  });
});

describe('log darajasi va health shovqini', () => {
  it('health yo‘llari aniqlanadi', () => {
    expect(isHealthPath('/api/health')).toBe(true);
    expect(isHealthPath('/api/health/live')).toBe(true);
    expect(isHealthPath('/api/health/ready?x=1')).toBe(true);
    expect(isHealthPath('/api/agents')).toBe(false);
    expect(isHealthPath(undefined)).toBe(false);
  });

  it('status kodiga qarab daraja', () => {
    expect(resolveLogLevel({ url: '/api/x' }, { statusCode: 200 })).toBe('info');
    expect(resolveLogLevel({ url: '/api/x' }, { statusCode: 404 })).toBe('warn');
    expect(resolveLogLevel({ url: '/api/x' }, { statusCode: 500 })).toBe('error');
    expect(resolveLogLevel({ url: '/api/x' }, { statusCode: 200 }, new Error('x'))).toBe('error');
  });

  it('health ping loglanmaydi (uptime shovqini)', () => {
    expect(resolveLogLevel({ url: '/api/health/live' }, { statusCode: 200 })).toBe('silent');
  });

  it('autoLogging health so‘rovlarini o‘tkazib yuboradi', () => {
    const options = buildPinoHttpOptions({ env: {} }) as any;
    expect(options.autoLogging.ignore({ url: '/api/health/live' })).toBe(true);
    expect(options.autoLogging.ignore({ url: '/api/agents' })).toBe(false);
  });
});

describe('serializerlar — sir chiqmaydi', () => {
  beforeEach(() => resetSecretValueCache());

  it("so'rov serializatsiyasida SARLAVHA UMUMAN yo'q", () => {
    const out = serializeRequest({
      id: 'req-1234abcd',
      method: 'POST',
      url: '/api/auth/login',
      headers: { authorization: 'Bearer secret-value-here' },
    } as never);
    expect(JSON.stringify(out)).not.toContain('authorization');
    expect(JSON.stringify(out)).not.toContain('secret-value-here');
    expect(out).toEqual({ id: 'req-1234abcd', method: 'POST', url: '/api/auth/login' });
  });

  it('so‘rov serializatsiyasida IP MANZIL yo‘q (ADR-014: PII)', () => {
    const out = serializeRequest({
      id: 'r1',
      method: 'GET',
      url: '/api/x',
      socket: { remoteAddress: '203.0.113.9' },
    } as never);
    expect(JSON.stringify(out)).not.toContain('203.0.113.9');
  });

  it('URL ichidagi sir tozalanadi va uzunlik cheklanadi', () => {
    const out = serializeRequest({
      method: 'GET',
      url: `/api/x?t=Bearer abcdefghijklmnop&pad=${'a'.repeat(1000)}`,
    } as never);
    expect(out.url).not.toContain('abcdefghijklmnop');
    expect(out.url.length).toBeLessThanOrEqual(512);
  });

  it('javob serializatsiyasi faqat status kodini beradi', () => {
    expect(serializeResponse({ statusCode: 503, getHeaders: () => ({}) } as never)).toEqual({
      statusCode: 503,
    });
  });

  it('xato serializatsiyasi `type` va `code` beradi, stack tozalanadi', () => {
    const err = Object.assign(new TypeError('failed with Bearer abcdefghijklmn'), {
      code: 'ECONNREFUSED',
      status: 502,
    });
    const out = serializeError(err);
    expect(out.type).toBe('TypeError');
    expect(out.code).toBe('ECONNREFUSED');
    expect(out.statusCode).toBe(502);
    expect(out.message).not.toContain('abcdefghijklmn');
  });

  it('Error bo‘lmagan qiymat ham xavfsiz serializatsiya qilinadi', () => {
    const out = serializeError('sk-ant-api03-SECRETKEYVALUE');
    expect(out.message).not.toContain('SECRETKEYVALUE');
  });
});

describe('log argumentlarini chuqur tozalash (hooks.logMethod)', () => {
  beforeEach(() => resetSecretValueCache());

  it('satr argumentidagi sir olib tashlanadi', () => {
    const [msg] = scrubLogArguments(['token: Bearer abcdefghijklmnop']) as string[];
    expect(msg).not.toContain('abcdefghijklmnop');
    expect(msg).toContain(REDACTED);
  });

  it("obyekt argumentida `redact` ro'yxatiga KIRMAGAN chuqur sir ham olinadi", () => {
    const [obj] = scrubLogArguments([
      { level1: { level2: { connectorPassword: 'p@ss', keep: 'ok' } } },
    ]) as any[];
    expect(obj.level1.level2.connectorPassword).toBe(REDACTED);
    expect(obj.level1.level2.keep).toBe('ok');
  });

  it('Error instansi O‘ZGARMAYDI (serializer uni tozalaydi)', () => {
    const err = new Error('x');
    const [out] = scrubLogArguments([err]);
    expect(out).toBe(err);
  });

  it('son/boolean argumentlar tegilmaydi', () => {
    expect(scrubLogArguments([42, true, null])).toEqual([42, true, null]);
  });
});

/**
 * ENG MUHIM TEST: yuqoridagilar konfiguratsiyani tekshiradi, bu esa
 * HAQIQIY pino instansini quradi va CHIQQAN SATRNI o'qiydi. Ya'ni
 * "redaksiya ulangan" emas, "redaksiya ISHLAYDI" isbotlanadi.
 */
describe('pino — haqiqiy chiqish (uchdan-uchgacha redaksiya)', () => {
  const OLD_ENV = { ...process.env };

  function captureLogs(fn: (logger: any) => void): string {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pino = require('pino');
    const lines: string[] = [];
    const stream = { write: (chunk: string) => lines.push(chunk) };
    const options = buildPinoHttpOptions({ env: { NODE_ENV: 'production' } });
    const logger = pino(options as never, stream as never);
    fn(logger);
    return lines.join('\n');
  }

  beforeEach(() => {
    process.env.INTERNAL_API_TOKEN = 'runtime-internal-token-secret';
    // Past-entropiyali — sabab `redaction.spec.ts` dagi bilan bir xil.
    process.env.ENCRYPTION_KEY = 'aaaaaaaabbbbbbbbaaaaaaaabbbbbbbb';
    resetSecretValueCache();
  });

  afterEach(() => {
    process.env = { ...OLD_ENV };
    resetSecretValueCache();
  });

  it('xabar satridagi env sirlari CHIQISHDA yo‘q', () => {
    const output = captureLogs((logger) =>
      logger.error(`engine 500: token=${process.env.INTERNAL_API_TOKEN}`),
    );
    expect(output).not.toContain('runtime-internal-token-secret');
    expect(output).toContain(REDACTED);
  });

  it('JWT va Bearer chiqishda yo‘q', () => {
    const output = captureLogs((logger) =>
      logger.warn('auth: Bearer eyJhbGciOiJIUzI1NiJ9.abcdefghij.klmnopqrst rad etildi'),
    );
    expect(output).not.toContain('eyJhbGciOiJIUzI1NiJ9');
  });

  it('obyekt maydonidagi sir chiqishda yo‘q (redact + chuqur skan)', () => {
    const output = captureLogs((logger) =>
      logger.info({ connector: { apiKey: 'k-secret-123', name: 'telegram' } }, 'konnektor'),
    );
    expect(output).not.toContain('k-secret-123');
    expect(output).toContain('telegram');
  });

  it('ENCRYPTION_KEY qiymati chiqishda yo‘q', () => {
    const output = captureLogs((logger) =>
      logger.error(`decrypt xatosi, kalit: ${process.env.ENCRYPTION_KEY}`),
    );
    expect(output).not.toContain('aabbccddeeff00112233445566778899');
  });

  it('majburiy maydonlar chiqishda bor (service, env, level, time)', () => {
    const output = captureLogs((logger) => logger.info('salom'));
    const parsed = JSON.parse(output.trim().split('\n')[0]);
    expect(parsed.service).toBe('agentnet-api');
    expect(parsed.env).toBe('production');
    expect(parsed.level).toBe('info');
    expect(parsed.time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('redact yo‘llari', () => {
  it('kritik sarlavha va maydonlar ro‘yxatda', () => {
    for (const path of [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-internal-token"]',
      'res.headers["set-cookie"]',
      '*.refreshToken',
      '*.apiKey',
    ]) {
      expect(REDACT_PATHS).toContain(path);
    }
  });

  it('censor qiymati [REDACTED]', () => {
    const options = buildPinoHttpOptions({ env: {} }) as any;
    expect(options.redact.censor).toBe(REDACTED);
  });
});
