import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import type { User } from '@prisma/client';

/**
 * ConversationsService — egalik guardi (findOne/addMessage/clear/remove),
 * va ikkita fire-and-forget hook (Twin fakt-ajratish, Marketplace
 * foydalanish-kuzatuvi) suhbat oqimini SEKINLASHTIRMASLIGI/BUZMASLIGI.
 */

function makeMock() {
  const prisma: any = {
    agent: { findUnique: jest.fn() },
    conversation: {
      create: jest.fn(async (a: any) => ({ id: 'c1', ...a.data })),
      findMany: jest.fn(async () => []),
      findUnique: jest.fn(),
      update: jest.fn(async (a: any) => ({ id: 'c1', ...a.data })),
      delete: jest.fn(async (a: any) => ({ id: a.where.id })),
    },
  };
  const twin = { extractAndStore: jest.fn(async () => {}) } as any;
  const marketplace = { recordUsage: jest.fn(async () => {}) } as any;
  return { prisma, twin, marketplace };
}

const user = { id: 'u1' } as unknown as User;

describe('ConversationsService.create', () => {
  it("mavjud bo'lmagan agent -> NotFoundException", async () => {
    const { prisma, twin, marketplace } = makeMock();
    prisma.agent.findUnique.mockResolvedValue(null);
    const svc = new ConversationsService(prisma, twin, marketplace);

    await expect(svc.create(user, 'yoq-agent')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ConversationsService.findOne — egalik guardi', () => {
  it("boshqa foydalanuvchining suhbati -> ForbiddenException", async () => {
    const { prisma, twin, marketplace } = makeMock();
    prisma.conversation.findUnique.mockResolvedValue({ id: 'c1', userId: 'boshqa', messages: [] });
    const svc = new ConversationsService(prisma, twin, marketplace);

    await expect(svc.findOne('c1', user)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("topilmasa -> NotFoundException", async () => {
    const { prisma, twin, marketplace } = makeMock();
    prisma.conversation.findUnique.mockResolvedValue(null);
    const svc = new ConversationsService(prisma, twin, marketplace);

    await expect(svc.findOne('yoq', user)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ConversationsService.addMessages — fire-and-forget hook\'lar', () => {
  it("foydalanuvchi xabarlaridan Twin faktlarni fon rejimida ajratadi (await qilinmaydi)", async () => {
    const { prisma, twin, marketplace } = makeMock();
    prisma.conversation.findUnique.mockResolvedValue({ id: 'c1', userId: 'u1', agentId: 'a1', messages: [] });
    const svc = new ConversationsService(prisma, twin, marketplace);

    await svc.addMessages('c1', user, [
      { role: 'user', content: 'Salom, men ertaga safarga chiqaman', timestamp: 't1' },
      { role: 'assistant', content: 'Yaxshi yo\'l!', timestamp: 't2' },
    ]);

    expect(twin.extractAndStore).toHaveBeenCalledWith(user, 'Salom, men ertaga safarga chiqaman', 'conversation');
  });

  it("faqat assistant xabar bo'lsa (user matni yo'q) -> Twin CHAQIRILMAYDI", async () => {
    const { prisma, twin, marketplace } = makeMock();
    prisma.conversation.findUnique.mockResolvedValue({ id: 'c1', userId: 'u1', agentId: 'a1', messages: [] });
    const svc = new ConversationsService(prisma, twin, marketplace);

    await svc.addMessages('c1', user, [{ role: 'assistant', content: 'Salom!', timestamp: 't1' }]);

    expect(twin.extractAndStore).not.toHaveBeenCalled();
  });

  it("marketplace'dan o'rnatilgan agent (sourceAgentId bor) muvaffaqiyatli javob bersa -> recordUsage(true)", async () => {
    const { prisma, twin, marketplace } = makeMock();
    prisma.conversation.findUnique.mockResolvedValue({ id: 'c1', userId: 'u1', agentId: 'a1', messages: [] });
    prisma.agent.findUnique.mockResolvedValue({ sourceAgentId: 'src-1' });
    const svc = new ConversationsService(prisma, twin, marketplace);

    await svc.addMessages('c1', user, [{ role: 'assistant', content: 'Bajarildi', timestamp: 't1' }]);
    await new Promise((r) => setImmediate(r)); // fire-and-forget mikrotask navbatini bo'shatish

    expect(marketplace.recordUsage).toHaveBeenCalledWith('src-1', true);
  });

  it("halalFlag='BLOCK' bo'lsa muvaffaqiyatsiz deb hisoblanadi -> recordUsage(false)", async () => {
    const { prisma, twin, marketplace } = makeMock();
    prisma.conversation.findUnique.mockResolvedValue({ id: 'c1', userId: 'u1', agentId: 'a1', messages: [] });
    prisma.agent.findUnique.mockResolvedValue({ sourceAgentId: 'src-1' });
    const svc = new ConversationsService(prisma, twin, marketplace);

    await svc.addMessages('c1', user, [{ role: 'assistant', content: 'bloklandi', halalFlag: 'BLOCK', timestamp: 't1' }]);
    await new Promise((r) => setImmediate(r));

    expect(marketplace.recordUsage).toHaveBeenCalledWith('src-1', false);
  });

  it("agent marketplace'dan emas (sourceAgentId yo'q) -> recordUsage CHAQIRILMAYDI", async () => {
    const { prisma, twin, marketplace } = makeMock();
    prisma.conversation.findUnique.mockResolvedValue({ id: 'c1', userId: 'u1', agentId: 'a1', messages: [] });
    prisma.agent.findUnique.mockResolvedValue({ sourceAgentId: null });
    const svc = new ConversationsService(prisma, twin, marketplace);

    await svc.addMessages('c1', user, [{ role: 'assistant', content: 'ok', timestamp: 't1' }]);
    await new Promise((r) => setImmediate(r));

    expect(marketplace.recordUsage).not.toHaveBeenCalled();
  });

  it("Twin/Marketplace @Optional bo'lib berilmasa -> xatosiz ishlaydi (vertikal-agent yo'li ularsiz ham to'liq ishlashi kerak)", async () => {
    const { prisma } = makeMock();
    prisma.conversation.findUnique.mockResolvedValue({ id: 'c1', userId: 'u1', agentId: 'a1', messages: [] });
    const svc = new ConversationsService(prisma); // twin/marketplace berilmagan

    await expect(
      svc.addMessages('c1', user, [{ role: 'user', content: 'salom', timestamp: 't1' }]),
    ).resolves.toBeDefined();
  });
});

describe('ConversationsService.clear / remove — egalik tekshiruvidan keyin', () => {
  it("clear — boshqa foydalanuvchi suhbatini tozalay olmaydi", async () => {
    const { prisma, twin, marketplace } = makeMock();
    prisma.conversation.findUnique.mockResolvedValue({ id: 'c1', userId: 'boshqa', messages: [] });
    const svc = new ConversationsService(prisma, twin, marketplace);

    await expect(svc.clear('c1', user)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.conversation.update).not.toHaveBeenCalled();
  });

  it("remove — o'z suhbatini o'chira oladi", async () => {
    const { prisma, twin, marketplace } = makeMock();
    prisma.conversation.findUnique.mockResolvedValue({ id: 'c1', userId: 'u1', messages: [] });
    const svc = new ConversationsService(prisma, twin, marketplace);

    await svc.remove('c1', user);
    expect(prisma.conversation.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
  });
});
