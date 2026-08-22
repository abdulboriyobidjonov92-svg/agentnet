/**
 * SEC-07 domain allowlist testlari (P0-3 §14).
 *
 * Har bir `describe` blueprint'dagi aniq bandga bog'langan — test nomini
 * o'zgartirganda blueprint bandi ham tekshirilishi kerak.
 */

import {
  MAX_ALLOWED_DOMAINS,
  domainBlockedReason,
  filterStorageState,
  isAllowedHost,
  isAllowedUrl,
  isEnforcementEnabled,
  isNonNavigationalUrl,
  normalizeDomain,
  parseDomainList,
  resolveAllowlist,
} from './domain-allowlist';

describe('normalizeDomain', () => {
  it.each([
    ['example.com', 'example.com'],
    ['EXAMPLE.COM', 'example.com'],
    ['  example.com  ', 'example.com'],
    ['https://example.com', 'example.com'],
    ['http://example.com/path?q=1#frag', 'example.com'],
    ['example.com:8443', 'example.com'],
    ['https://example.com:8443/x', 'example.com'],
    ['*.example.com', 'example.com'],
    ['example.com.', 'example.com'],
    ['a.b.example.com', 'a.b.example.com'],
  ])('kanonik shaklga keltiradi: %s → %s', (input, expected) => {
    expect(normalizeDomain(input)).toBe(expected);
  });

  it('IDN domenni punycode ga o‘giradi (homograf/moslik bo‘shlig‘ining oldini oladi)', () => {
    // Brauzer bizga punycode bilan keladi; allowlist IDN bilan yozilishi mumkin.
    // Ikkalasi BIR XIL kanonik qiymatga tushishi shart.
    const fromIdn = normalizeDomain('сайт.рф');
    const fromPunycode = normalizeDomain('xn--80aswg.xn--p1ai');
    expect(fromIdn).toBe('xn--80aswg.xn--p1ai');
    expect(fromIdn).toBe(fromPunycode);
  });

  it.each([
    ['', 'bo‘sh satr'],
    ['   ', 'faqat bo‘shliq'],
    ['a..b.com', 'bo‘sh label'],
    ['.example.com', 'nuqta bilan boshlanadi'],
    ['-example.com', 'defis bilan boshlanadi'],
    ['not a domain', 'bo‘shliqli matn'],
  ])('yaroqsizni rad etadi: %s (%s)', (input) => {
    expect(normalizeDomain(input)).toBeNull();
  });

  it('satr bo‘lmagan kirishni rad etadi', () => {
    expect(normalizeDomain(undefined)).toBeNull();
    expect(normalizeDomain(null)).toBeNull();
    expect(normalizeDomain(42)).toBeNull();
    expect(normalizeDomain({ host: 'example.com' })).toBeNull();
  });
});

describe('isAllowedHost — subdomain semantikasi', () => {
  const allowlist = ['example.com'];

  it('aniq moslikni o‘tkazadi', () => {
    expect(isAllowedHost('example.com', allowlist)).toBe(true);
  });

  it('subdomainni o‘tkazadi', () => {
    expect(isAllowedHost('a.example.com', allowlist)).toBe(true);
    expect(isAllowedHost('deep.a.example.com', allowlist)).toBe(true);
  });

  it('⚠️ SUFFIKS hujumini bloklaydi (notexample.com)', () => {
    // Oddiy `endsWith('example.com')` bu yerda YIQILARDI.
    expect(isAllowedHost('notexample.com', allowlist)).toBe(false);
    expect(isAllowedHost('evil-example.com', allowlist)).toBe(false);
  });

  it('registrga bog‘liq emas', () => {
    expect(isAllowedHost('A.Example.COM', allowlist)).toBe(true);
  });

  it('port allowlist qaroriga ta’sir qilmaydi', () => {
    expect(isAllowedHost('example.com:8443', allowlist)).toBe(true);
  });
});

