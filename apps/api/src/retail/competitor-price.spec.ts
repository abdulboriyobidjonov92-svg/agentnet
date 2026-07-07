import { CompetitorPriceService } from './competitor-price.service';
import type { User } from '@prisma/client';

function makeMock() {
  return {
    competitorSource: { findMany: jest.fn(async (): Promise<any[]> => []), create: jest.fn(), findFirst: jest.fn() },
    competitorPriceCheck: { create: jest.fn(async (a: any) => ({ id: 'chk1', ...a.data })) },
    retailProduct: { findUnique: jest.fn() },
    retailAlert: { create: jest.fn(async (a: any) => ({ id: 'alert1', ...a.data })) },
  };
}

const user = { id: 'u1' } as unknown as User;

describe('CompetitorPriceService — kunlik tekshiruv (manual manba, cheklovsiz scrape emas)', () => {
  it('manual manba narxi o\'z narxdan sezilarli arzon -> alert yaratiladi', async () => {
    const prisma = makeMock();
    const audit = { record: jest.fn() } as any;
    prisma.competitorSource.findMany.mockResolvedValue([
      { id: 's1', userId: 'u1', sku: 'SUT-1L', name: 'Qo\'lda', url: null, manualPrice: 1_200_000, active: true },
    ]);
    prisma.retailProduct.findUnique.mockResolvedValue({ name: 'Sut 1L', price: 1_400_000 });
    const svc = new CompetitorPriceService(prisma as any, audit);

    const results = await svc.runCheckForUser(user);

    expect(results).toHaveLength(1);
    expect(prisma.competitorPriceCheck.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ price: 1_200_000, ok: true }) }),
    );
    expect(prisma.retailAlert.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ kind: 'competitor_price' }) }),
    );
  });

  it('raqobatchi narxi chegaradan kam farq qilsa -> alert YARATILMAYDI', async () => {
    const prisma = makeMock();
    const audit = { record: jest.fn() } as any;
    prisma.competitorSource.findMany.mockResolvedValue([
      { id: 's1', userId: 'u1', sku: 'SUT-1L', name: 'Qo\'lda', url: null, manualPrice: 1_390_000, active: true },
    ]);
    prisma.retailProduct.findUnique.mockResolvedValue({ name: 'Sut 1L', price: 1_400_000 });
    const svc = new CompetitorPriceService(prisma as any, audit);

    await svc.runCheckForUser(user);

    expect(prisma.retailAlert.create).not.toHaveBeenCalled();
  });

  it('URL manbasidan noto\'g\'ri javob kelsa xato sifatida yoziladi, tizim yiqilmaydi', async () => {
    const prisma = makeMock();
    const audit = { record: jest.fn() } as any;
    prisma.competitorSource.findMany.mockResolvedValue([
      { id: 's2', userId: 'u1', sku: 'SUT-1L', name: 'OLX', url: 'https://example.invalid/xyz', manualPrice: null, active: true },
    ]);
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => ({ ok: false, status: 404 })) as any;
    const svc = new CompetitorPriceService(prisma as any, audit);

    const results = await svc.runCheckForUser(user);

    expect(results[0]).toEqual(expect.objectContaining({ ok: false }));
    expect(prisma.retailAlert.create).not.toHaveBeenCalled();
    global.fetch = originalFetch;
  });
});
