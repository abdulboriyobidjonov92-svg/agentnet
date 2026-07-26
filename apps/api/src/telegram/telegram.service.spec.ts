import { of } from 'rxjs';
import { TelegramService } from './telegram.service';
import { signToken } from '../auth/token.util';
import type { User } from '@prisma/client';

/**
 * TelegramService — /start bog'lash oqimi (yaroqli/yaroqsiz token), /agents
 * va /run_<id> marshrutlash, va bitta-agent qisqartma yo'li. Hech bir
 * xato-holat foydalanuvchini javobsiz qoldirmasligi (har doim sendMessage
 * chaqirilishi) tekshiriladi.
 */

function makeMock() {
  const prisma: any = {
    user: { findUnique: jest.fn(), update: jest.fn(async (a: any) => ({ id: a.where.id, ...a.data })) },
    agent: { findMany: jest.fn(async () => []), findFirst: jest.fn(async () => null) },
  };
  const http = { post: jest.fn(() => of({ data: {} })) } as any;
  const agentsService = { run: jest.fn() } as any;
  return { prisma, http, agentsService };
}

function textUpdate(text: string, chatId: number | string = 555) {
  return { message: { chat: { id: chatId }, text } };
}

describe('TelegramService.sendMessage', () => {
  const ORIGINAL_ENV = process.env;
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });
  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("TELEGRAM_BOT_TOKEN yo'q -> hech narsa yubormaydi (http chaqirilmaydi)", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    const { prisma, http, agentsService } = makeMock();
    const svc = new TelegramService(http, prisma, agentsService);

    await svc.sendMessage(1, 'salom');
    expect(http.post).not.toHaveBeenCalled();
  });

  it('token bor -> Telegram sendMessage API-siga POST qiladi', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'bot-token';
    const { prisma, http, agentsService } = makeMock();
    const svc = new TelegramService(http, prisma, agentsService);

    await svc.sendMessage(42, 'Salom!');
    expect(http.post).toHaveBeenCalledWith(
      'https://api.telegram.org/bot' + 'bot-token' + '/sendMessage',
      expect.objectContaining({ chat_id: 42, text: 'Salom!' }),
    );
  });
});

describe('TelegramService.generateLinkCode', () => {
  const ORIGINAL_ENV = process.env;
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, AUTH_JWT_SECRET: 'a'.repeat(32) };
  });
  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("TELEGRAM_BOT_USERNAME bor -> t.me havolasi", () => {
    process.env.TELEGRAM_BOT_USERNAME = 'AgentNetBot';
    const { prisma, http, agentsService } = makeMock();
    const svc = new TelegramService(http, prisma, agentsService);

    const res = svc.generateLinkCode({ id: 'u1' } as unknown as User);
    expect(res.url).toBe(`https://t.me/AgentNetBot?start=${res.code}`);
    expect(res.expiresInSeconds).toBe(600);
  });

  it("TELEGRAM_BOT_USERNAME yo'q -> url null", () => {
    delete process.env.TELEGRAM_BOT_USERNAME;
    const { prisma, http, agentsService } = makeMock();
    const svc = new TelegramService(http, prisma, agentsService);

    expect(svc.generateLinkCode({ id: 'u1' } as unknown as User).url).toBeNull();
  });
});

