import {
  REQUEST_ID_HEADER,
  REQUEST_ID_MAX_LENGTH,
  currentRequestId,
  generateRequestId,
  isValidRequestId,
  resolveRequestId,
  runWithRequestContext,
} from './request-id';
import { requestIdMiddleware } from './request-id.middleware';

/** Phase 5 (P5.3) — request-id shartnomasi testlari. */
describe('request-id — format tekshiruvi', () => {
  it('yaratilgan ID formatga mos (UUIDv4)', () => {
    for (let i = 0; i < 20; i += 1) {
      expect(isValidRequestId(generateRequestId())).toBe(true);
    }
  });

  it('yaroqli qiymatlar qabul qilinadi', () => {
    expect(isValidRequestId('abc12345')).toBe(true);
    expect(isValidRequestId('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(true);
    expect(isValidRequestId('req_ID-with_underscores123')).toBe(true);
  });

  it('yaroqsiz qiymatlar rad etiladi', () => {
    expect(isValidRequestId('')).toBe(false);
    expect(isValidRequestId('short')).toBe(false); // < 8
    expect(isValidRequestId('a'.repeat(REQUEST_ID_MAX_LENGTH + 1))).toBe(false);
    expect(isValidRequestId('has space here')).toBe(false);
    expect(isValidRequestId('inject\nlog line')).toBe(false); // LOG INJECTION
    expect(isValidRequestId('<script>alert(1)</script>')).toBe(false);
    expect(isValidRequestId('semi;colon;value')).toBe(false);
    expect(isValidRequestId(undefined)).toBe(false);
    expect(isValidRequestId(12345678)).toBe(false);
  });
});

describe('request-id — hal qilish siyosati', () => {
  it("sarlavha yo'q — yangi ID yaratiladi", () => {
    const id = resolveRequestId(undefined, {});
    expect(isValidRequestId(id)).toBe(true);
  });

  it('yaroqli sarlavha — AYNAN o‘zi qaytadi (propagatsiya)', () => {
    const supplied = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    expect(resolveRequestId(supplied, {})).toBe(supplied);
  });

  it('yaroqsiz sarlavha — jimgina yangi ID (yaroqsiz qiymat TARQALMAYDI)', () => {
    const id = resolveRequestId('bad value with spaces', {});
    expect(id).not.toContain(' ');
    expect(isValidRequestId(id)).toBe(true);
  });

  it("haddan tashqari uzun sarlavha rad etiladi (log hajmi himoyasi)", () => {
    const huge = 'x'.repeat(100_000);
    const id = resolveRequestId(huge, {});
    expect(id.length).toBeLessThanOrEqual(REQUEST_ID_MAX_LENGTH);
    expect(id).not.toBe(huge);
  });

  it('massiv sarlavha (takrorlangan header) rad etiladi', () => {
    const id = resolveRequestId(['abc12345', 'def67890'], {});
    expect(id).not.toBe('abc12345');
    expect(isValidRequestId(id)).toBe(true);
  });

  it("TRUST_INCOMING_REQUEST_ID=0 — yaroqli ID ham qabul qilinmaydi", () => {
    const supplied = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const id = resolveRequestId(supplied, { TRUST_INCOMING_REQUEST_ID: '0' });
    expect(id).not.toBe(supplied);
    expect(isValidRequestId(id)).toBe(true);
  });
});

describe('request-id — middleware va kontekst', () => {
  function run(headers: Record<string, string | string[] | undefined>, env: NodeJS.ProcessEnv = {}) {
    const req = { headers };
    const setHeader = jest.fn();
    const res = { setHeader };
    let insideContext: string | undefined;
    requestIdMiddleware(env)(req, res, () => {
      insideContext = currentRequestId();
    });
    return { req, setHeader, insideContext };
  }

  it('kanonik ID so‘rov sarlavhasiga QAYTA YOZILADI', () => {
    const { req } = run({ [REQUEST_ID_HEADER]: 'bad\nvalue' });
    expect(isValidRequestId(req.headers[REQUEST_ID_HEADER])).toBe(true);
    expect(String(req.headers[REQUEST_ID_HEADER])).not.toContain('\n');
  });

  it('javob sarlavhasi X-Request-Id qo‘yiladi', () => {
    const { setHeader, req } = run({});
    expect(setHeader).toHaveBeenCalledWith('X-Request-Id', req.headers[REQUEST_ID_HEADER]);
  });

  it('keyingi qatlamlar ALS kontekstida ishlaydi (engine propagatsiyasi uchun)', () => {
    const { insideContext, req } = run({ [REQUEST_ID_HEADER]: 'abcdefgh12345678' });
    expect(insideContext).toBe('abcdefgh12345678');
    expect(req.headers[REQUEST_ID_HEADER]).toBe('abcdefgh12345678');
  });

  it("kontekstdan tashqarida currentRequestId() undefined (soxta ID to'qilmaydi)", () => {
    expect(currentRequestId()).toBeUndefined();
  });

  it('parallel so‘rovlar kontekstlari ARALASHMAYDI', async () => {
    const seen: string[] = [];
    await Promise.all(
      ['id-aaaa1111', 'id-bbbb2222', 'id-cccc3333'].map(
        (id) =>
          new Promise<void>((resolve) => {
            runWithRequestContext({ requestId: id }, async () => {
              // Boshqa so'rovlar orasiga "tushib qolish" uchun kutamiz.
              await new Promise((r) => setTimeout(r, Math.random() * 20));
              seen.push(`${id}=${currentRequestId()}`);
              resolve();
            });
          }),
      ),
    );
    expect(seen.sort()).toEqual(
      ['id-aaaa1111=id-aaaa1111', 'id-bbbb2222=id-bbbb2222', 'id-cccc3333=id-cccc3333'].sort(),
    );
  });
});

describe('request-id — API → engine propagatsiyasi (axios interceptor)', () => {
  it('kontekst ichida engine so‘roviga x-request-id qo‘shiladi', async () => {
    jest.resetModules();
    process.env.AGENT_ENGINE_URL = 'http://engine.internal:8000';
    process.env.INTERNAL_API_TOKEN = 'test-internal-token-value';

    const axios = (await import('axios')).default;
    const { installEngineAuthInterceptor } = await import('../common/engine-auth');
    const { runWithRequestContext: runCtx } = await import('./request-id');

    installEngineAuthInterceptor();

    const applied = await runCtx({ requestId: 'engine-prop-1234' }, async () => {
      // Interceptor zanjirini to'g'ridan-to'g'ri chaqiramiz (tarmoqsiz).
      const handlers = (axios.interceptors.request as unknown as {
        handlers: Array<{ fulfilled: (c: unknown) => unknown }>;
      }).handlers;
      let config: any = { url: 'http://engine.internal:8000/agents/run', headers: {} };
      for (const handler of handlers) {
        if (handler?.fulfilled) config = await handler.fulfilled(config);
      }
      return config;
    });

    expect(applied.headers[REQUEST_ID_HEADER]).toBe('engine-prop-1234');
    expect(applied.headers['x-internal-token']).toBe('test-internal-token-value');
  });

  it("kontekstsiz (cron) chaqiruvda x-request-id QO'YILMAYDI (soxta ID yo'q)", async () => {
    jest.resetModules();
    process.env.AGENT_ENGINE_URL = 'http://engine.internal:8000';

    const axios = (await import('axios')).default;
    const { installEngineAuthInterceptor } = await import('../common/engine-auth');
    installEngineAuthInterceptor();

    const handlers = (axios.interceptors.request as unknown as {
      handlers: Array<{ fulfilled: (c: unknown) => unknown }>;
    }).handlers;
    let config: any = { url: 'http://engine.internal:8000/ops/schedule', headers: {} };
    for (const handler of handlers) {
      if (handler?.fulfilled) config = await handler.fulfilled(config);
    }

    expect(config.headers[REQUEST_ID_HEADER]).toBeUndefined();
  });

  it('engine BO‘LMAGAN manzilga request-id ham, ichki token ham ketmaydi', async () => {
    jest.resetModules();
    process.env.AGENT_ENGINE_URL = 'http://engine.internal:8000';

    const axios = (await import('axios')).default;
    const { installEngineAuthInterceptor } = await import('../common/engine-auth');
    const { runWithRequestContext: runCtx } = await import('./request-id');
    installEngineAuthInterceptor();

    const config = await runCtx({ requestId: 'must-not-leak-1234' }, async () => {
      const handlers = (axios.interceptors.request as unknown as {
        handlers: Array<{ fulfilled: (c: unknown) => unknown }>;
      }).handlers;
      let c: any = { url: 'https://api.telegram.org/botX/sendMessage', headers: {} };
      for (const handler of handlers) {
        if (handler?.fulfilled) c = await handler.fulfilled(c);
      }
      return c;
    });

    expect(config.headers[REQUEST_ID_HEADER]).toBeUndefined();
    expect(config.headers['x-internal-token']).toBeUndefined();
  });
});
