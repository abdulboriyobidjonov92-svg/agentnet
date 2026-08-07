import { BriefingService } from './briefing.service';

const DAY = 86_400_000;

function makeService(opts: {
  users?: any[];
  stats?: { conversations?: number; newAgents?: number; activeAgents?: number; spentTiyin?: bigint };
}) {
  const sent: { chatId: string; text: string }[] = [];
  const updated: string[] = [];
  const s = opts.stats ?? {};
  const prisma: any = {
    user: {
      findMany: jest.fn(async () => opts.users ?? []),
      update: jest.fn(async ({ where }: any) => {
        updated.push(where.id);
        return {};
      }),
    },
    conversation: { count: jest.fn(async () => s.conversations ?? 0) },
    agent: {
      count: jest
        .fn()
        // 1-chaqiruv: newAgents, 2-chaqiruv: activeAgents (Promise.all tartibi)
        .mockImplementationOnce(async () => s.newAgents ?? 0)
        .mockImplementationOnce(async () => s.activeAgents ?? 0),
    },
    creditLedger: {
      aggregate: jest.fn(async () => ({ _sum: { amount: -(s.spentTiyin ?? 0) } })),
    },
  };
  const connectors: any = {
    sendViaChannel: jest.fn(async (_u: any, _ch: string, chatId: string, text: string) => {
      sent.push({ chatId, text });
    }),
  };
  return { svc: new BriefingService(prisma, connectors), sent, updated, prisma, connectors };
}

const baseUser = {
  id: 'u1',
  telegramChatId: '123',
  briefingOptIn: true,
  lastBriefingAt: null,
  preferredLanguage: 'uz',
};

describe('BriefingService', () => {
  it('isEligible — telegram yo‘q / opt-out / yaqinda yuborilgan -> false', () => {
    const { svc } = makeService({});
    expect(svc.isEligible({ telegramChatId: null, briefingOptIn: true, lastBriefingAt: null } as any)).toBe(false);
    expect(svc.isEligible({ telegramChatId: '1', briefingOptIn: false, lastBriefingAt: null } as any)).toBe(false);
    expect(
      svc.isEligible({ telegramChatId: '1', briefingOptIn: true, lastBriefingAt: new Date(Date.now() - 2 * DAY) } as any),
    ).toBe(false);
    expect(
      svc.isEligible({ telegramChatId: '1', briefingOptIn: true, lastBriefingAt: new Date(Date.now() - 8 * DAY) } as any),
    ).toBe(true);
  });

  it('composeMessage — 3 tilda to‘g‘ri matn', () => {
    const { svc } = makeService({});
    const stats = { conversations: 12, newAgents: 3, activeAgents: 5, spentSom: 8540 };
    expect(svc.composeMessage(stats, 'uz')).toContain('Haftalik brifing');
    expect(svc.composeMessage(stats, 'uz')).toContain('12');
    expect(svc.composeMessage(stats, 'ru')).toContain('Недельный брифинг');
    expect(svc.composeMessage(stats, 'en')).toContain('Weekly briefing');
    expect(svc.composeMessage(stats, null)).toContain('Haftalik'); // default uz
  });

  it('sendWeeklyBriefings — faol foydalanuvchiga yuboradi va lastBriefingAt yangilanadi', async () => {
    const { svc, sent, updated } = makeService({
      users: [baseUser],
      stats: { conversations: 4, newAgents: 1, activeAgents: 2, spentTiyin: 500_000n },
    });
    await svc.sendWeeklyBriefings();
    expect(sent).toHaveLength(1);
    expect(sent[0].chatId).toBe('123');
    expect(sent[0].text).toContain('4');
    expect(updated).toEqual(['u1']);
  });

  it('sendWeeklyBriefings — bo‘sh haftada shovqin YO‘Q (yubormaydi)', async () => {
    const { svc, sent, updated } = makeService({
      users: [baseUser],
      stats: { conversations: 0, newAgents: 0, activeAgents: 3, spentTiyin: 0n },
    });
    await svc.sendWeeklyBriefings();
    expect(sent).toHaveLength(0);
    expect(updated).toHaveLength(0);
  });

  it('sendWeeklyBriefings — bitta foydalanuvchi xatosi boshqalarni to‘xtatmaydi', async () => {
    const users = [
      { ...baseUser, id: 'bad', telegramChatId: 'bad-chat' },
      { ...baseUser, id: 'good', telegramChatId: 'good-chat' },
    ];
    const { svc, connectors, prisma } = makeService({
      users,
      stats: { conversations: 2, newAgents: 0, activeAgents: 1, spentTiyin: 0n },
    });
    // Har foydalanuvchi uchun stats chaqiriladi — mockImplementationOnce faqat birinchisiga
    // yetadi, ikkinchisiga default 0/0 bo'lib qolmasligi uchun countlarni qayta sozlaymiz
    prisma.agent.count = jest.fn(async () => 0);
    prisma.conversation.count = jest.fn(async () => 2);
    connectors.sendViaChannel = jest
      .fn()
      .mockRejectedValueOnce(new Error('telegram down'))
      .mockResolvedValueOnce(undefined);
    await svc.sendWeeklyBriefings();
    expect(connectors.sendViaChannel).toHaveBeenCalledTimes(2);
    // faqat muvaffaqiyatli yuborilgan foydalanuvchining lastBriefingAt yangilanadi
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    expect(prisma.user.update.mock.calls[0][0].where.id).toBe('good');
  });
});
