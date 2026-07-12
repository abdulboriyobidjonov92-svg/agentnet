import axios from 'axios';

/**
 * agent-engine endi ichki `x-internal-token` talab qiladi (main.py'dagi
 * internal_token_guard). Bu interceptor har bir engine chaqiruviga o'sha
 * tokenni qo'shadi.
 *
 * Nega yagona interceptor yetarli: barcha feature-modullar oddiy `HttpModule`
 * (register'siz) import qiladi — @nestjs/axios bunda BITTA umumiy axios default
 * instansini beradi. Shu sabab bu yerda ro'yxatdan o'tgan interceptor barcha
 * engine chaqiruvlarini (hozirgi 13+ call-site va kelajakdagilar) avtomatik
 * qamrab oladi; hech bir joyni qo'lda o'zgartirish shart emas va yangi call-site
 * ham himoyasiz qolib ketmaydi.
 *
 * Token FAQAT engine URL'iga ketayotgan so'rovga qo'shiladi — tashqi servislarga
 * (Telegram, Payme, Eskiz, 15+ konnektor) ichki sir sizib chiqmaydi.
 */
export function installEngineAuthInterceptor(): void {
  const engineUrl = process.env.AGENT_ENGINE_URL ?? 'http://localhost:8000';
  const token = process.env.INTERNAL_API_TOKEN ?? 'agentnet-internal-dev';

  axios.interceptors.request.use((config) => {
    const url = config.url ?? '';
    // Engine chaqiruvlari to'liq URL bilan yuboriladi (`${engineUrl}/...`),
    // shuning uchun prefiks bo'yicha ishonchli ajratamiz.
    if (url.startsWith(engineUrl)) {
      if (config.headers && typeof (config.headers as { set?: unknown }).set === 'function') {
        (config.headers as unknown as { set: (k: string, v: string) => void }).set(
          'x-internal-token',
          token,
        );
      } else {
        config.headers = {
          ...(config.headers as Record<string, string>),
          'x-internal-token': token,
        } as never;
      }
    }
    return config;
  });
}