describe('isAllowedUrl / domainBlockedReason — FAIL-CLOSED', () => {
  it('allowlist BO‘SH bo‘lsa har qanday URL bloklanadi', () => {
    expect(isAllowedUrl('https://example.com', [])).toBe(false);
    expect(isAllowedUrl('https://anything.dev', [])).toBe(false);
    expect(domainBlockedReason('https://example.com', [])).toMatch(/fail-closed/);
  });

  it('ruxsat etilgan URL uchun sabab null', () => {
    expect(domainBlockedReason('https://example.com/x', ['example.com'])).toBeNull();
  });

  it('ruxsat etilmagan URL uchun sabab ruxsat etilganlar ro‘yxatini beradi', () => {
    const reason = domainBlockedReason('https://evil.com', ['example.com']);
    expect(reason).toContain('not in allowlist');
    expect(reason).toContain('example.com');
  });

  it('yaroqsiz URL bloklanadi (throw qilmaydi)', () => {
    expect(isAllowedUrl('http://[', ['example.com'])).toBe(false);
    expect(isAllowedUrl('', ['example.com'])).toBe(false);
    expect(isAllowedUrl(undefined, ['example.com'])).toBe(false);
  });
});

describe('isNonNavigationalUrl', () => {
  it.each(['about:blank', 'ABOUT:BLANK', 'data:text/html,x', 'blob:https://a/b'])(
    'navigatsiya emas: %s',
    (url) => expect(isNonNavigationalUrl(url)).toBe(true),
  );

  it.each(['https://example.com', 'http://example.com'])('navigatsiya: %s', (url) =>
    expect(isNonNavigationalUrl(url)).toBe(false),
  );
});

describe('parseDomainList', () => {
  it('vergulli satrni ajratadi va dedupe qiladi', () => {
    const { domains } = parseDomainList('example.com, EXAMPLE.com , https://b.dev/');
    expect(domains).toEqual(['example.com', 'b.dev']);
  });

  it('massivni qabul qiladi', () => {
    expect(parseDomainList(['a.com', 'b.com']).domains).toEqual(['a.com', 'b.com']);
  });

  it('yaroqsizlarni JIMGINA tashlamaydi — invalid ro‘yxatida qaytaradi', () => {
    const { domains, invalid } = parseDomainList('example.com, not a domain, a..b');
    expect(domains).toEqual(['example.com']);
    expect(invalid).toEqual(['not a domain', 'a..b']);
  });

  it('bo‘sh/undefined kirish bo‘sh natija beradi', () => {
    expect(parseDomainList(undefined).domains).toEqual([]);
    expect(parseDomainList('').domains).toEqual([]);
    expect(parseDomainList('  ,  ').domains).toEqual([]);
  });
});

describe('resolveAllowlist — env ∪ agent, maks 5', () => {
  it('env va agent ro‘yxatlarini birlashtiradi', () => {
    const { domains } = resolveAllowlist({ env: 'a.com', agent: ['b.com'] });
    expect(domains).toEqual(['a.com', 'b.com']);
  });

  it('takrorlanuvchi domenni bir marta qoldiradi', () => {
    const { domains } = resolveAllowlist({ env: 'a.com', agent: ['A.COM', 'b.com'] });
    expect(domains).toEqual(['a.com', 'b.com']);
  });

  it(`${MAX_ALLOWED_DOMAINS} tadan oshganda KESADI va truncated bayrog‘ini beradi`, () => {
    const many = ['a.com', 'b.com', 'c.com', 'd.com', 'e.com', 'f.com'];
    const { domains, truncated } = resolveAllowlist({ agent: many });
    expect(domains).toHaveLength(MAX_ALLOWED_DOMAINS);
    expect(domains).not.toContain('f.com');
    expect(truncated).toBe(true);
  });

  it('chegara ichida truncated=false', () => {
    const { truncated } = resolveAllowlist({ agent: ['a.com'] });
    expect(truncated).toBe(false);
  });

  it('manba yo‘q bo‘lsa bo‘sh (fail-closed kirish nuqtasi)', () => {
    expect(resolveAllowlist({}).domains).toEqual([]);
  });
});

