import { HttpException } from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';
import { AgentBillingService } from '../agents/agent-billing.service';
import type { User } from '@prisma/client';

/**
 * Y5: "yaratuvchi bonusi" — creation_price'ning yarmi, HAQIQIY balansga,
 * FAQAT yangi xaridorning BIRINCHI to'lovida. Eng ko'p xato qilinadigan joy:
 * keyingi oy(lar)dagi to'lovlarda bonus QAYTA berilmasligi kerak.
 */

function makeMock() {
  const prisma: any = {
    agent: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      count: jest.fn(async () => 0), // sinov-aniqlash: standart holatda "birinchi agent"
    },
    user: {
      updateMany: jest.fn(),
      update: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    creditLedger: { create: jest.fn(async (a: any) => ({ id: 'ledger1', ...a.data })), findUnique: jest.fn(async () => null) },
    agentInstall: { create: jest.fn(async (a: any) => ({ id: 'install1', ...a.data })) },
    creatorLedger: { create: jest.fn(async (a: any) => ({ id: 'creatorledger1', ...a.data })) },
    payout: {
      findUnique: jest.fn(async () => null),
      create: jest.fn(async (a: any) => ({ id: 'payout1', ...a.data })),
    },
    $executeRaw: jest.fn(),
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  };
  const audit = { record: jest.fn(async () => {}) } as any;
  return { prisma, audit };
}

function makeSource(overrides: Record<string, any> = {}) {
  return {
    id: 'source1',
    name: 'Buxgalter agenti',
    userId: 'creator1',
    isPublished: true,
    marketplacePrice: 1_000_000n, // 10 000 so'm (tiyin)
    creationPriceTiyin: 1_000_000n,
    monthlyPriceTiyin: 300_000n,
    systemPrompt: 'p', model: 'claude-sonnet-5',
    halalFilterEnabled: true, memoryEnabled: true, toolsConfig: [], vertical: null, description: null,
    ...overrides,
  };
}

const buyer = { id: 'buyer1' } as unknown as User;

describe('MarketplaceService.install — yaratuvchi bonusi (Payout)', () => {
  it('birinchi xarid: buyer balansidan yechiladi, creator 70% + 50% bonus oladi, Payout yoziladi', async () => {
    const { prisma, audit } = makeMock();
    prisma.agent.findUnique.mockResolvedValue(makeSource());
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.findUniqueOrThrow.mockResolvedValue({ balanceTiyin: 5_000_000n });
    prisma.agent.create.mockResolvedValue({ id: 'installed1' });
    prisma.user.update.mockResolvedValue({ balanceTiyin: 500_000n });
    const svc = new MarketplaceService(prisma, audit);

    await svc.install('source1', buyer);

    // Buyer balansi ATOMIK yechildi
    expect(prisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'buyer1', balanceTiyin: { gte: 1_000_000n } },
        data: { balanceTiyin: { decrement: 1_000_000n } },
      }),
    );
    // 70% revenue-share (mavjud mexanizm, o'zgarmagan)
    expect(prisma.creatorLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ kind: 'install_revenue', amount: 700_000n }) }),
    );
    // 50% bonus — HAQIQIY balansga
    expect(prisma.payout.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ agentId: 'source1', originalCreatorId: 'creator1', buyerId: 'buyer1', bonusAmountTiyin: 500_000n }),
      }),
    );
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'creator1' }, data: { balanceTiyin: { increment: 500_000n } } }),
    );
    expect(prisma.creditLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ kind: 'creator_bonus', amount: 500_000n }) }),
    );
  });

  it('balans yetarli emas -> 402, agent yaratilmaydi, bonus/creatorLedger yozilmaydi', async () => {
    const { prisma, audit } = makeMock();
    prisma.agent.findUnique.mockResolvedValue(makeSource());
    prisma.user.updateMany.mockResolvedValue({ count: 0 });
    const svc = new MarketplaceService(prisma, audit);

    try {
      await svc.install('source1', buyer);
      throw new Error('402 kutilgan edi');
    } catch (e: any) {
      expect(e).toBeInstanceOf(HttpException);
      expect(e.getStatus()).toBe(402);
      expect(e.getResponse().reason).toBe('insufficient_balance');
    }
    expect(prisma.agent.create).not.toHaveBeenCalled();
    expect(prisma.payout.create).not.toHaveBeenCalled();
    expect(prisma.creatorLedger.create).not.toHaveBeenCalled();
  });

  it('o\'ziga tegishli agentni "o\'rnatish" -> to\'lov/bonus YO\'Q', async () => {
    const { prisma, audit } = makeMock();
    const creatorAsBuyer = { id: 'creator1' } as unknown as User;
    prisma.agent.findUnique.mockResolvedValue(makeSource());
    prisma.agent.create.mockResolvedValue({ id: 'installed-self' });
    const svc = new MarketplaceService(prisma, audit);

    await svc.install('source1', creatorAsBuyer);

    expect(prisma.user.updateMany).not.toHaveBeenCalled();
    expect(prisma.payout.create).not.toHaveBeenCalled();
    expect(prisma.creatorLedger.create).not.toHaveBeenCalled();
  });

  it('bir xil xaridor bir xil agentni QAYTA o\'rnatsa -> bonus IKKINCHI marta berilmaydi', async () => {
    const { prisma, audit } = makeMock();
    prisma.agent.findUnique.mockResolvedValue(makeSource());
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.findUniqueOrThrow.mockResolvedValue({ balanceTiyin: 5_000_000n });
    prisma.agent.create.mockResolvedValue({ id: 'installed2' });
    // Bonus ALLAQACHON shu buyer+agent uchun mavjud
    prisma.payout.findUnique.mockResolvedValue({ id: 'payout-existing' });
    const svc = new MarketplaceService(prisma, audit);

    await svc.install('source1', buyer);

    expect(prisma.payout.create).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled(); // creator balansi oshirilmadi
    // Lekin buyer baribir haqiqiy narxni to'laydi (revenue-share ham davom etadi)
    expect(prisma.user.updateMany).toHaveBeenCalled();
    expect(prisma.creatorLedger.create).toHaveBeenCalled();
  });
});

