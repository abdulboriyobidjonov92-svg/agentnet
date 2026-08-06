import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT, clampLimit, paginate } from './paginate';

/**
 * Phase 3 — kursorli pagination shartnomasi (Contract A18 / Konstitutsiya #24).
 *
 * Bu testlar shartnomaning JIM BUZILADIGAN joylarini qulflaydi:
 *   • `limit` chegarasi (100 dan oshiq so'rov butun jadvalni tortib olardi),
 *   • `limit + 1` naqshi (`hasMore` uchun ikkinchi `count()` so'rovi YO'Q),
 *   • `id` teng-buzuvchisi (usiz sahifa chegarasida qator yo'qoladi/takrorlanadi),
 *   • kursor qatorining o'zi ikkinchi marta qaytmasligi (`skip: 1`).
 */

function rows(n: number, from = 0) {
  return Array.from({ length: n }, (_, i) => ({ id: `id${from + i}` }));
}

type Row = { id: string };
/** `findMany(args)` — mock'ni tiplash uchun (tiplanmagan `jest.fn` `calls: []` beradi). */
type FindManyMock = jest.Mock<Promise<Row[]>, [Record<string, unknown>]>;

function delegateReturning(result: Row[]) {
  return { findMany: jest.fn(async () => result) as unknown as FindManyMock };
}

/** Birinchi `findMany` chaqiruvining argumentlari. */
function argsOf(d: { findMany: FindManyMock }): Record<string, unknown> {
  return d.findMany.mock.calls[0][0];
}

describe('clampLimit', () => {
  it('berilmasa default (30)', () => expect(clampLimit(undefined)).toBe(DEFAULT_PAGE_LIMIT));
  it('maksimumdan oshsa 100 ga qisqaradi', () => expect(clampLimit(5000)).toBe(MAX_PAGE_LIMIT));
  it('0 yoki manfiy -> 1', () => {
    expect(clampLimit(0)).toBe(1);
    expect(clampLimit(-10)).toBe(1);
  });
  it('kasr son butunlanadi', () => expect(clampLimit(10.9)).toBe(10));
  it('NaN -> default (yaroqsiz query bilan butun jadval tortilmasin)', () =>
    expect(clampLimit(Number.NaN)).toBe(DEFAULT_PAGE_LIMIT));
});

describe('paginate — so\'rov shakli', () => {
  it('`limit + 1` so\'raydi (hasMore uchun qo\'shimcha count() so\'rovi yo\'q)', async () => {
    const d = delegateReturning(rows(3));
    await paginate(d, {}, { limit: 10 });

    expect(d.findMany).toHaveBeenCalledTimes(1);
    expect(argsOf(d)).toEqual(expect.objectContaining({ take: 11 }));
  });

  it('kursorsiz so\'rovda `cursor`/`skip` YUBORILMAYDI', async () => {
    const d = delegateReturning(rows(3));
    await paginate(d, {}, {});

    const args = argsOf(d);
    expect(args.cursor).toBeUndefined();
    expect(args.skip).toBeUndefined();
  });

  it('kursor bilan `skip: 1` qo\'shiladi (kursor qatori ikki marta chiqmasin)', async () => {
    const d = delegateReturning(rows(3));
    await paginate(d, {}, { cursor: 'id7' });

    expect(argsOf(d)).toEqual(
      expect.objectContaining({ cursor: { id: 'id7' }, skip: 1 }),
    );
  });

  it('where/select/include o\'zgarishsiz uzatiladi', async () => {
    const d = delegateReturning(rows(1));
    const where = { userId: 'u1' };
    const select = { id: true };
    await paginate(d, { where, select }, {});

    expect(argsOf(d)).toEqual(expect.objectContaining({ where, select }));
  });
});

describe('paginate — `id` teng-buzuvchisi (determinizm)', () => {
  it('tartib berilmasa `id desc` qo\'shiladi', async () => {
    const d = delegateReturning(rows(1));
    await paginate(d, {}, {});

    expect(argsOf(d).orderBy).toEqual([{ id: 'desc' }]);
  });

  it('bitta obyekt-tartibga `id` shu yo\'nalishda qo\'shiladi', async () => {
    const d = delegateReturning(rows(1));
    await paginate(d, { orderBy: { createdAt: 'asc' } }, {});

    expect(argsOf(d).orderBy).toEqual([
      { createdAt: 'asc' },
      { id: 'asc' },
    ]);
  });

  it('massiv-tartib saqlanadi va oxiriga `id` qo\'shiladi', async () => {
    const d = delegateReturning(rows(1));
    await paginate(d, { orderBy: [{ status: 'asc' }, { createdAt: 'desc' }] }, {});

    expect(argsOf(d).orderBy).toEqual([
      { status: 'asc' },
      { createdAt: 'desc' },
      { id: 'asc' },
    ]);
  });

  it('chaqiruvchi `id`ni allaqachon bergan bo\'lsa TAKRORLANMAYDI', async () => {
    const d = delegateReturning(rows(1));
    await paginate(d, { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }, {});

    expect(argsOf(d).orderBy).toEqual([
      { createdAt: 'desc' },
      { id: 'desc' },
    ]);
  });
});

describe('paginate — javob shakli', () => {
  it('ortiqcha qator bo\'lsa: kesiladi, hasMore=true, nextCursor = oxirgi KO\'RSATILGAN qator', async () => {
    // limit 3 -> 4 qator qaytdi (id0..id3)
    const d = delegateReturning(rows(4));
    const page = await paginate(d, {}, { limit: 3 });

    expect(page.items.map((i) => i.id)).toEqual(['id0', 'id1', 'id2']);
    expect(page.hasMore).toBe(true);
    // MUHIM: kesib tashlangan `id3` emas, ko'rsatilgan oxirgi `id2`.
    expect(page.nextCursor).toBe('id2');
  });

  it('oxirgi sahifa: hasMore=false, nextCursor=null', async () => {
    const d = delegateReturning(rows(2));
    const page = await paginate(d, {}, { limit: 3 });

    expect(page.items).toHaveLength(2);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it('aynan `limit` ta qator -> hasMore=false (chegara holati)', async () => {
    const d = delegateReturning(rows(3));
    const page = await paginate(d, {}, { limit: 3 });

    expect(page.items).toHaveLength(3);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it('bo\'sh natija (jumladan ESKIRGAN kursor) -> bo\'sh sahifa, xato YO\'Q', async () => {
    // Jonli Postgres'da tekshirilgan: Prisma yaroqsiz kursorda xato tashlamaydi,
    // bo'sh natija qaytaradi. Ya'ni o'chirilgan qatorga ishora qiluvchi kursor
    // 500 bermaydi.
    const d = delegateReturning([]);
    const page = await paginate(d, {}, { cursor: 'ochirilgan-qator' });

    expect(page).toEqual({ items: [], nextCursor: null, hasMore: false });
  });

  it('limit berilmasa default 30 ishlatiladi', async () => {
    const d = delegateReturning(rows(31));
    const page = await paginate(d, {}, {});

    expect(page.items).toHaveLength(DEFAULT_PAGE_LIMIT);
    expect(page.hasMore).toBe(true);
  });
});
