import { BadRequestException } from '@nestjs/common';
import { CapabilityRouterService } from './capability-router.service';

describe('CapabilityRouterService', () => {
  const router = new CapabilityRouterService();

  it('resolve — bo\'sh target rad etiladi', () => {
    expect(() => router.resolve('')).toThrow(BadRequestException);
    expect(() => router.resolve('   ')).toThrow(BadRequestException);
  });

  it('resolve — mavjud connectorga mos kelsa "connector" tier (eng tez)', () => {
    const res = router.resolve('telegram');
    expect(res.tier).toBe('connector');
    expect(res.executor).toBe('telegram-bot');
  });

  it('resolve — connector id\'sining o\'zi ham ishlaydi', () => {
    const res = router.resolve('telegram-bot');
    expect(res.tier).toBe('connector');
  });

  it('resolve — veb-manzilga o\'xshasa "browser" tier (connector topilmasa)', () => {
    const res = router.resolve('https://example.com/some-page');
    expect(res.tier).toBe('browser');
    expect(res.executor).toBe('browser-agent');
  });

  it('resolve — domen ko\'rinishidagi matn ham "browser" deb tanilishi', () => {
    const res = router.resolve('news.ycombinator.com');
    expect(res.tier).toBe('browser');
  });

  it('resolve — hech narsaga mos kelmasa oxirgi chora "screen" tier', () => {
    const res = router.resolve('mutlaqo nomalum tushuncha');
    expect(res.tier).toBe('screen');
    expect(res.executor).toBe('computer-use');
  });

  it('catalog — connector ro\'yxatini id/name/category bilan qaytaradi', () => {
    const catalog = router.catalog();
    expect(catalog.length).toBeGreaterThan(0);
    expect(catalog[0]).toEqual(
      expect.objectContaining({ id: expect.any(String), name: expect.any(String), category: expect.any(String) }),
    );
    expect(catalog.find((c) => c.id === 'telegram-bot')).toBeDefined();
  });
});
