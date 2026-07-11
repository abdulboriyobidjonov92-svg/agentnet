import { NotFoundException } from '@nestjs/common';
import { ShareService } from './share.service';
import type { User } from '@prisma/client';

function makeMockPrisma() {
  const rows: any[] = [];
  return {
    _rows: rows,
    sharedResult: {
      create: jest.fn(async ({ data, select }: any) => {
        const row = { id: `s${rows.length + 1}`, views: 0, createdAt: new Date(), ...data };
        rows.push(row);
        return select ? { token: row.token } : row;
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        const row = rows.find((r) => r.token === where.token);
        if (!row) return null;
        return { ...row, owner: { name: 'Abdulboriy' } };
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const row = rows.find((r) => r.token === where.token);
        if (data?.views?.increment) row.views += data.views.increment;
        return row;
      }),
    },
  };
}

const user = { id: 'u1' } as unknown as User;

describe('ShareService', () => {
  it('create — token qaytaradi, kind validatsiya, metrics 6 taga kesiladi', async () => {
    const prisma = makeMockPrisma();
    const svc = new ShareService(prisma as any);
    const metrics = Array.from({ length: 10 }, (_, i) => ({ label: `L${i}`, value: `${i}` }));
    const res = await svc.create(user, { kind: 'hacked' as any, title: 'T', metrics });
    expect(typeof res.token).toBe('string');
    expect(res.token.length).toBeGreaterThanOrEqual(10);
    expect(prisma._rows[0].kind).toBe('generic'); // noma'lum kind fallback
    expect((prisma._rows[0].metrics as any[]).length).toBe(6); // kesildi
  });

  it('create — uzun title/subtitle kesiladi, locale validatsiya', async () => {
    const prisma = makeMockPrisma();
    const svc = new ShareService(prisma as any);
    await svc.create(user, {
      kind: 'retail_forecast',
      title: 'x'.repeat(500),
      subtitle: 'y'.repeat(500),
      locale: 'fr',
    });
    expect(prisma._rows[0].title.length).toBe(120);
    expect(prisma._rows[0].subtitle.length).toBe(160);
    expect(prisma._rows[0].locale).toBe('uz'); // fr -> fallback
    expect(prisma._rows[0].kind).toBe('retail_forecast');
  });

  it('getPublic — mavjud token: snapshot + muallif + view increment', async () => {
    const prisma = makeMockPrisma();
    const svc = new ShareService(prisma as any);
    const { token } = await svc.create(user, { title: 'Tushum', metrics: [{ label: 'Oy', value: '12 mln' }] });
    const pub = await svc.getPublic(token);
    expect(pub.title).toBe('Tushum');
    expect(pub.authorName).toBe('Abdulboriy');
    expect(pub.metrics).toEqual([{ label: 'Oy', value: '12 mln' }]);
    expect(pub.views).toBe(1);
  });

  it('getPublic — mavjud bo‘lmagan token 404', async () => {
    const prisma = makeMockPrisma();
    const svc = new ShareService(prisma as any);
    await expect(svc.getPublic('yoq-token')).rejects.toThrow(NotFoundException);
  });
});