describe('MarketplaceService + AgentBillingService — 2-oy/3-oy to\'lovda bonus QAYTA BERILMAYDI', () => {
  it('install() bonus beradi (Payout=1); keyingi ikkita oylik chargeOne() chaqiruvi Payout/creator balansiga TEGMAYDI', async () => {
    const { prisma, audit } = makeMock();
    prisma.agent.findUnique.mockResolvedValue(makeSource());
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.findUniqueOrThrow.mockResolvedValue({ balanceTiyin: 5_000_000n });
    prisma.agent.create.mockResolvedValue({ id: 'installed3' });
    prisma.user.update.mockResolvedValue({ balanceTiyin: 500_000n });
    const marketplace = new MarketplaceService(prisma, audit);

    await marketplace.install('source1', buyer);
    expect(prisma.payout.create).toHaveBeenCalledTimes(1);
    const payoutCallsAfterInstall = prisma.payout.create.mock.calls.length;

    // Endi o'sha o'rnatilgan agent uchun oylik cron ikki marta ishga tushadi
    // (2-oy, 3-oy) — bularda bonus HAQIDA HECH QANDAY KOD YO'Q (chargeOne
    // Payout'ni umuman bilmaydi), shuning uchun strukturaviy ravishda bonus
    // qayta berilmaydi. Buni aniq tasdiqlaymiz:
    const connectors = { sendViaChannel: jest.fn(async () => ({ ok: true })) } as any;
    const billing = new AgentBillingService(prisma, audit, connectors, { runExclusive: (_n: string, fn: () => Promise<unknown>) => fn() } as any);
    const installedAgent = {
      id: 'installed3', userId: 'buyer1', name: 'Buxgalter agenti (o\'rnatildi)',
      monthlyPriceTiyin: 300_000n, chargeRetries: 0n,
      nextChargeAt: new Date('2026-08-01T00:00:00Z'),
      user: { id: 'buyer1', telegramChatId: null },
    };

    await billing.chargeOne(installedAgent as any); // 2-oy
    await billing.chargeOne({ ...installedAgent, nextChargeAt: new Date('2026-09-01T00:00:00Z') } as any); // 3-oy

    // Payout jadvaliga hech qanday yangi yozuv qo'shilmadi
    expect(prisma.payout.create).toHaveBeenCalledTimes(payoutCallsAfterInstall);
    // Creator (source.userId='creator1') balansi chargeOne orqali HECH QACHON oshirilmadi
    const creatorBalanceIncrements = prisma.user.update.mock.calls.filter(
      (c: any[]) => c[0]?.where?.id === 'creator1',
    );
    expect(creatorBalanceIncrements).toHaveLength(1); // faqat install()dagi bitta bonus
  });
});

describe('MarketplaceService.publish — "shablonga aylantirish" (Y6)', () => {
  it('narx ko\'rsatilmasa — agentning O\'ZINING allaqachon to\'langan narxi SAQLANIB QOLADI', async () => {
    const { prisma, audit } = makeMock();
    const owner = { id: 'owner1' } as unknown as User;
    prisma.agent.findUnique.mockResolvedValue({
      id: 'agent1', userId: 'owner1', creationPriceTiyin: 1_890_000n, monthlyPriceTiyin: 300_000n,
    });
    prisma.agent.update.mockResolvedValue({ id: 'agent1' });
    const svc = new MarketplaceService(prisma, audit);

    await svc.publish('agent1', owner);

    expect(prisma.agent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isPublished: true,
          creationPriceTiyin: 1_890_000n,
          monthlyPriceTiyin: 300_000n,
          originalCreatorId: 'owner1',
        }),
      }),
    );
  });

  it('narx aniq ko\'rsatilsa — o\'sha qiymat ishlatiladi (mavjud narx e\'tiborga olinmaydi)', async () => {
    const { prisma, audit } = makeMock();
    const owner = { id: 'owner1' } as unknown as User;
    prisma.agent.findUnique.mockResolvedValue({
      id: 'agent1', userId: 'owner1', creationPriceTiyin: 1_890_000n, monthlyPriceTiyin: 300_000n,
    });
    prisma.agent.update.mockResolvedValue({ id: 'agent1' });
    const svc = new MarketplaceService(prisma, audit);

    await svc.publish('agent1', owner, 500_000, undefined, 100_000);

    expect(prisma.agent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ creationPriceTiyin: 500_000n, monthlyPriceTiyin: 100_000n }),
      }),
    );
  });
});
