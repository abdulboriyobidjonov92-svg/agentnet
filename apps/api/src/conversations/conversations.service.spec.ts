import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConversationsService, toApiMessage } from './conversations.service';
import type { Message } from '@prisma/client';

/**
 * A15 — `Message` jadvali cutover'i. Bu testlar shartnomani qulflaydi:
 *   • tashqi API shakli legacy JSON bilan BIR XIL (mijozlar uchun ko'rinmas),
 *   • tartib doim (createdAt asc, id asc),
 *   • egalik (IDOR) har xabar-amalida tekshiriladi,
 *   • append = mustaqil INSERT'lar (advisory lock yo'q),
 *   • clear tarixni o'chiradi, suhbatning o'zini emas.
 */

function makePrisma() {
  const prisma: any = {
    agent: { findUnique: jest.fn(async () => ({ id: 'agent1' })) },
    conversation: {
      create: jest.fn(async (a: any) => ({ id: 'conv1', ...a.data })),
      findUnique: jest.fn(async () => ({ id: 'conv1', userId: 'u1', agentId: 'agent1' })),
      update: jest.fn(async (a: any) => a),
      delete: jest.fn(async () => ({ id: 'conv1' })),
    },
    message: {
      create: jest.fn(async (a: any) => ({
        id: 'm_' + prisma.message.create.mock.calls.length,
        halalFlag: null,
        demoMode: false,
        createdAt: new Date('2026-08-08T10:00:00.000Z'),
        ...a.data,
      })),
      findMany: jest.fn(async () => []),
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  };
  return prisma;
}

const user = { id: 'u1' } as any;
const stranger = { id: 'boshqa' } as any;

function row(partial: Partial<Message>): Message {
  return {
    id: 'm1',
    conversationId: 'conv1',
    role: 'user',
    content: 'salom',
    halalFlag: null,
    demoMode: false,
    createdAt: new Date('2026-08-08T10:00:00.000Z'),
    ...partial,
  } as Message;
}

describe('toApiMessage — legacy JSON shakli saqlanadi', () => {
  it('minimal xabar: halalFlag/demoMode KALITLARI umuman chiqmaydi (asl JSON kabi)', () => {
    expect(toApiMessage(row({}))).toEqual({
      role: 'user',
      content: 'salom',
      timestamp: '2026-08-08T10:00:00.000Z',
    });
  });

  it('halalFlag va demoMode bor bo\'lsa chiqadi', () => {
    expect(toApiMessage(row({ role: 'assistant', halalFlag: 'ok', demoMode: true }))).toEqual({
      role: 'assistant',
      content: 'salom',
      halalFlag: 'ok',
      demoMode: true,
      timestamp: '2026-08-08T10:00:00.000Z',
    });
  });
});

describe('ConversationsService — egalik (IDOR)', () => {
  it.each(['addMessage', 'clear', 'remove', 'messages'] as const)(
    '%s — begona foydalanuvchi -> ForbiddenException',
    async (method) => {
      const prisma = makePrisma();
      const svc = new ConversationsService(prisma);
      const call =
        method === 'addMessage'
          ? svc.addMessage('conv1', stranger, { role: 'user', content: 'x' })
          : method === 'messages'
            ? svc.messages('conv1', stranger)
            : svc[method]('conv1', stranger);
      await expect(call).rejects.toBeInstanceOf(ForbiddenException);
    },
  );

  it('mavjud bo\'lmagan suhbat -> NotFoundException', async () => {
    const prisma = makePrisma();
    prisma.conversation.findUnique.mockResolvedValue(null);
    const svc = new ConversationsService(prisma);
    await expect(svc.addMessage('yoq', user, { role: 'user', content: 'x' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('ConversationsService — append (A15 konkurentlik modeli)', () => {
  it('addMessages — har xabar mustaqil INSERT, kiritilgan tartibda, advisory lock YO\'Q', async () => {
    const prisma = makePrisma();
    const svc = new ConversationsService(prisma);

    await svc.addMessages('conv1', user, [
      { role: 'user', content: 'savol', timestamp: '2026-08-08T10:00:00.000Z' },
      { role: 'assistant', content: 'javob', halalFlag: 'ok', demoMode: true, timestamp: '2026-08-08T10:00:01.000Z' },
    ]);

    const datas = prisma.message.create.mock.calls.map((c: any) => c[0].data);
    expect(datas).toEqual([
      { conversationId: 'conv1', role: 'user', content: 'savol', halalFlag: null, demoMode: false, createdAt: new Date('2026-08-08T10:00:00.000Z') },
      { conversationId: 'conv1', role: 'assistant', content: 'javob', halalFlag: 'ok', demoMode: true, createdAt: new Date('2026-08-08T10:00:01.000Z') },
    ]);
    // JSON davri artefaktlari yo'q: massiv o'qilmaydi, lock olinmaydi.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    // Suhbat "oxirgi faollik" uchun yangilanadi.
    expect(prisma.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'conv1' }, data: { updatedAt: expect.any(Date) } }),
    );
  });

  it('timestamp berilmasa server vaqti ishlatiladi', async () => {
    const prisma = makePrisma();
    const svc = new ConversationsService(prisma);
    const before = Date.now();

    await svc.addMessage('conv1', user, { role: 'user', content: 'x' });

    const created = prisma.message.create.mock.calls[0][0].data.createdAt as Date;
    expect(created.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('bo\'sh partiya -> hech qanday yozuv yo\'q', async () => {
    const prisma = makePrisma();
    const svc = new ConversationsService(prisma);
    const res = await svc.addMessages('conv1', user, []);
    expect(res).toEqual([]);
    expect(prisma.message.create).not.toHaveBeenCalled();
  });
});

describe('ConversationsService — o\'qish', () => {
  it('findOne — xabarlar (createdAt, id) tartibida so\'raladi va API shakliga o\'giriladi', async () => {
    const prisma = makePrisma();
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conv1',
      userId: 'u1',
      messages: [row({ id: 'a' }), row({ id: 'b', role: 'assistant', content: 'javob' })],
      agent: { name: 'A' },
    });
    const svc = new ConversationsService(prisma);

    const res = await svc.findOne('conv1', user);

    expect(prisma.conversation.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          messages: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
        }),
      }),
    );
    expect(res.messages).toEqual([
      expect.objectContaining({ role: 'user', content: 'salom' }),
      expect.objectContaining({ role: 'assistant', content: 'javob' }),
    ]);
  });

  it('messages() — kursorli sahifa, eng yangilari birinchi', async () => {
    const prisma = makePrisma();
    prisma.message.findMany.mockResolvedValue([row({ id: 'm2' }), row({ id: 'm1' })]);
    const svc = new ConversationsService(prisma);

    const page = await svc.messages('conv1', user, { limit: 2 });

    expect(prisma.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { conversationId: 'conv1' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 3, // paginate: limit + 1 (hasMore uchun)
      }),
    );
    expect(page.items).toHaveLength(2);
    expect(page.items[0]).toEqual(expect.objectContaining({ role: 'user', content: 'salom' }));
    expect(page).toEqual(expect.objectContaining({ nextCursor: null, hasMore: false }));
  });

  it('bo\'sh suhbat -> bo\'sh sahifa', async () => {
    const prisma = makePrisma();
    const svc = new ConversationsService(prisma);
    const page = await svc.messages('conv1', user);
    expect(page).toEqual({ items: [], nextCursor: null, hasMore: false });
  });
});

describe('ConversationsService — o\'chirish', () => {
  it('clear — faqat xabarlar o\'chadi, suhbat QOLADI', async () => {
    const prisma = makePrisma();
    const svc = new ConversationsService(prisma);

    await svc.clear('conv1', user);

    expect(prisma.message.deleteMany).toHaveBeenCalledWith({ where: { conversationId: 'conv1' } });
    expect(prisma.conversation.delete).not.toHaveBeenCalled();
  });

  it('remove — suhbat o\'chadi (xabarlar FK Cascade bilan birga ketadi)', async () => {
    const prisma = makePrisma();
    const svc = new ConversationsService(prisma);

    await svc.remove('conv1', user);

    expect(prisma.conversation.delete).toHaveBeenCalledWith({ where: { id: 'conv1' } });
    // Cascade DB darajasida — kod alohida deleteMany chaqirmaydi.
    expect(prisma.message.deleteMany).not.toHaveBeenCalled();
  });
});
