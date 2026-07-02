import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { AgentsService } from '../agents/agents.service';

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

  async handleUpdate(update: any) {
    const message = update.message ?? update.edited_message;
    if (!message?.text) return;

    const chatId = message.chat.id;
    const text: string = message.text;

    // /start komandasi
    if (text.startsWith('/start')) {
      await this.sendMessage(chatId,
        '🤖 <b>AgentNet (Baraka AI)</b> botiga xush kelibsiz!\n\n' +
        'Mavjud agentlaringizdan birini tanlang: /agents\n' +
        'Yordam: /help'
      );
      return;
    }

    // /agents komandasi
    if (text.startsWith('/agents')) {
      const chatIdStr = String(chatId);
      // chatId bo'yicha foydalanuvchini topish
      const user = await this.prisma.user.findFirst({
        where: { twoFactorSecret: { not: null } }, // placeholder — haqiqiyda telegramChatId field kerak
      });
      if (!user) {
        await this.sendMessage(chatId, 'Avval agentnet.app da hisobingizni Telegram bilan bog\'lang.');
        return;
      }
      const agents = await this.prisma.agent.findMany({
        where: { userId: user.id },
        select: { id: true, name: true },
        take: 10,
      });
      const list = agents.map((a, i) => `${i + 1}. <b>${a.name}</b> — /run_${a.id.slice(0, 8)}`).join('\n');
      await this.sendMessage(chatId, `Sizning agentlaringiz:\n${list}`);
      return;
    }

    // Oddiy xabar — default agent orqali
    await this.sendMessage(chatId, '⏳ Ishlanmoqda...');
    // Haqiqiy implementatsiyada: foydalanuvchi tanlagan agentni run qilish
    await this.sendMessage(chatId, 'Agent ulash uchun /start yozing va agentnet.app saytida Telegram integratsiyasini yoqing.');
  }

  async setWebhook(url: string) {
    await firstValueFrom(
      this.http.post(`${this.apiBase}/setWebhook`, { url }),
    );
    this.logger.log(`Telegram webhook o'rnatildi: ${url}`);
  }
}
