import { TemplatesController } from './templates.controller';
import type { User } from '@prisma/client';

const user = { id: 'u1' } as unknown as User;

function makeSvc() {
  return {
    list: jest.fn(async () => []),
    match: jest.fn(() => []),
    get: jest.fn(async () => ({})),
    install: jest.fn(async () => ({})),
  } as any;
}

describe('TemplatesController — parametrlar to\'g\'ri uzatiladi', () => {
  it('list — language query-parametrini uzatadi', async () => {
    const templates = makeSvc();
    const controller = new TemplatesController(templates);

    await controller.list('ru');
    expect(templates.list).toHaveBeenCalledWith('ru');
  });

  it("match — bo'sh q bo'lsa '' ga tushadi (:id marshrutidan OLDIN e'lon qilinishi kerak)", async () => {
    const templates = makeSvc();
    const controller = new TemplatesController(templates);

    await controller.match(undefined as any, 'uz');
    expect(templates.match).toHaveBeenCalledWith('', 'uz');
  });

  it('get — id va language parametrlarini uzatadi', async () => {
    const templates = makeSvc();
    const controller = new TemplatesController(templates);

    await controller.get('shop-owner', 'en');
    expect(templates.get).toHaveBeenCalledWith('shop-owner', 'en');
  });

  it("install — joriy foydalanuvchi, id va body.language'ni uzatadi", async () => {
    const templates = makeSvc();
    const controller = new TemplatesController(templates);

    await controller.install(user, 'shop-owner', { language: 'uz' });
    expect(templates.install).toHaveBeenCalledWith(user, 'shop-owner', 'uz');
  });
});
