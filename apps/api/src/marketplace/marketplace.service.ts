import { Injectable, NotFoundException, ForbiddenException, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../auth/auth.service';
import { addMonths } from '../agents/agents.service';
import type { User } from '@prisma/client';

/**
 * S8: Marketplace — haqiqiy bozor dinamikasi (statik katalog emas).
 *   - Reyting/leaderboard: haqiqiy foydalanish + baholar asosida score
 *   - "Tasdiqlangan" (verified) belgisi: ishonchlilik chegarasidan o'tganlar
 *   - Daromad taqsimoti: har pulli o'rnatish 70/30 (kreator/platforma)
 *     CreatorLedger'da haqiqiy buxgalteriya bilan; payout stub (to'lov
 *     protsessingi ulanmagan), hisob-kitob mantig'i haqiqiy.
 *   - Y5: "yaratuvchi bonusi" — CreatorLedger'dan ALOHIDA, HAQIQIY balans
 *     krediti: yangi xaridorning birinchi to'lovida creation_price'ning
 *     yarmi original yaratuvchiga bir martalik bonus (Payout jadvali,
 *     @@unique([agentId, buyerId]) — hech qachon qayta berilmaydi).
 */

// Sifat chegarasi — verified belgisi shartlari
const VERIFIED_MIN_USAGE = 10;
const VERIFIED_MIN_SUCCESS_RATE = 0.9;
const CREATOR_SHARE = 0.7; // 70% kreator, 30% platforma
const CREATOR_BONUS_SHARE = 0.5; // creation_price'ning yarmi — bir martalik bonus

const MARKETPLACE_INSTALL_LOCK_NS = 4774;

/** $transaction ichidan tashqariga balans yetmasligini signal qilish uchun. */
class InsufficientBalanceError extends Error {
  constructor(public readonly priceSom: number) {
    super('insufficient_balance');
  }
}

@Injectable()
export class MarketplaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  // ---- Katalog: usage-asosidagi reyting bilan ----

  async listPublished(search?: string) {
    const agents = await this.prisma.agent.findMany({
      where: {
        isPublished: true,
        ...(search && { name: { contains: search, mode: 'insensitive' } }),
      },
      select: {
        id: true, name: true, description: true, model: true, vertical: true,
        halalFilterEnabled: true, marketplacePrice: true, createdAt: true,
        toolsConfig: true,
        installCount: true, usageCount: true, successCount: true, failCount: true,
        ratingAvg: true, ratingCount: true, verified: true,
        user: { select: { email: true } },
      },
    });

    return agents
      .map((a) => ({ ...a, score: this.score(a) }))
      .sort((x, y) => y.score - x.score)
      .map((a, i) => ({ ...a, rank: i + 1 }));
  }

  /** Bozor balli: haqiqiy foydalanish + o'rnatishlar + baholar. */
  private score(a: { usageCount: number; installCount: number; ratingAvg: number | null; ratingCount: number; verified: boolean }) {
    return (
      a.usageCount +
      a.installCount * 5 +
      (a.ratingAvg ?? 0) * a.ratingCount * 2 +
      (a.verified ? 25 : 0)
    );
  }

  // ---- Nashr qilish ----

  /**
   * Nashr qilish / "shablonga aylantirish" — is_marketplace_listed=true
   * (mavjud isPublished bayrog'i shu ma'noni bajaradi). `price`/`monthlyPrice`
   * berilmasa — agentning O'ZINING allaqachon to'langan narxi SAQLANIB
   * QOLADI (Y4, creationPriceTiyin/monthlyPriceTiyin — qayta kiritish shart
   * emas). originalCreatorId egasiga aniq belgilanadi (keyingi atributsiya uchun).
   */
  async publish(agentId: string, user: User, price?: number, description?: string, monthlyPrice?: number) {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Agent topilmadi');
    if (agent.userId !== user.id) throw new ForbiddenException();

    const creationPriceTiyin = price !== undefined ? Math.max(0, Math.round(price)) : agent.creationPriceTiyin;
    const monthlyPriceTiyin = monthlyPrice !== undefined ? Math.max(0, Math.round(monthlyPrice)) : agent.monthlyPriceTiyin;

    const updated = await this.prisma.agent.update({
      where: { id: agentId },
      data: {
        isPublished: true,
        marketplacePrice: creationPriceTiyin,
        creationPriceTiyin,
        monthlyPriceTiyin,
        originalCreatorId: agent.userId,
        ...(description !== undefined && { description }),
      },
    });
    await this.audit.record({ actorId: user.id, action: 'marketplace.publish', resourceType: 'agent', resourceId: agentId });
    return updated;
  }

  async unpublish(agentId: string, user: User) {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException();
    if (agent.userId !== user.id) throw new ForbiddenException();
    return this.prisma.agent.update({ where: { id: agentId }, data: { isPublished: false } });
  }

  // ---- O'rnatish: HAQIQIY to'lov + daromad taqsimoti + yaratuvchi bonusi ----

  async install(publishedAgentId: string, user: User) {
    const source = await this.prisma.agent.findUnique({ where: { id: publishedAgentId } });
    if (!source || !source.isPublished) throw new NotFoundException('Marketplace agenti topilmadi');

    const price = source.marketplacePrice ?? 0;
    const isSelfInstall = source.userId === user.id;

    let installed;
    try {
      installed = await this.prisma.$transaction(async (tx) => {
        // O'ziga tegishli bo'lmagan pullik o'rnatish — balans ATOMIK tekshiriladi
        // (agents.service.ts create()'dagi bilan bir xil naqsh).
        if (price > 0 && !isSelfInstall) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(${MARKETPLACE_INSTALL_LOCK_NS}::int, hashtext(${user.id}))`;
          const updated = await tx.user.updateMany({
            where: { id: user.id, balanceTiyin: { gte: price } },
            data: { balanceTiyin: { decrement: price } },
          });
          if (updated.count === 0) throw new InsufficientBalanceError(Math.round(price / 100));

          const fresh = await tx.user.findUniqueOrThrow({ where: { id: user.id }, select: { balanceTiyin: true } });
          await tx.creditLedger.create({
            data: {
              userId: user.id,
              kind: 'marketplace_install',
              amount: -price,
              balanceAfter: fresh.balanceTiyin,
              meta: { sourceAgentId: source.id },
            },
          });
        }

        const now = new Date();
        const newInstalled = await tx.agent.create({
          data: {
            name: `${source.name} (o'rnatildi)`,
            systemPrompt: source.systemPrompt,
            model: source.model,
            halalFilterEnabled: source.halalFilterEnabled,
            memoryEnabled: source.memoryEnabled,
            toolsConfig: source.toolsConfig as any,
            vertical: source.vertical,
            description: source.description,
            sourceAgentId: source.id,
            originalCreatorId: source.userId,
            userId: user.id,
            isPublished: false,
            creationPriceTiyin: source.creationPriceTiyin,
            monthlyPriceTiyin: source.monthlyPriceTiyin,
            nextChargeAt: source.monthlyPriceTiyin > 0 ? addMonths(now, 1) : null,
          },
        });

        const install = await tx.agentInstall.create({
          data: {
            sourceAgentId: source.id,
            installedAgentId: newInstalled.id,
            userId: user.id,
            pricePaid: price,
          },
        });

        await tx.agent.update({
          where: { id: source.id },
          data: { installCount: { increment: 1 } },
        });

        // Daromad taqsimoti (mavjud, o'zgarmagan) — haqiqiy buxgalteriya, CreatorLedger
        if (price > 0 && !isSelfInstall) {
          const creatorShare = Math.round(price * CREATOR_SHARE);
          await tx.creatorLedger.create({
            data: {
              creatorId: source.userId,
              agentId: source.id,
              kind: 'install_revenue',
              amount: creatorShare,
              meta: {
                installId: install.id,
                grossAmount: price,
                platformShare: price - creatorShare,
                note: 'Payment processing stubbed — accounting entry is real.',
              },
            },
          });
        }

        // Y5: yaratuvchi bonusi — creation_price'ning yarmi, HAQIQIY balansga,
        // FAQAT shu xaridorning shu manba agent uchun BIRINCHI to'lovida.
        // Oldindan tekshiruv (find-then-create): agar shu buyer shu agent uchun
        // avval ham bonus keltirgan bo'lsa (masalan qayta o'rnatish yoki keyingi
        // oylik to'lov — bu FAQAT shu blokda, chargeOne'da esa umuman yo'q),
        // QAYTA berilmaydi. @@unique([agentId, buyerId]) buni DB darajasida ham
        // kafolatlaydi (interaktiv tranzaksiya ichida unique-xatoni "tutib"
        // davom ettirib bo'lmaydi — Postgres tranzaksiyani abort qiladi —
        // shuning uchun bu yerda oldindan tekshiruv bilan oldini olamiz).
        if (price > 0 && !isSelfInstall) {
          const bonus = Math.round(price * CREATOR_BONUS_SHARE);
          const alreadyBonused = bonus > 0
            ? await tx.payout.findUnique({ where: { agentId_buyerId: { agentId: source.id, buyerId: user.id } } })
            : { id: 'n/a' };
          if (bonus > 0 && !alreadyBonused) {
            await tx.payout.create({
              data: {
                agentId: source.id,
                originalCreatorId: source.userId,
                buyerId: user.id,
                bonusAmountTiyin: bonus,
              },
            });
            const creatorFresh = await tx.user.update({
              where: { id: source.userId },
              data: { balanceTiyin: { increment: bonus } },
              select: { balanceTiyin: true },
            });
            await tx.creditLedger.create({
              data: {
                userId: source.userId,
                kind: 'creator_bonus',
                amount: bonus,
                balanceAfter: creatorFresh.balanceTiyin,
                meta: { sourceAgentId: source.id, buyerId: user.id },
              },
            });
          }
        }

        return newInstalled;
      });
    } catch (e: any) {
      if (e instanceof InsufficientBalanceError) {
        throw new HttpException(
          {
            message: `Balansingiz yetarli emas. Agent narxi: ${e.priceSom.toLocaleString('ru-RU')} so'm. Hisobingizni to'ldiring.`,
            reason: 'insufficient_balance',
            priceSom: e.priceSom,
          },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
      throw e;
    }

    await this.audit.record({
      actorId: user.id, action: 'marketplace.install', resourceType: 'agent', resourceId: publishedAgentId,
      metadata: { installedId: installed.id, pricePaid: price },
    });
    return installed;
  }

  // ---- Baholar (haqiqiy foydalanuvchilardan) ----

  async review(publishedAgentId: string, user: User, rating: number, comment?: string) {
    const source = await this.prisma.agent.findUnique({ where: { id: publishedAgentId } });
    if (!source || !source.isPublished) throw new NotFoundException('Marketplace agenti topilmadi');

    const r = Math.round(Number(rating));
    if (!(r >= 1 && r <= 5)) throw new BadRequestException('rating 1-5 oralig\'ida bo\'lishi kerak');

    // Faqat haqiqatan o'rnatganlar baholaydi — reyting soxtalanmasin
    const hasInstall = await this.prisma.agentInstall.findFirst({
      where: { sourceAgentId: publishedAgentId, userId: user.id },
    });
    if (!hasInstall) throw new ForbiddenException("Baholash uchun avval agentni o'rnating");

    await this.prisma.agentReview.upsert({
      where: { agentId_userId: { agentId: publishedAgentId, userId: user.id } },
      create: { agentId: publishedAgentId, userId: user.id, rating: r, comment: comment ?? null },
      update: { rating: r, comment: comment ?? null },
    });

    const agg = await this.prisma.agentReview.aggregate({
      where: { agentId: publishedAgentId },
      _avg: { rating: true },
      _count: true,
    });
    await this.prisma.agent.update({
      where: { id: publishedAgentId },
      data: { ratingAvg: agg._avg.rating, ratingCount: agg._count },
    });
    await this.recomputeVerified(publishedAgentId);

    return { rating: r, ratingAvg: agg._avg.rating, ratingCount: agg._count };
  }

  async reviews(publishedAgentId: string) {
    return this.prisma.agentReview.findMany({
      where: { agentId: publishedAgentId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { rating: true, comment: true, createdAt: true, user: { select: { email: true } } },
    });
  }

  // ---- Foydalanish hodisalari (reyting + verified uchun xom signal) ----

  /**
   * O'rnatilgan agent har ishlaganda chaqiriladi (conversations hook).
   * Muvaffaqiyat/mag'lubiyat — verified belgisining asosi.
   */
  async recordUsage(sourceAgentId: string, success: boolean) {
    const exists = await this.prisma.agent.findUnique({ where: { id: sourceAgentId }, select: { id: true } });
    if (!exists) return;
    await this.prisma.agent.update({
      where: { id: sourceAgentId },
      data: {
        usageCount: { increment: 1 },
        ...(success ? { successCount: { increment: 1 } } : { failCount: { increment: 1 } }),
      },
    });
    await this.recomputeVerified(sourceAgentId);
  }

  private async recomputeVerified(agentId: string) {
    const a = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: { usageCount: true, successCount: true, failCount: true, verified: true },
    });
    if (!a) return;
    const total = a.successCount + a.failCount;
    const successRate = total > 0 ? a.successCount / total : 0;
    const verified = a.usageCount >= VERIFIED_MIN_USAGE && successRate >= VERIFIED_MIN_SUCCESS_RATE;
    if (verified !== a.verified) {
      await this.prisma.agent.update({ where: { id: agentId }, data: { verified } });
    }
  }

  // ---- Kreator kabineti: daromad va payout ----

  async creatorDashboard(user: User) {
    const [agents, ledger, bonusPayouts] = await Promise.all([
      this.prisma.agent.findMany({
        where: { userId: user.id, isPublished: true },
        select: {
          id: true, name: true, marketplacePrice: true,
          installCount: true, usageCount: true, ratingAvg: true, ratingCount: true, verified: true,
        },
      }),
      this.prisma.creatorLedger.findMany({
        where: { creatorId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      // Y5: yaratuvchi bonusi — CreatorLedger'dan ALOHIDA, HAQIQIY balansga
      // tushgan bir martalik bonuslar (har xaridor uchun ko'pi bilan bitta).
      this.prisma.payout.findMany({
        where: { originalCreatorId: user.id },
        orderBy: { paidAt: 'desc' },
        take: 50,
      }),
    ]);

    const balance = await this.prisma.creatorLedger.aggregate({
      where: { creatorId: user.id },
      _sum: { amount: true },
    });
    const bonusTotal = await this.prisma.payout.aggregate({
      where: { originalCreatorId: user.id },
      _sum: { bonusAmountTiyin: true },
    });

    return {
      agents,
      ledger,
      balance_tiyin: balance._sum.amount ?? 0,
      balance_uzs: Math.round((balance._sum.amount ?? 0) / 100),
      revenue_share: { creator: CREATOR_SHARE, platform: 1 - CREATOR_SHARE },
      payout_note: 'Payout processing is stubbed (Payme/Click merchant onboarding pending); the ledger accounting is real.',
      creatorBonus: {
        totalTiyin: bonusTotal._sum.bonusAmountTiyin ?? 0,
        totalSom: Math.round((bonusTotal._sum.bonusAmountTiyin ?? 0) / 100),
        payouts: bonusPayouts,
        share: CREATOR_BONUS_SHARE,
        note: "Har yangi xaridorning BIRINCHI to'lovida creation_price'ning yarmi — HAQIQIY balansga, bir martalik.",
      },
    };
  }

  /** Payout — balansni yopadigan manfiy yozuv (protsessing stub). */
  async requestPayout(user: User) {
    const balance = await this.prisma.creatorLedger.aggregate({
      where: { creatorId: user.id },
      _sum: { amount: true },
    });
    const amount = balance._sum.amount ?? 0;
    if (amount <= 0) throw new BadRequestException("Yechib olinadigan balans yo'q");

    const entry = await this.prisma.creatorLedger.create({
      data: {
        creatorId: user.id,
        kind: 'payout',
        amount: -amount,
        meta: { status: 'stub_pending', note: 'Payment rails not connected yet — request recorded, accounting closed.' },
      },
    });
    await this.audit.record({
      actorId: user.id, action: 'marketplace.payout_request', resourceType: 'creator_ledger', resourceId: entry.id,
      metadata: { amount_tiyin: amount },
    });
    return { requested_tiyin: amount, requested_uzs: Math.round(amount / 100), status: 'stub_pending', entryId: entry.id };
  }
}
