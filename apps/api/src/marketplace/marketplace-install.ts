import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../auth/auth.service';
import { addDays, addMonths, trialDays } from '../agents/agents.service';
import type { User } from '@prisma/client';

export const CREATOR_SHARE = 0.7; // 70% kreator, 30% platforma
const CREATOR_BONUS_SHARE = 0.5; // creation_price'ning yarmi — bir martalik bonus

const MARKETPLACE_INSTALL_LOCK_NS = 4774;

/** $transaction ichidan tashqariga balans yetmasligini signal qilish uchun. */
class InsufficientBalanceError extends Error {
  constructor(public readonly priceSom: number) {
    super('insufficient_balance');
  }
}

/** O'rnatish: HAQIQIY to'lov + daromad taqsimoti + yaratuvchi bonusi. */
export class MarketplaceInstall {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async install(publishedAgentId: string, user: User) {
    const source = await this.prisma.agent.findUnique({ where: { id: publishedAgentId } });
    if (!source || !source.isPublished) throw new NotFoundException('Marketplace agenti topilmadi');

    const price = source.marketplacePrice ?? 0;
    const isSelfInstall = source.userId === user.id;

    let installed;
    try {
      installed = await this.prisma.$transaction(async (tx) => {
        // Har doim lock — pullik/o'ziniki-emas o'rnatishda balans ATOMIK tekshirilishi
        // uchun SHART, bepul/o'z-o'ziga o'rnatishda esa quyidagi "birinchi agent"
        // hisoblashning parallel so'rovlarda to'g'ri bo'lishi uchun (agents.service.ts
        // create()'dagi bilan bir xil naqsh).
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${MARKETPLACE_INSTALL_LOCK_NS}::int, hashtext(${user.id}))`;

        // O'ziga tegishli bo'lmagan pullik o'rnatish — balans ATOMIK tekshiriladi.
        if (price > 0 && !isSelfInstall) {
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

        // Sinov — FAQAT foydalanuvchining ENG BIRINCHI agenti (manual yaratish
        // bilan bir xil qoida: marketplace'dan o'rnatish ham "birinchi agent"
        // bo'lishi mumkin, shuning uchun agents.service.ts create()'dagi bilan
        // bir xil mantiq qo'llanadi).
        const existingCount = await tx.agent.count({ where: { userId: user.id } });
        const isFirstAgent = existingCount === 0;

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
            isTrialAgent: isFirstAgent && source.monthlyPriceTiyin > 0,
            trialStartedAt: isFirstAgent && source.monthlyPriceTiyin > 0 ? now : null,
            nextChargeAt:
              source.monthlyPriceTiyin > 0
                ? isFirstAgent
                  ? addDays(now, trialDays())
                  : addMonths(now, 1)
                : null,
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
}
