import { HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../auth/auth.service';
import { UsageService } from '../usage/usage.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { priceForAgent, usdUzsRate } from './agent-pricing';
import { Prisma, type User } from '@prisma/client';

// Agent-yaratish advisory-lock nommaydoni (foydalanuvchi bo'yicha kalit bilan
// birga ishlatiladi — bir foydalanuvchining parallel yaratishlari seriyalashadi).
const AGENT_CREATE_LOCK_NS = 4772;

// Sinov shartlari (FAQAT foydalanuvchining birinchi agenti): 3 kun YOKI 20
// xabar — qaysi biri oldin tugasa. Kod o'zgartirilmasdan sozlash uchun env.
export function trialDays(): number {
  const v = Number(process.env.TRIAL_DAYS);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 3;
}
export function trialMessageLimit(): number {
  const v = Number(process.env.TRIAL_MESSAGE_LIMIT);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 20;
}

/** Oy qo'shish — kalendar oyi asosida (28/30/31 kunlik farqlarni to'g'ri hisoblaydi). */
export function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** $transaction ichidan tashqariga balans yetmasligini signal qilish uchun. */
class InsufficientBalanceError extends Error {
  constructor(public readonly creationPriceSom: number) {
    super('insufficient_balance');
  }
}

/** Agent yaratish: narxlash, tarif chegarasi, balans yechish, sinov holati. */
export class AgentCreation {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly usage: UsageService,
  ) {}

  /**
   * `priceOverride` — FAQAT ichki, ishonchli chaqiruvchilar uchun (masalan
   * TemplatesService.install() — kuratorlik qilingan shablon katalogi narxi
   * bilan). HTTP orqali (CreateAgentDto) hech qachon kelmaydi — shu bilan
   * foydalanuvchi o'z narxini pastlatib qo'ya olmaydi.
   */
  async create(
    user: User,
    dto: CreateAgentDto,
    priceOverride?: { creationUsd: number; monthlyUsd: number },
  ) {
    // Pul bilan ishlaydigan amal — bir xil so'rov ikki marta yuborilsa
    // (masalan ikki marta bosilsa) IKKINCHI marta yechilmasligi shart.
    // Idempotency-kalit orqali oldindan tekshiramiz: agar shu kalit bilan
    // avval muvaffaqiyatli yaratilgan agent bo'lsa — o'shani qaytaramiz.
    if (dto.idempotencyKey) {
      const existing = await this.findByIdempotencyKey(dto.idempotencyKey);
      if (existing) return existing;
    }

    // Narx SERVERDA qayta hisoblanadi (mijozdan kelgan summaga ishonilmaydi).
    const fxRate = usdUzsRate();
    const price = priceOverride
      ? {
          creationSom: Math.round(priceOverride.creationUsd * fxRate),
          monthlySom: Math.round(priceOverride.monthlyUsd * fxRate),
        }
      : (() => {
          const p = priceForAgent(dto.complexity ?? 1, (dto.toolsConfig ?? []).length, fxRate);
          return { creationSom: p.creationSom, monthlySom: p.monthlySom };
        })();
    const creationPriceTiyin = price.creationSom * 100;
    const monthlyPriceTiyin = price.monthlySom * 100;

    let agent;
    try {
      agent = await this.prisma.$transaction(async (tx) => {
        // Tarif chegarasi — "tekshir-keyin-yarat" ATOMIK bo'lishi shart. Aks holda
        // ikki parallel so'rov ikkalasi ham count'ni chegaradan past ko'rib, limit+1
        // agent yaratadi. Foydalanuvchi bo'yicha advisory lock — aynan shu
        // foydalanuvchining parallel yaratishlari seriyalashadi (boshqalar bloklanmaydi).
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${AGENT_CREATE_LOCK_NS}::int, hashtext(${user.id}))`;
        await this.usage.assertCanCreateAgent(user, tx);

        if (creationPriceTiyin > 0) {
          const updated = await tx.user.updateMany({
            where: { id: user.id, balanceTiyin: { gte: creationPriceTiyin } },
            data: { balanceTiyin: { decrement: creationPriceTiyin } },
          });
          if (updated.count === 0) throw new InsufficientBalanceError(price.creationSom);
        }

        // Sinov — FAQAT foydalanuvchining ENG BIRINCHI agenti (lock ostida
        // hisoblangani uchun parallel so'rovlarda ham faqat bittasi "birinchi"
        // bo'lib chiqadi). 2-va-keyingi agentlar to'g'ridan-to'g'ri oddiy oylik
        // rejimga o'tadi (foydalanuvchi allaqachon qiymatni ko'rgan).
        const existingCount = await tx.agent.count({ where: { userId: user.id } });
        const isFirstAgent = existingCount === 0;

        const now = new Date();
        const created = await tx.agent.create({
          data: {
            name: dto.name,
            systemPrompt: dto.systemPrompt,
            model: dto.model ?? 'claude-sonnet-4-6',
            halalFilterEnabled: dto.halalFilterEnabled ?? true,
            memoryEnabled: dto.memoryEnabled ?? true,
            toolsConfig: (dto.toolsConfig ?? []) as object,
            vertical: dto.vertical ?? null,
            description: dto.description ?? null,
            templateId: dto.templateId ?? null,
            userId: user.id,
            creationPriceTiyin,
            monthlyPriceTiyin,
            isTrialAgent: isFirstAgent && monthlyPriceTiyin > 0,
            trialStartedAt: isFirstAgent && monthlyPriceTiyin > 0 ? now : null,
            nextChargeAt:
              monthlyPriceTiyin > 0
                ? isFirstAgent
                  ? addDays(now, trialDays())
                  : addMonths(now, 1)
                : null,
          },
        });

        if (creationPriceTiyin > 0 || dto.idempotencyKey) {
          const fresh = await tx.user.findUniqueOrThrow({ where: { id: user.id }, select: { balanceTiyin: true } });
          await tx.creditLedger.create({
            data: {
              userId: user.id,
              kind: 'agent_creation',
              amount: -creationPriceTiyin,
              balanceAfter: fresh.balanceTiyin,
              meta: { agentId: created.id, creationPriceSom: price.creationSom, monthlyPriceSom: price.monthlySom },
              idempotencyKey: dto.idempotencyKey ?? undefined,
            },
          });
        }

        return created;
      });
    } catch (e: any) {
      if (e instanceof InsufficientBalanceError) {
        throw new HttpException(
          {
            message: `Balansingiz yetarli emas. Agent yaratish narxi: ${e.creationPriceSom.toLocaleString('ru-RU')} so'm. Hisobingizni to'ldiring.`,
            reason: 'insufficient_balance',
            creationPriceSom: e.creationPriceSom,
          },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
      // Parallel so'rov bir xil idempotency-kalit bilan g'olib keldi — o'sha natijani qaytaramiz
      if (dto.idempotencyKey && e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const winner = await this.findByIdempotencyKey(dto.idempotencyKey);
        if (winner) return winner;
      }
      throw e;
    }

    await this.audit.record({
      actorId: user.id,
      action: 'agent.create',
      resourceType: 'agent',
      resourceId: agent.id,
      metadata: { creationPriceTiyin, monthlyPriceTiyin },
    });
    return agent;
  }

  private async findByIdempotencyKey(idempotencyKey: string) {
    const ledger = await this.prisma.creditLedger.findUnique({ where: { idempotencyKey } });
    const agentId = (ledger?.meta as any)?.agentId;
    if (!agentId) return null;
    return this.prisma.agent.findUnique({ where: { id: agentId } });
  }
}
