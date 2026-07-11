import { ReferralService } from './referral.service';
import type { User } from '@prisma/client';

interface Row {
  id: string;
  referralCode: string | null;
  referredById: string | null;
  balanceTiyin: number;
}

function makeMockPrisma(users: Row[]) {
  const ledger: any[] = [];
  const find = (id: string) => users.find((u) => u.id === id)!;
  const prisma: any = {
    _users: users,
    _ledger: ledger,
    user: {
      update: jest.fn(async ({ where, data, select }: any) => {
        const u = find(where.id);
        if (data.balanceTiyin?.increment) u.balanceTiyin += data.balanceTiyin.increment;
        if (select?.balanceTiyin) return { balanceTiyin: u.balanceTiyin };
        return u;
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        // Kod lazily yaratish: where { id, referralCode: null }
        if ('referralCode' in where) {
          const u = users.find((x) => x.id === where.id && x.referralCode === null);
          if (!u) return { count: 0 };
          u.referralCode = data.referralCode;
          return { count: 1 };
        }
        // Signup bog'lash: where { id, referredById: null }
        const u = users.find((x) => x.id === where.id && x.referredById === where.referredById);
        if (!u) return { count: 0 };
        u.referredById = data.referredById;
        return { count: 1 };
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.referralCode) return users.find((u) => u.referralCode === where.referralCode) ?? null;
        return users.find((u) => u.id === where.id) ?? null;
      }),
      count: jest.fn(async ({ where }: any) => users.filter((u) => u.referredById === where.referredById).length),
    },
    creditLedger: {
      create: jest.fn(async ({ data }: any) => {
        ledger.push(data);
        return data;
      }),
      count: jest.fn(async ({ where }: any) =>
        ledger.filter((l) => l.userId === where.userId && l.kind === where.kind).length,
      ),
      aggregate: jest.fn(async ({ where }: any) => ({
        _sum: {
          amount: ledger
            .filter((l) => l.userId === where.userId && l.kind === where.kind)
            .reduce((s, l) => s + l.amount, 0),
        },
      })),
    },
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  };
  return prisma;
}

const asUser = (r: Row) => r as unknown as User;

describe('ReferralService', () => {
  it('getMyReferralInfo — kod lazily yaratiladi va formati to‘g‘ri', async () => {
    const users: Row[] = [{ id: 'u1', referralCode: null, referredById: null, balanceTiyin: 0 }];
    const svc = new ReferralService(makeMockPrisma(users) as any);
    const info = await svc.getMyReferralInfo(asUser(users[0]));
    expect(info.code).toMatch(/^[A-Z2-9]{8}$/);
    expect(info.invitedCount).toBe(0);
    expect(info.bonusSom).toBeGreaterThan(0);
  });

  it('applyReferralOnSignup — ikkala tomonga bonus + ledger yoziladi', async () => {
    const users: Row[] = [
      { id: 'referrer', referralCode: 'ABCD2345', referredById: null, balanceTiyin: 0 },
      { id: 'newbie', referralCode: null, referredById: null, balanceTiyin: 0 },
    ];
    const prisma = makeMockPrisma(users);
    const svc = new ReferralService(prisma as any);
    const ok = await svc.applyReferralOnSignup('newbie', 'abcd2345'); // kichik harf ham normalizatsiya
    expect(ok).toBe(true);
    expect(users[1].referredById).toBe('referrer');
    expect(users[0].balanceTiyin).toBe(svc.bonusTiyin);
    expect(users[1].balanceTiyin).toBe(svc.bonusTiyin);
    expect(prisma._ledger).toHaveLength(2);
    expect(prisma._ledger.every((l: any) => l.kind === 'referral_bonus')).toBe(true);
  });

  it('applyReferralOnSignup — o‘z-o‘zini taklif rad etiladi', async () => {
    const users: Row[] = [{ id: 'u1', referralCode: 'ABCD2345', referredById: null, balanceTiyin: 0 }];
    const svc = new ReferralService(makeMockPrisma(users) as any);
    expect(await svc.applyReferralOnSignup('u1', 'ABCD2345')).toBe(false);
    expect(users[0].balanceTiyin).toBe(0);
  });

  it('applyReferralOnSignup — allaqachon bog‘langan foydalanuvchiga takror bonus YO‘Q', async () => {
    const users: Row[] = [
      { id: 'referrer', referralCode: 'ABCD2345', referredById: null, balanceTiyin: 0 },
      { id: 'newbie', referralCode: null, referredById: 'someoneElse', balanceTiyin: 0 },
    ];
    const prisma = makeMockPrisma(users);
    const svc = new ReferralService(prisma as any);
    expect(await svc.applyReferralOnSignup('newbie', 'ABCD2345')).toBe(false);
    expect(prisma._ledger).toHaveLength(0);
    expect(users[0].balanceTiyin).toBe(0);
  });

  it('applyReferralOnSignup — noma’lum/yaroqsiz kod no-op', async () => {
    const users: Row[] = [{ id: 'newbie', referralCode: null, referredById: null, balanceTiyin: 0 }];
    const svc = new ReferralService(makeMockPrisma(users) as any);
    expect(await svc.applyReferralOnSignup('newbie', 'YOQKOD99')).toBe(false);
    expect(await svc.applyReferralOnSignup('newbie', '!!bad!!')).toBe(false);
    expect(users[0].referredById).toBeNull();
  });
});
