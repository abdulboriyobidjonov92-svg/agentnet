import {
  Injectable,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { User } from '@prisma/client';

/**
 * Foydalanish limitlari va xarajat himoyasi.
 *
 * Ikki qatlam:
 *   1. Per-user kunlik limit (tarifga qarab: free / pro) — bitta foydalanuvchi
 *      kuniga necha marta LLM chaqira oladi va necha agent yarata oladi.
 *   2. Global kunlik LLM chegarasi ("_global" hisoblagich) — ko'p akkaunt ochib
 *      limitni chetlab o'tishga qarshi so'nggi himoya. Chegaraga yetganda
 *      hamma uchun to'xtaydi (kutilmagan katta hisobning oldini oladi).
 *
 * Hisoblagichlar UsageCounter jadvalida kunlik (UTC) saqlanadi.
 * Barcha limitlar env orqali sozlanadi — kod o'zgartirilmaydi.
 */

const GLOBAL_KEY = '_global';

interface PlanLimits {
  chatPerDay: number;
  agentsMax: number;
}

function intEnv(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

@Injectable()
export class UsageService {
  private readonly logger = new Logger('UsageService');

  constructor(private readonly prisma: PrismaService) {}

  private planLimits(plan: string): PlanLimits {
    if (plan === 'pro') {
      return {
        chatPerDay: intEnv('USAGE_PRO_CHAT_PER_DAY', 500),
        agentsMax: intEnv('USAGE_PRO_AGENTS_MAX', 100),
      };
    }
    // free (default)
    return {
      chatPerDay: intEnv('USAGE_FREE_CHAT_PER_DAY', 20),
      agentsMax: intEnv('USAGE_FREE_AGENTS_MAX', 5),
    };
  }

  private get globalCap(): number {
    return intEnv('USAGE_GLOBAL_LLM_PER_DAY', 2000);
  }

  private get globalAlertAt(): number {
    // Ogohlantirish chegarasi (default 80%)
    return intEnv('USAGE_GLOBAL_LLM_ALERT', Math.floor(this.globalCap * 0.8));
  }

  /** Bugungi UTC sanasi "YYYY-MM-DD". */
  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private async read(userId: string, kind: string, day: string): Promise<number> {
    const row = await this.prisma.usageCounter.findUnique({
      where: { userId_day_kind: { userId, day, kind } },
    });
    return row?.count ?? 0;
  }

  private async bump(userId: string, kind: string, day: string): Promise<void> {
    await this.prisma.usageCounter.upsert({
      where: { userId_day_kind: { userId, day, kind } },
      create: { userId, day, kind, count: 1 },
      update: { count: { increment: 1 } },
    });
  }

  /**
   * Chat/LLM so'rovini tekshiradi va hisobga oladi.
   * Limit oshsa 429 (Too Many Requests) tashlaydi — chaqiruvchi LLM'ga o'tmaydi.
   */
  async consumeChat(user: User): Promise<{ remaining: number; plan: string }> {
    const day = this.today();
    const limits = this.planLimits(user.plan);

    // 1) Global himoya — platforma kunlik LLM chegarasi
    const globalCount = await this.read(GLOBAL_KEY, 'llm', day);
    if (globalCount >= this.globalCap) {
      this.logger.error(
        `GLOBAL LLM cap reached: ${globalCount}/${this.globalCap} (${day}) — barcha so'rovlar to'xtatildi`,
      );
      throw new HttpException(
        {
          message:
            'Platforma bugungi umumiy limitiga yetdi. Iltimos, ertaga qayta urinib ko\'ring.',
          reason: 'global_daily_cap',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (globalCount + 1 >= this.globalAlertAt) {
      this.logger.warn(
        `GLOBAL LLM usage ${globalCount + 1}/${this.globalCap} (${day}) — ogohlantirish chegarasidan o'tdi`,
      );
    }

    // 2) Per-user kunlik chat limiti
    const userCount = await this.read(user.id, 'chat', day);
    if (userCount >= limits.chatPerDay) {
      throw new HttpException(
        {
          message: `Kunlik xabar limitiga yetdingiz (${limits.chatPerDay}/kun). Ertaga yangilanadi.`,
          reason: 'user_daily_cap',
          plan: user.plan,
          limit: limits.chatPerDay,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 3) Ikkala hisoblagichni oshiramiz (so'rov ruxsat etildi)
    await this.bump(user.id, 'chat', day);
    await this.bump(GLOBAL_KEY, 'llm', day);

    return { remaining: limits.chatPerDay - userCount - 1, plan: user.plan };
  }

  /** Agent yaratishdan oldin tarif chegarasini tekshiradi. */
  async assertCanCreateAgent(user: User): Promise<void> {
    const limits = this.planLimits(user.plan);
    const count = await this.prisma.agent.count({ where: { userId: user.id } });
    if (count >= limits.agentsMax) {
      throw new ForbiddenException({
        message: `Agent yaratish chegarasiga yetdingiz (${limits.agentsMax} ta). Ko'proq uchun tarifni yangilang.`,
        reason: 'agent_limit',
        plan: user.plan,
        limit: limits.agentsMax,
      });
    }
  }

  /** UI uchun joriy holat — qolgan kvota. */
  async status(user: User) {
    const day = this.today();
    const limits = this.planLimits(user.plan);
    const [chatUsed, agentCount, globalCount] = await Promise.all([
      this.read(user.id, 'chat', day),
      this.prisma.agent.count({ where: { userId: user.id } }),
      this.read(GLOBAL_KEY, 'llm', day),
    ]);
    return {
      plan: user.plan,
      chat: { used: chatUsed, limit: limits.chatPerDay, remaining: Math.max(0, limits.chatPerDay - chatUsed) },
      agents: { used: agentCount, limit: limits.agentsMax, remaining: Math.max(0, limits.agentsMax - agentCount) },
      global: { used: globalCount, cap: this.globalCap },
    };
  }
}
