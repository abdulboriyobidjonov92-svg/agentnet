import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { AgentsService } from '../agents/agents.service';
import { signToken, verifyToken } from '../auth/token.util';
import type { User } from '@prisma/client';

const LINK_CODE_TTL_SECONDS = 10 * 60; // 10 daqiqa

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private readonly token = process.env.TELEGRAM_BOT_TOKEN ?? '';
  private readonly apiBase = `https://api.telegram.org/bot${this.token}`;

  constructor(
    private readonly http: HttpService,
    private readonly prisma: PrismaService,
    private readonly agentsService: AgentsService,
  ) {}

  async onModuleInit() {
    if (!this.token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN o\'rnatilmagan — Telegram bot faolsiz');
      return;
    }
    // Webhook URL ni o'rnatish (APP_URL env orqali)
    const webhookUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (webhookUrl) {
      await this.setWebhook(`${webhookUrl}/api/telegram/webhook`).catch(() => null);
    }
  }

  async sendMessage(chatId: string | number, text: string) {
    if (!this.token) return;
    await firstValueFrom(
      this.http.post(`${this.apiBase}/sendMessage`, {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    ).catch((e) => this.logger.error('Telegram sendMessage xato:', e.message));
  }

  /**
   * Hisobni Telegram bilan bog'lash uchun bir martalik havola.
   * Mavjud JWT infratuzilmasi (token.util.ts) qayta ishlatiladi — 10 daqiqalik
   * qisqa muddatli token, yangi jadval/migratsiya shart emas.
   */
  generateLinkCode(user: User) {
    const code = signToken({ sub: user.id }, LINK_CODE_TTL_SECONDS);
    const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? '';
    return {
      url: botUsername ? `https://t.me/${botUsername}?start=${code}` : null,
      code,
      expiresInSeconds: LINK_CODE_TTL_SECONDS,
    };
  }

  private async findUserByChatId(chatId: string | number) {
    return this.prisma.user.findUnique({ where: { telegramChatId: String(chatId) } });
  }

  async handleUpdate(update: any) {
    const message = update.message ?? update.edited_message;
    if (!message?.text) return;

    const chatId = message.chat.id;
    const text: string = message.text.trim();

    // /start <token> — hisobni bog'lash; /start (bo'shsiz) — oddiy salomlashuv
    if (text.startsWith('/start')) {
      const payload = text.slice('/start'.length).trim();
      if (payload) {
        const decoded = verifyToken(payload);
        if (!decoded) {
          await this.sendMessage(chatId,
            "⚠️ Havola muddati tugagan yoki yaroqsiz. AgentNet saytida Sozlamalar → Integratsiyalar bo'limidan yangi havola oling.");
          return;
        }
        await this.prisma.user.update({
          where: { id: decoded.sub },
          data: { telegramChatId: String(chatId) },
        });
        await this.sendMessage(chatId,
          '✅ Hisobingiz ulandi! Endi agentlaringiz bilan shu yerdan gaplashishingiz mumkin.\n\n' +
          'Ro\'yxat: /agents');
        return;
      }
      await this.sendMessage(chatId,
        '🤖 <b>AgentNet</b> botiga xush kelibsiz!\n\n' +
        "Hisobingizni bog'lash uchun AgentNet saytida Sozlamalar → Integratsiyalar bo'limiga o'ting.\n" +
        'Ulangandan so\'ng: /agents'
      );
      return;
    }

    // /agents komandasi — chatId bo'yicha to'g'ridan-to'g'ri qidiruv
    if (text.startsWith('/agents')) {
      const user = await this.findUserByChatId(chatId);
      if (!user) {
        await this.sendMessage(chatId, "Hisobingiz hali bog'lanmagan. AgentNet saytida Sozlamalar → Integratsiyalar bo'limidan ulang.");
        return;
      }
      const agents = await this.prisma.agent.findMany({
        where: { userId: user.id },
        select: { id: true, name: true },
        take: 10,
      });
      if (!agents.length) {
        await this.sendMessage(chatId, "Hali agentingiz yo'q — agentnet.app da birinchisini yarating.");
        return;
      }
      const list = agents.map((a) => `<b>${a.name}</b> — /run_${a.id.slice(0, 8)} &lt;xabar&gt;`).join('\n');
      await this.sendMessage(chatId, `Sizning agentlaringiz:\n${list}`);
      return;
    }

    const user = await this.findUserByChatId(chatId);
    if (!user) {
      await this.sendMessage(chatId, "Hisobingiz hali bog'lanmagan. AgentNet saytida Sozlamalar → Integratsiyalar bo'limidan ulang.");
      return;
    }

    // /run_<shortId> <xabar> — aniq agentni tanlab ishga tushirish
    const runMatch = text.match(/^\/run_(\w{6,10})\s+([\s\S]+)$/);
    if (runMatch) {
      const [, shortId, agentMessage] = runMatch;
      const agent = await this.prisma.agent.findFirst({
        where: { userId: user.id, id: { startsWith: shortId } },
      });
      if (!agent) {
        await this.sendMessage(chatId, "Bunday agent topilmadi. Ro'yxat uchun: /agents");
        return;
      }
      await this.runAndReply(chatId, agent.id, user, agentMessage);
      return;
    }
    if (text.startsWith('/run_')) {
      await this.sendMessage(chatId, "Xabaringizni ham qo'shing, masalan: /run_ab12cd34 bugungi savdo qanday?");
      return;
    }

    // Oddiy xabar — faqat bitta agent bo'lsa, to'g'ridan-to'g'ri unga yuboriladi
    const agents = await this.prisma.agent.findMany({ where: { userId: user.id }, select: { id: true } });
    if (agents.length === 0) {
      await this.sendMessage(chatId, "Hali agentingiz yo'q — agentnet.app da birinchisini yarating.");
      return;
    }
    if (agents.length > 1) {
      await this.sendMessage(chatId, "Sizda bir nechta agent bor — qaysi biriga yozishni /agents orqali tanlang.");
      return;
    }
    await this.runAndReply(chatId, agents[0].id, user, text);
  }

  private async runAndReply(chatId: string | number, agentId: string, user: User, message: string) {
    try {
      const result = await this.agentsService.run(agentId, user, message);
      const reply = result.messages?.at(-1)?.content;
      await this.sendMessage(chatId, reply || "Javob olinmadi — birozdan keyin qayta urinib ko'ring.");
    } catch {
      await this.sendMessage(chatId, "⚠️ Hozir javob bera olmadim — birozdan keyin qayta urinib ko'ring.");
    }
  }

  async setWebhook(url: string) {
    // Webhook maxfiy-tokeni: o'rnatilgan bo'lsa Telegram'ga ham beramiz — shunda
    // Telegram har so'rovda `X-Telegram-Bot-Api-Secret-Token` sarlavhasini
    // yuboradi va controller uni tekshiradi (soxta update'lar rad etiladi).
    // Bo'lmasa — ilgarigidek (ochiq webhook). MUHIM: token'siz setWebhook +
    // controller-tekshiruv bir-biriga zid bo'lardi (barcha real update 401).
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!secret) {
      this.logger.warn(
        'TELEGRAM_WEBHOOK_SECRET o\'rnatilmagan — webhook autentifikatsiyasiz (ishlab chiqarishda o\'rnating).',
      );
    }
    await firstValueFrom(
      this.http.post(`${this.apiBase}/setWebhook`, {
        url,
        ...(secret ? { secret_token: secret } : {}),
      }),
    );
    this.logger.log(`Telegram webhook o'rnatildi: ${url}${secret ? ' (secret bilan)' : ''}`);
  }
}