describe('TelegramService.handleUpdate', () => {
  const ORIGINAL_ENV = process.env;
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, TELEGRAM_BOT_TOKEN: 'bot-token', AUTH_JWT_SECRET: 'a'.repeat(32) };
  });
  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("matnsiz update (masalan rasm) -> hech narsa qilmaydi", async () => {
    const { prisma, http, agentsService } = makeMock();
    const svc = new TelegramService(http, prisma, agentsService);

    await svc.handleUpdate({ message: { chat: { id: 1 } } });
    expect(http.post).not.toHaveBeenCalled();
  });

  describe('/start', () => {
    it("yaroqli token -> hisobni bog'laydi va tabriklaydi", async () => {
      const { prisma, http, agentsService } = makeMock();
      const svc = new TelegramService(http, prisma, agentsService);
      const linkToken = signToken({ sub: 'u1' }, 600);

      await svc.handleUpdate(textUpdate(`/start ${linkToken}`, 777));

      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { telegramChatId: '777' } });
      const sentText = http.post.mock.calls[0][1].text;
      expect(sentText).toContain('Hisobingiz ulandi');
    });

    it("yaroqsiz/eskirgan token -> DB YANGILANMAYDI, xato xabari yuboriladi", async () => {
      const { prisma, http, agentsService } = makeMock();
      const svc = new TelegramService(http, prisma, agentsService);

      await svc.handleUpdate(textUpdate('/start yaroqsiz.token.bu-yer', 777));

      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(http.post.mock.calls[0][1].text).toContain('yaroqsiz');
    });

    it("payload'siz /start -> xush kelibsiz xabari", async () => {
      const { prisma, http, agentsService } = makeMock();
      const svc = new TelegramService(http, prisma, agentsService);

      await svc.handleUpdate(textUpdate('/start', 777));

      expect(http.post.mock.calls[0][1].text).toContain('xush kelibsiz');
    });
  });

  describe('/agents', () => {
    it("bog'lanmagan hisob -> ulash so'raladi", async () => {
      const { prisma, http, agentsService } = makeMock();
      prisma.user.findUnique.mockResolvedValue(null);
      const svc = new TelegramService(http, prisma, agentsService);

      await svc.handleUpdate(textUpdate('/agents'));
      expect(http.post.mock.calls[0][1].text).toContain("bog'lanmagan");
    });

    it("bog'langan, agentlar bor -> ro'yxatni /run_ buyrug'lari bilan qaytaradi", async () => {
      const { prisma, http, agentsService } = makeMock();
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      prisma.agent.findMany.mockResolvedValue([{ id: 'abcdefgh12345', name: "Do'kon agenti" }]);
      const svc = new TelegramService(http, prisma, agentsService);

      await svc.handleUpdate(textUpdate('/agents'));
      const text = http.post.mock.calls[0][1].text;
      expect(text).toContain("Do'kon agenti");
      expect(text).toContain('/run_abcdefgh');
    });

    it("bog'langan, agent yo'q -> 'hali agentingiz yo'q'", async () => {
      const { prisma, http, agentsService } = makeMock();
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      prisma.agent.findMany.mockResolvedValue([]);
      const svc = new TelegramService(http, prisma, agentsService);

      await svc.handleUpdate(textUpdate('/agents'));
      expect(http.post.mock.calls[0][1].text).toContain("agentingiz yo'q");
    });
  });

  describe('/run_<id> <xabar>', () => {
    it("mavjud agent -> agentsService.run chaqiriladi, javob yuboriladi", async () => {
      const { prisma, http, agentsService } = makeMock();
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      prisma.agent.findFirst.mockResolvedValue({ id: 'agent-full-id' });
      agentsService.run.mockResolvedValue({ messages: [{ content: 'Bugun 12 dona sotildi' }] });
      const svc = new TelegramService(http, prisma, agentsService);

      await svc.handleUpdate(textUpdate('/run_abcdefgh bugungi savdo qanday?'));

      expect(agentsService.run).toHaveBeenCalledWith('agent-full-id', { id: 'u1' }, 'bugungi savdo qanday?');
      expect(http.post.mock.calls[0][1].text).toBe('Bugun 12 dona sotildi');
    });

    it("noma'lum agent -> 'topilmadi'", async () => {
      const { prisma, http, agentsService } = makeMock();
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      prisma.agent.findFirst.mockResolvedValue(null);
      const svc = new TelegramService(http, prisma, agentsService);

      await svc.handleUpdate(textUpdate('/run_abcdefgh savol'));
      expect(http.post.mock.calls[0][1].text).toContain('topilmadi');
      expect(agentsService.run).not.toHaveBeenCalled();
    });

    it("xabarsiz /run_ -> xabar qo'shishni so'raydi, DB'ga murojaat qilmaydi", async () => {
      const { prisma, http, agentsService } = makeMock();
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      const svc = new TelegramService(http, prisma, agentsService);

      await svc.handleUpdate(textUpdate('/run_abcdefgh'));
      expect(http.post.mock.calls[0][1].text).toContain("qo'shing");
      expect(prisma.agent.findFirst).not.toHaveBeenCalled();
    });

    it("agentsService.run xato bersa -> uzr xabari (yiqilmaydi)", async () => {
      const { prisma, http, agentsService } = makeMock();
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      prisma.agent.findFirst.mockResolvedValue({ id: 'agent-1' });
      agentsService.run.mockRejectedValue(new Error('engine xato'));
      const svc = new TelegramService(http, prisma, agentsService);

      await expect(svc.handleUpdate(textUpdate('/run_abcdefgh savol'))).resolves.toBeUndefined();
      expect(http.post.mock.calls[0][1].text).toContain('Hozir javob bera olmadim');
    });
  });

  describe("oddiy xabar (buyruqsiz)", () => {
    it("bog'lanmagan -> ulash so'raladi", async () => {
      const { prisma, http, agentsService } = makeMock();
      prisma.user.findUnique.mockResolvedValue(null);
      const svc = new TelegramService(http, prisma, agentsService);

      await svc.handleUpdate(textUpdate('Salom, yordam kerak'));
      expect(http.post.mock.calls[0][1].text).toContain("bog'lanmagan");
    });

    it("bitta agent bo'lsa -> to'g'ridan-to'g'ri unga yuboriladi", async () => {
      const { prisma, http, agentsService } = makeMock();
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      prisma.agent.findMany.mockResolvedValue([{ id: 'agent-1' }]);
      agentsService.run.mockResolvedValue({ messages: [{ content: 'Javob' }] });
      const svc = new TelegramService(http, prisma, agentsService);

      await svc.handleUpdate(textUpdate('bugungi savdo qanday?'));
      expect(agentsService.run).toHaveBeenCalledWith('agent-1', { id: 'u1' }, 'bugungi savdo qanday?');
    });

    it("bir nechta agent bo'lsa -> tanlashni so'raydi, HECH BIRIGA yubormaydi", async () => {
      const { prisma, http, agentsService } = makeMock();
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      prisma.agent.findMany.mockResolvedValue([{ id: 'agent-1' }, { id: 'agent-2' }]);
      const svc = new TelegramService(http, prisma, agentsService);

      await svc.handleUpdate(textUpdate('savol'));
      expect(agentsService.run).not.toHaveBeenCalled();
      expect(http.post.mock.calls[0][1].text).toContain('/agents');
    });

    it("agent yo'q -> 'hali agentingiz yo'q'", async () => {
      const { prisma, http, agentsService } = makeMock();
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      prisma.agent.findMany.mockResolvedValue([]);
      const svc = new TelegramService(http, prisma, agentsService);

      await svc.handleUpdate(textUpdate('savol'));
      expect(http.post.mock.calls[0][1].text).toContain("agentingiz yo'q");
    });
  });
});

describe('TelegramService.setWebhook', () => {
  const ORIGINAL_ENV = process.env;
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, TELEGRAM_BOT_TOKEN: 'bot-token' };
  });
  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('TELEGRAM_WEBHOOK_SECRET bor bo\'lsa secret_token bilan yuboradi', async () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = 'shh';
    const { prisma, http, agentsService } = makeMock();
    const svc = new TelegramService(http, prisma, agentsService);

    await svc.setWebhook('https://agentnet.app/api/telegram/webhook');

    expect(http.post).toHaveBeenCalledWith(
      expect.stringContaining('/setWebhook'),
      expect.objectContaining({ url: 'https://agentnet.app/api/telegram/webhook', secret_token: 'shh' }),
    );
  });
});
