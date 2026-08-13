import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Login insidenti (2026-08-12) uchun REGRESSIYA QULFI.
 *
 * `apps/web` da jest YO'Q (Phase 1 qarori), shuning uchun web
 * invariantlari SHU YERDAN matn ustidan qulflanadi — Phase 5 dagi
 * `observability-config.spec.ts` bilan AYNAN bir xil naqsh.
 *
 * NIMA SODIR BO'LDI: `NEXT_PUBLIC_API_URL` Vercel'da qo'yilmagan edi va
 * middleware `?? "http://localhost:3001"` bilan JIMGINA localhost'ga
 * rewrite qilardi -> 500 -> brauzerda "Application Error". Butun login
 * (email OTP, telefon OTP) shundan sinardi, sabab esa hech qayerda
 * ko'rinmasdi.
 */
const webRoot = join(__dirname, '..', '..', '..', 'web');
const read = (p: string) => readFileSync(join(webRoot, p), 'utf8');

describe('web: NEXT_PUBLIC_API_URL noto`g`ri sozlansa JIMGINA sinmaydi', () => {
  it('middleware `resolveApiUrl()` ni ishlatadi (xom `?? localhost` EMAS)', () => {
    const mw = read('src/middleware.ts');
    expect(mw).toContain('resolveApiUrl');
    // Xom fallback middleware'da QAYTA paydo bo'lmasin.
    expect(mw).not.toMatch(/NEXT_PUBLIC_API_URL\s*\?\?/);
  });

  it('proxy yo`li noto`g`ri konfiguratsiyada ANIQ 503 qaytaradi', () => {
    const mw = read('src/middleware.ts');
    expect(mw).toContain('api_url_misconfigured');
    expect(mw).toContain('503');
  });

  it('`resolveApiUrl` prod`da unset va localhost holatlarini xato deb belgilaydi', () => {
    const src = read('src/lib/api-url.ts');
    expect(src).toContain('NEXT_PUBLIC_API_URL_unset');
    expect(src).toContain('NEXT_PUBLIC_API_URL_points_to_localhost');
  });

  it('`resolveApiUrl` protokolsiz/buzuq URL ni ham xato deb belgilaydi', () => {
    // 2026-08-13: operator `https://` siz kiritdi -> `new URL()` throw ->
    // middleware 500 -> yana 'Application Error'. Endi aniq sabab qaytadi.
    const src = read('src/lib/api-url.ts');
    expect(src).toContain('NEXT_PUBLIC_API_URL_invalid_url_missing_protocol');
    expect(src).toContain('NEXT_PUBLIC_API_URL_bad_protocol');
    expect(src).toContain('new URL(raw)');
  });

  it('`.env.example` prod uchun ogohlantirish beradi (build-time inline)', () => {
    const env = readFileSync(join(webRoot, '..', '..', '.env.example'), 'utf8');
    expect(env).toContain('NEXT_PUBLIC_API_URL');
    expect(env).toMatch(/QAYTA DEPLOY|rebuild/i);
  });
});