describe('filterStorageState — SEC-07 AC: faqat allowlist cookie‘lari', () => {
  const state = {
    cookies: [
      { name: 'a', domain: 'example.com', path: '/' },
      { name: 'b', domain: '.example.com', path: '/' }, // RFC 6265 subdomain shakli
      { name: 'c', domain: 'sub.example.com', path: '/' },
      { name: 'gmail', domain: 'mail.google.com', path: '/' },
      { name: 'suffix-attack', domain: 'notexample.com', path: '/' },
    ],
    origins: [
      { origin: 'https://example.com', localStorage: [{ name: 'k', value: 'v' }] },
      { origin: 'https://mail.google.com', localStorage: [{ name: 'k', value: 'v' }] },
    ],
  };

  it('faqat allowlist domenlarining cookie‘larini qoldiradi', () => {
    const filtered = filterStorageState(state, ['example.com']);
    expect(filtered?.cookies?.map((c) => (c as { name: string }).name)).toEqual(['a', 'b', 'c']);
  });

  it('⚠️ boshqa saytning sessiyasini (Gmail) OLIB TASHLAYDI', () => {
    const filtered = filterStorageState(state, ['example.com']);
    const names = filtered?.cookies?.map((c) => (c as { name: string }).name) ?? [];
    expect(names).not.toContain('gmail');
  });

  it('suffiks hujumini (notexample.com) olib tashlaydi', () => {
    const filtered = filterStorageState(state, ['example.com']);
    const names = filtered?.cookies?.map((c) => (c as { name: string }).name) ?? [];
    expect(names).not.toContain('suffix-attack');
  });

  it('origins ni ham filtrlaydi', () => {
    const filtered = filterStorageState(state, ['example.com']);
    expect(filtered?.origins).toEqual([
      { origin: 'https://example.com', localStorage: [{ name: 'k', value: 'v' }] },
    ]);
  });

  it('hech narsa qolmasa undefined qaytaradi (run to‘xtamaydi, login‘siz davom etadi)', () => {
    expect(filterStorageState(state, ['nothing-matches.dev'])).toBeUndefined();
  });

  it('allowlist bo‘sh bo‘lsa hech qanday cookie in’ektsiya qilinmaydi', () => {
    expect(filterStorageState(state, [])).toBeUndefined();
  });

  it('state undefined bo‘lsa undefined', () => {
    expect(filterStorageState(undefined, ['example.com'])).toBeUndefined();
  });

  it('buzuq yozuvlarda yiqilmaydi', () => {
    const broken = {
      cookies: [{ name: 'x' }, { name: 'y', domain: 42 }, null],
      origins: [{ origin: 'not-a-url' }, { origin: 123 }, null],
    } as unknown as typeof state;
    expect(() => filterStorageState(broken, ['example.com'])).not.toThrow();
    expect(filterStorageState(broken, ['example.com'])).toBeUndefined();
  });
});

describe('isEnforcementEnabled', () => {
  it('default — YOQILGAN', () => {
    expect(isEnforcementEnabled({} as NodeJS.ProcessEnv)).toBe(true);
  });

  it('faqat aniq "false" o‘chiradi', () => {
    expect(isEnforcementEnabled({ AGENT_DOMAIN_ALLOWLIST_ENFORCE: 'false' } as NodeJS.ProcessEnv)).toBe(false);
    expect(isEnforcementEnabled({ AGENT_DOMAIN_ALLOWLIST_ENFORCE: 'true' } as NodeJS.ProcessEnv)).toBe(true);
    expect(isEnforcementEnabled({ AGENT_DOMAIN_ALLOWLIST_ENFORCE: '0' } as NodeJS.ProcessEnv)).toBe(true);
  });
});
