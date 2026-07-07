import {
  Injectable,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma, User } from '@prisma/client';

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

export interface PlanLimits {
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

  /**
   * Foydalanuvchining amaldagi tarifi — pro muddati (`proUntil`) o'tgan
   * bo'lsa limitlar avtomatik free'ga qaytadi (soxta pro yo'q).
   */
  effectivePlan(user: User): string {
    if (user.plan === 'pro' && user.proUntil && user.proUntil.getTime() < Date.now()) {
      return 'free';
    }
    return user.plan;
  }

  /** Pricing sahifasi uchun tariflar katalogi (env'dagi haqiqiy limitlar). */
  limitsCatalog(): Record<string, PlanLimits> {
    return { free: this.planLimits('free'), pro: this.planLimits('pro') };
  }

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

  /**
   * Atomik oshirish — yangi (oshirilgandan keyingi) qiymatni qaytaradi.
   * Postgres'da bu `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` ga aylanadi:
   * `count = count + 1` bitta atomik operatsiya, poyga (race) yo'q.
   */
  private async bumpReturning(userId: string, kind: string, day: string): Promise<number> {
    const row = await this.prisma.usageCounter.upsert({
      where: { userId_day_kind: { userId, day, kind } },
      create: { userId, day, kind, count: 1 },
      update: { count: { increment: 1 } },
    });
    return row.count;
  }

  /** Kompensatsiya: limitdan oshib ketgan (rad etilgan) so'rov uchun hisobni qaytaradi. */
  private async decrement(userId: string, kind: string, day: string): Promise<void> {
    await this.prisma.usageCounter.updateMany({
      where: { userId, day, kind },
      data: { count: { decrement: 1 } },
    });
  }

  /**
   * Chat/LLM so'rovini tekshiradi va hisobga oladi.
   * Limit oshsa 429 (Too Many Requests) tashlaydi — chaqiruvchi LLM'ga o'tmaydi.
   */
  async consumeChat(user: User): Promise<{ remaining: number; plan: string }> {
    const day = this.today();
    const limits = this.planLimits(this.effectivePlan(user));

    // Naqsh: ATOMIK oshir → natijani tekshir → oshib ketgan bo'lsa qaytar.
    // Avvalgi "o'qi-keyin-oshir" da ikki parallel so'rov bir xil qiymatni o'qib,
    // ikkalasi ham limitdan o'tib ketardi (limit chetlab o'tiladi, pul yo'qoladi).
    // Endi har so'rov O'ZINING oshirilgandan keyingi qiymatini tekshiradi —
    // aynan bittasi o'tadi, poyga yo'q.

    // 1) Global himoya — platforma kunlik LLM chegarasi
    const globalAfter = await this.bumpReturning(GLOBAL_KEY, 'llm', day);
    if (globalAfter > this.globalCap) {
      await this.decrement(GLOBAL_KEY, 'llm', day); // slotni bo'shatamiz
      this.logger.error(
        `GLOBAL LLM cap reached: ${this.globalCap}/${this.globalCap} (${day}) — barcha so'rovlar to'xtatildi`,
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
    // 2) Per-user kunlik chat limiti
    const userAfter = await this.bumpReturning(user.id, 'chat', day);
    if (userAfter > limits.chatPerDay) {
      // Bu so'rov rad etildi — ikkala hisobni ham qaytaramiz
      await this.decrement(user.id, 'chat', day);
      await this.decrement(GLOBAL_KEY, 'llm', day);
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

    // So'rov qabul qilindi — global ogohlantirish chegarasini faqat shu yerda
    // tekshiramiz (rad etilgan so'rov global slotni band qilmagani uchun).
    if (globalAfter >= this.globalAlertAt) {
      this.logger.warn(
        `GLOBAL LLM usage ${globalAfter}/${this.globalCap} (${day}) — ogohlantirish chegarasidan o'tdi`,
      );
    }

    return { remaining: Math.max(0, limits.chatPerDay - userAfter), plan: user.plan };
  }

  /**
   * Agent yaratishdan oldin tarif chegarasini tekshiradi.
   * `client` — ixtiyoriy tranzaksiya-klienti: agent yaratish bilan bitta
   * atomik tranzaksiyada (advisory lock ostida) chaqirilsa, "tekshir-keyin-yarat"
   * poygasi yo'qoladi (parallel so'rovlar chegaradan oshib keta olmaydi).
   */
  async assertCanCreateAgent(
    user: User,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    const limits = this.planLimits(this.effectivePlan(user));
    const count = await client.agent.count({ where: { userId: user.id } });
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
    const plan = this.effectivePlan(user);
    const limits = this.planLimits(plan);
    const [chatUsed, agentCount, globalCount] = await Promise.all([
      this.read(user.id, 'chat', day),
      this.prisma.agent.count({ where: { userId: user.id } }),
      this.read(GLOBAL_KEY, 'llm', day),
    ]);
    return {
      plan,
      proUntil: plan === 'pro' ? user.proUntil : null,
      chat: { used: chatUsed, limit: limits.chatPerDay, remaining: Math.max(0, limits.chatPerDay - chatUsed) },
      agents: { used: agentCount, limit: limits.agentsMax, remaining: Math.max(0, limits.agentsMax - agentCount) },
      global: { used: globalCount, cap: this.globalCap },
    };
  }
}
