import axios, { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { installEngineAuthInterceptor } from './engine-auth';

/**
 * Interceptor engine chaqiruvlariga `x-internal-token` qo'shishini VA tashqi
 * servislarga qo'shMASligini tekshiradi (ichki sir sizib chiqmasligi shart).
 */
describe('installEngineAuthInterceptor', () => {
  const ENGINE = 'https://engine.example.com';
  const TOKEN = 'super-strong-internal-token';

  // Eng oxirgi ro'yxatdan o'tgan request-interceptor handlerini fake config'da ishga tushiradi.
  function runLatest(config: Partial<InternalAxiosRequestConfig>): InternalAxiosRequestConfig {
    const handlers = (axios.interceptors.request as unknown as {
      handlers: Array<{ fulfilled: (c: InternalAxiosRequestConfig) => InternalAxiosRequestConfig }>;
    }).handlers;
    const latest = handlers[handlers.length - 1];
    return latest.fulfilled(config as InternalAxiosRequestConfig);
  }

  beforeAll(() => {
    process.env.AGENT_ENGINE_URL = ENGINE;
    process.env.INTERNAL_API_TOKEN = TOKEN;
    installEngineAuthInterceptor();
  });

  it('engine URL so\'roviga tokenni qo\'shadi', () => {
    const out = runLatest({ url: `${ENGINE}/agents/run`, headers: new AxiosHeaders() });
    expect((out.headers as AxiosHeaders).get('x-internal-token')).toBe(TOKEN);
  });

  it('tashqi (Telegram/Payme) URL so\'roviga token QO\'SHMAYDI', () => {
    const out = runLatest({ url: 'https://api.telegram.org/botX/sendMessage', headers: new AxiosHeaders() });
    expect((out.headers as AxiosHeaders).get('x-internal-token')).toBeUndefined();
  });
});
