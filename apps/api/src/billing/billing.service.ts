import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymeService } from './payme.service';
import { ClickService } from './click.service';
import type { PaymentProviderService } from './payment-provider.interface';
import { Prisma, type User } from '@prisma/client';

/**
 * Prepaid billing — foydalanuvchi o'zi uchun to'laydi, platforma emas.
 *
 * Asosiy tamoyil: `chargeForMessage` LLM chaqiruvidan OLDIN, atomik ravishda
 * balansni tekshiradi va yechadi. Agar yetarli balans bo'lmasa — 402 xato
 * tashlaydi va Claude API'ga so'rov umuman ketmaydi. Shu orqali platforma
 * egasi (siz) hech qachon o'z hisobingizdan xarajat qilmaysiz — har bir
 * so'rov faqat foydalanuvchi oldindan to'lagan pul evaziga bajariladi.
 *
 * To'ldirish — Payme YOKI Click Merchant API (foydalanuvchi checkout'da
 * tanlaydi). Ikkalasi ham PaymentProviderService interfeysini implement
 * qiladi (payme.service.ts / click.service.ts) — provayder-xos webhook
 * mantig'i o'sha fayllarda, bu yerda faqat marshrutlash bor.
 */

function intEnv(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payme: PaymeService,
    private readonly click: ClickService,
  ) {}

  private providerFor(provider?: string): PaymentProviderService {
    return provider === 'click' ? this.click : this.payme;
  }

  /** Bitta chat xabari narxi (UZS tiyin). Anthropic ulgurji narxiga ustama bilan. */
  get pricePerMessageTiyin(): number {
    return intEnv('BILLING_PRICE_PER_MESSAGE_TIYIN', 50_000); // ~500 so'm
  }

  /** Pro tarif 30 kunlik narxi (UZS tiyin). */
  get proMonthTiyin(): number {
    return intEnv('BILLING_PRO_MONTH_TIYIN', 2_500_000); // ~25 000 so'm
  }

  /**
   * Pro'ga o'tish — prepaid balansdan 30 kunlik obuna narxi atomik yechiladi
   * (chargeForMessage bilan bir xil naqsh: balans yetsagina UPDATE o'tadi).
   * Faol obuna ustiga sotib olinsa muddat oxiridan davom etadi.
   */
  async upgradePro(user: User) {
    const price = this.proMonthTiyin;

    const updated = await this.prisma.user.updateMany({
      where: { id: user.id, balanceTiyin: { gte: price } },
      data: { balanceTiyin: { decrement: price } },
    });
    if (updated.count === 0) {
      throw new HttpException(
        {
          message: `Balansingiz yetarli emas. Pro tarif narxi: ${Math.round(price / 100)} so'm/oy. Hisobingizni to'ldiring.`,
          reason: 'insufficient_balance',
          proMonthSom: Math.round(price / 100),
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    const now = new Date();
    const base = user.proUntil && user.proUntil > now ? user.proUntil : now;
    const until = new Date(base.getTime() + 30 * 24 * 3600 * 1000);

    const fresh = await this.prisma.user.update({
      where: { id: user.id },
      data: { plan: 'pro', proUntil: until },
      select: { balanceTiyin: true, proUntil: true },
    });
    await this.prisma.creditLedger.create({
      data: {
        userId: user.id,
        kind: 'subscription',
        amount: -price,
        balanceAfter: fresh.balanceTiyin,
        meta: { plan: 'pro', until: until.toISOString() },
      },
    });
    return {
      plan: 'pro',
      proUntil: fresh.proUntil,
      balanceSom: Math.round(fresh.balanceTiyin / 100),
    };
  }

  async getBalance(user: User) {
    const ledger = await this.prisma.creditLedger.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return {
      balanceTiyin: user.balanceTiyin,
      balanceSom: Math.round(user.balanceTiyin / 100),
      pricePerMessageSom: Math.round(this.pricePerMessageTiyin / 100),
      messagesRemaining: Math.floor(user.balanceTiyin / this.pricePerMessageTiyin),
      ledger,
    };
  }

  /**
   * LLM so'rovidan OLDIN chaqiriladi. Atomik: balans yetarli bo'lsagina
   * yechiladi (bitta SQL UPDATE...WHERE balance >= amount — parallel
   * so'rovlarda balansdan ortiq sarflashning oldini oladi).
   */
  async chargeForMessage(user: User, meta?: Record<string, unknown>) {
    const amount = this.pricePerMessageTiyin;

    const updated = await this.prisma.user.updateMany({
      where: { id: user.id, balanceTiyin: { gte: amount } },
      data: { balanceTiyin: { decrement: amount } },
    });

    if (updated.count === 0) {
      throw new HttpException(
        {
          message: `Balansingiz yetarli emas. Xabar narxi: ${Math.round(amount / 100)} so'm. Hisobingizni to'ldiring.`,
          reason: 'insufficient_balance',
          pricePerMessageSom: Math.round(amount / 100),
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    const fresh = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { balanceTiyin: true },
    });

    return this.prisma.creditLedger.create({
      data: {
        userId: user.id,
        kind: 'usage',
        amount: -amount,
        balanceAfter: fresh.balanceTiyin,
        meta: (meta ?? {}) as any,
      },
    });
  }

  /**
   * Xarajat muvaffaqiyatsiz bo'lsa (engine xatosi/limit/oqim uzilishi) — pulni
   * qaytarish. `idempotencyKey` (L12) — berilsa, bir xil kalit bilan takror
   * chaqiruv IKKINCHI marta kreditlamaydi (mavjud yozuvni qaytaradi). BFF har
   * so'rovga bitta kalit beradi, shuning uchun bir necha refund-yo'li yoki qayta
   * urinish bo'lsa ham balans faqat BIR MARTA oshadi. Balans-oshirish va ledger
   * yozuvi bitta $transaction'da — P2002 (parallel bir xil kalit) da rollback.
   */
  async refund(user: User, reason: string, idempotencyKey?: string) {
    const amount = this.pricePerMessageTiyin;

    if (idempotencyKey) {
      const existing = await this.prisma.creditLedger.findUnique({ where: { idempotencyKey } });
      if (existing) return existing;
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const fresh = await tx.user.update({
          where: { id: user.id },
          data: { balanceTiyin: { increment: amount } },
          select: { balanceTiyin: true },
        });
        return tx.creditLedger.create({
          data: {
            userId: user.id,
            kind: 'refund',
            amount,
            balanceAfter: fresh.balanceTiyin,
            meta: { reason },
            idempotencyKey: idempotencyKey ?? undefined,
          },
        });
      });
    } catch (e) {
      // Parallel refund bir xil kalit bilan ulgurdi — o'sha yozuvni qaytaramiz (double-credit yo'q).
      if (idempotencyKey && e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const winner = await this.prisma.creditLedger.findUnique({ where: { idempotencyKey } });
        if (winner) return winner;
      }
      throw e;
    }
  }

  /** Balansni to'ldirish havolasi — foydalanuvchi Payme yoki Click'ni tanlaydi. */
  async createTopupReceipt(user: User, amountSom: number, provider?: string) {
    return this.providerFor(provider).createTopupReceipt(user, amountSom);
  }
}
