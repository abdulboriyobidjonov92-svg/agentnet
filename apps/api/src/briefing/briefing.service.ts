import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { absTiyin, tiyinToSom } from '../common/money';
import { ConnectorsService } from '../connectors/connectors.service';
import type { User } from '@prisma/client';

export interface WeeklyStats {
  conversations: number;
  newAgents: number;
  activeAgents: number;
  spentSom: number;
}

/**
 * Proaktiv haftalik brifing (PLG retention) — foydalanuvchi SO'RAMASA HAM
 * "bu hafta shunday bo'ldi" xabari. Faqat Telegram ulangan (telegramChatId)
 * va opt-out qilmagan (briefingOptIn) foydalanuvchilarga, haftasiga bir marta.
 * Best-effort: yetkazib bo'lmasa jim o'tadi, keyingi haftada qayta uriniladi.
 */
@Injectable()
export class BriefingService {
  private readonly logger = new Logger(BriefingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly connectors: ConnectorsService,
  ) {}

  /** O'tgan 7 kunlik faoliyat — faqat DB'dan, hech qanday LLM chaqirig'i yo'q. */
  async weeklyStats(userId: string, since: Date): Promise<WeeklyStats> {
    const [conversations, newAgents, activeAgents, ledger] = await Promise.all([
      this.prisma.conversation.count({ where: { userId, updatedAt: { gte: since } } }),
      this.prisma.agent.count({ where: { userId, createdAt: { gte: since } } }),
      this.prisma.agent.count({ where: { userId, frozen: false } }),
      this.prisma.creditLedger.aggregate({
        where: { userId, createdAt: { gte: since }, amount: { lt: 0 } },
        _sum: { amount: true },
      }),
    ]);
    return {
      conversations,
      newAgents,
      activeAgents,
      // A13: `Math.abs` bigint bilan ishlamaydi — kattalikni bigint'da olamiz.
      spentSom: tiyinToSom(absTiyin(ledger._sum.amount ?? 0n)),
    };
  }

  /** 3 tilda brifing matni — foydalanuvchi tiliga qarab. */
  composeMessage(stats: WeeklyStats, language: string | null): string {
    const n = (v: number) => v.toLocaleString('ru-RU');
    if (language === 'ru') {
      return (
        `📊 Недельный брифинг — AgentNet\n\n` +
        `За неделю: ${n(stats.conversations)} бесед, ${n(stats.newAgents)} новых агентов, ` +
        `потрачено ${n(stats.spentSom)} сум.\n` +
        `Активных агентов: ${n(stats.activeAgents)}.\n\n` +
        `Подробнее: откройте панель AgentNet.`
      );
    }
    if (language === 'en') {
      return (
        `📊 Weekly briefing — AgentNet\n\n` +
        `This week: ${n(stats.conversations)} conversations, ${n(stats.newAgents)} new agents, ` +
        `${n(stats.spentSom)} som spent.\n` +
        `Active agents: ${n(stats.activeAgents)}.\n\n` +
        `Details: open your AgentNet dashboard.`
      );
    }
    return (
      `📊 Haftalik brifing — AgentNet\n\n` +
      `Bu hafta: ${n(stats.conversations)} suhbat, ${n(stats.newAgents)} yangi agent, ` +
      `${n(stats.spentSom)} so'm sarflandi.\n` +
      `Faol agentlar: ${n(stats.activeAgents)}.\n\n` +
      `Batafsil: AgentNet panelini oching.`
    );
  }

  /**
   * Yuborishga nomzodmi? Alohida metod — cron ham, test ham shu mantiqdan o'tadi.
   * lastBriefingAt < 6 kun bo'lsa qayta yubormaymiz (cron qayta ishga tushsa ham).
   */
  isEligible(user: Pick<User, 'telegramChatId' | 'briefingOptIn' | 'lastBriefingAt'>, now = new Date()): boolean {
    if (!user.telegramChatId || !user.briefingOptIn) return false;
    if (user.lastBriefingAt && now.getTime() - user.lastBriefingAt.getTime() < 6 * 86_400_000) return false;
    return true;
  }

  /** Har dushanba 09:00 — barcha nomzodlarga brifing. */
  @Cron('0 9 * * 1')
  async sendWeeklyBriefings() {
    const now = new Date();
    const since = new Date(now.getTime() - 7 * 86_400_000);
    // @system-scope: haftalik cron — BARCHA brifing-obunachi foydalanuvchini
    // topadi (funksiyaning o'z sharhi ham shuni aytadi: "barcha nomzodlarga").
    const candidates = await this.prisma.user.findMany({
      where: { telegramChatId: { not: null }, briefingOptIn: true },
    });

    let sent = 0;
    for (const user of candidates) {
      if (!this.isEligible(user, now)) continue;
      try {
        const stats = await this.weeklyStats(user.id, since);
        // Umuman faoliyat bo'lmagan haftada shovqin qilmaymiz
        if (stats.conversations === 0 && stats.newAgents === 0 && stats.spentSom === 0) continue;
        const text = this.composeMessage(stats, user.preferredLanguage);
        await this.connectors.sendViaChannel(user, 'telegram', user.telegramChatId!, text);
        await this.prisma.user.update({ where: { id: user.id }, data: { lastBriefingAt: now } });
        sent++;
      } catch (e: any) {
        // Best-effort — bitta foydalanuvchi xatosi boshqalarni to'xtatmaydi
        this.logger.warn(`Brifing yuborilmadi (${user.id}): ${e?.message}`);
      }
    }
    if (sent) this.logger.log(`Haftalik brifing: ${sent} foydalanuvchiga yuborildi`);
  }
}
