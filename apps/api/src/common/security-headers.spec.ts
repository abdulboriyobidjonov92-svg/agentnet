import {
  API_CSP,
  API_HSTS,
  apiSecurityHeaders,
  isSwaggerPath,
} from './security-headers';

/**
 * SEC-13 — API javoblarining xavfsizlik sarlavhalari.
 *
 * Bu testlar siyosatning JIM BUZILADIGAN tomonlarini qulflaydi: wildcard
 * kirib qolishi, prod'da HSTS yo'qolishi, dev istisnosining prod'ga
 * sizib o'tishi.
 *
 * Direktivalar SATR sifatida emas, NOM bo'yicha tekshiriladi — tartib
 * o'zgarsa test yiqilmasligi kerak.
 */

/** `"a 'self'; b 'none'"` -> `{ a: ["'self'"], b: ["'none'"] }`. */
function parseCsp(csp: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const part of csp.split(';')) {
    const [name, ...values] = part.trim().split(/\s+/).filter(Boolean);
    if (name) out[name] = values;
  }
  return out;
}

describe('SEC-13 — API CSP', () => {
  const directives = parseCsp(API_CSP);

  it('eng qattiq zaxira: `default-src none`', () => {
    expect(directives['default-src']).toEqual(["'none'"]);
  });

  it('clickjacking to\'silgan', () => {
    expect(directives['frame-ancestors']).toEqual(["'none'"]);
  });

  it('`base-uri` va `form-action` yopiq', () => {
    expect(directives['base-uri']).toEqual(["'none'"]);
    expect(directives['form-action']).toEqual(["'none'"]);
  });

  it('WILDCARD YO\'Q — hech bir direktivada `*` yoki ochiq sxema', () => {
    for (const [name, values] of Object.entries(directives)) {
      for (const value of values) {
        expect(`${name}: ${value}`).not.toMatch(/^\S+: \*$/);
        expect(value).not.toBe('https:');
        expect(value).not.toBe('http:');
        expect(value).not.toBe('data:');
      }
    }
  });

  it('`unsafe-inline`/`unsafe-eval` YO\'Q', () => {
    expect(API_CSP).not.toContain('unsafe-inline');
    expect(API_CSP).not.toContain('unsafe-eval');
  });
});

describe('SEC-13 — API sarlavhalar to\'plami', () => {
  const prod = apiSecurityHeaders({ isProd: true, path: '/api/users/me' });
  const dev = apiSecurityHeaders({ isProd: false, path: '/api/users/me' });

  it('MIME-sniffing to\'silgan (dev va prod)', () => {
    expect(prod['X-Content-Type-Options']).toBe('nosniff');
    expect(dev['X-Content-Type-Options']).toBe('nosniff');
  });

  it('clickjacking: `X-Frame-Options: DENY` CSP bilan ZIDDIYATSIZ', () => {
    expect(prod['X-Frame-Options']).toBe('DENY');
    // Ikkalasi bir xil ma'noni beradi — biri ikkinchisini bo'shashtirmaydi.
    expect(parseCsp(prod['Content-Security-Policy'])['frame-ancestors']).toEqual(["'none'"]);
  });

  it('referrer API uchun umuman yuborilmaydi', () => {
    expect(prod['Referrer-Policy']).toBe('no-referrer');
  });

  it('HSTS FAQAT prod\'da (dev HTTP ishlashda qolsin)', () => {
    expect(prod['Strict-Transport-Security']).toBe(API_HSTS);
    expect(dev['Strict-Transport-Security']).toBeUndefined();
  });

  it('HSTS `preload` SIZ — bu tashkilot qarori, kod qarori emas', () => {
    expect(prod['Strict-Transport-Security']).not.toContain('preload');
  });

  it('CSP oddiy API yo\'lida qo\'yiladi', () => {
    expect(prod['Content-Security-Policy']).toBe(API_CSP);
  });
});

describe('SEC-13 — Swagger istisnosi', () => {
  it('`/api/docs` va uning ost-yo\'llari aniqlanadi', () => {
    expect(isSwaggerPath('/api/docs')).toBe(true);
    expect(isSwaggerPath('/api/docs/')).toBe(true);
    expect(isSwaggerPath('/api/docs/swagger-ui.css')).toBe(true);
    expect(isSwaggerPath('/api/docs?foo=1')).toBe(true);
  });

  it('boshqa yo\'llar Swagger deb hisoblanmaydi', () => {
    expect(isSwaggerPath('/api/users/me')).toBe(false);
    expect(isSwaggerPath('/api/docsomething')).toBe(false);
  });

  it('Swagger yo\'lida CSP QO\'YILMAYDI (aks holda UI bo\'sh sahifa bo\'lardi)', () => {
    const headers = apiSecurityHeaders({ isProd: false, path: '/api/docs' });
    expect(headers['Content-Security-Policy']).toBeUndefined();
    // Qolgan himoya o'z joyida qoladi.
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('DENY');
  });

  it('istisno prod\'ga SIZIB O\'TMAYDI — Swagger prod\'da umuman yoqilmaydi', () => {
    // `main.ts`: `if (!isProd) SwaggerModule.setup(...)`. Ya'ni prod'da bu
    // yo'l 404 bo'ladi; shunday bo'lsa ham qolgan sarlavhalar qo'yiladi.
    const headers = apiSecurityHeaders({ isProd: true, path: '/api/docs' });
    expect(headers['Strict-Transport-Security']).toBe(API_HSTS);
    expect(headers['X-Frame-Options']).toBe('DENY');
  });
});
