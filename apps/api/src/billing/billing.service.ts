import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import type { User } from '@prisma/client';

/**
 * Prepaid billing — foydalanuvchi o'zi uchun to'laydi, platforma emas.
 *
 * Asosiy tamoyil: `chargeForMessage` LLM chaqiruvidan OLDIN, atomik ravishda
 * balansni tekshiradi va yechadi. Agar yetarli balans bo'lmasa — 402 xato
 * tashlaydi va Claude API'ga so'rov umuman ketmaydi. Shu orqali platforma
 * egasi (siz) hech qachon o'z hisobingizdan xarajat qilmaysiz — har bir
 * so'rov faqat foydalanuvchi oldindan to'lagan pul evaziga bajariladi.
 *
 * To'ldirish — Payme Merchant API (JSON-RPC), haqiqiy protokol. Platforma
 * o'zining PAYME_MERCHANT_ID/PAYME_SECRET_KEY (.env) orqali ishlaydi — bu
 * foydalanuvchining shaxsiy connector konfiguratsiyasidan farqli, tizimning
 * o'z kassasi. Ishga tushirish uchun haqiqiy Payme kassa hisobi kerak —
 * bo'lmasa createTopupReceipt aniq xato qaytaradi (soxta muvaffaqiyat yo'q).
 */

function intEnv(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger('BillingService');

  constructor(private readonly prisma: PrismaService) {}

  /** Bitta chat xabari narxi (UZS tiyin). Anthropic ulgurji narxiga ustama bilan. */
  get pricePerMessageTiyin(): number {
    return intEnv('BILLING_PRICE_PER_MESSAGE_TIYIN', 50_000); // ~500 so'm
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

  /** Xarajat muvaffaqiyatsiz bo'lsa (masalan engine xatosi) — pulni qaytarish. */
  async refund(user: User, reason: string) {
    const amount = this.pricePerMessageTiyin;
    const fresh = await this.prisma.user.update({
      where: { id: user.id },
      data: { balanceTiyin: { increment: amount } },
      select: { balanceTiyin: true },
    });
    return this.prisma.creditLedger.create({
      data: {
        userId: user.id,
        kind: 'refund',
        amount,
        balanceAfter: fresh.balanceTiyin,
        meta: { reason },
      },
    });
  }

  // ---------------------------------------------------------------
  // Payme Merchant API — to'ldirish (receipts.create)
  // ---------------------------------------------------------------

  private get paymeConfigured(): boolean {
    return !!(process.env.PAYME_MERCHANT_ID && process.env.PAYME_SECRET_KEY);
  }

  /** Foydalanuvchi balansini to'ldirish uchun Payme kvitansiyasi yaratadi. */
  async createTopupReceipt(user: User, amountSom: number) {
    if (!this.paymeConfigured) {
      throw new HttpException(
        {
          message:
            "To'lov tizimi hali sozlanmagan. Platforma administratori PAYME_MERCHANT_ID / PAYME_SECRET_KEY ni .env ga qo'yishi kerak.",
          reason: 'payment_not_configured',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    if (!Number.isFinite(amountSom) || amountSom < 1000) {
      throw new HttpException('Minimal to\'ldirish miqdori 1000 so\'m', HttpStatus.BAD_REQUEST);
    }

    const amountTiyin = Math.round(amountSom * 100);
    const test = String(process.env.PAYME_TEST_MODE ?? 'true') === 'true';
    const base = test ? 'https://checkout.test.paycom.uz/api' : 'https://checkout.paycom.uz/api';
    const headers = {
      'X-Auth': `${process.env.PAYME_MERCHANT_ID}:${process.env.PAYME_SECRET_KEY}`,
    };

    try {
      const { data } = await axios.post(
        base,
        {
          id: Date.now(),
          method: 'receipts.create',
          params: {
            amount: amountTiyin,
            account: { user_id: user.id },
          },
        },
        { headers, timeout: 15_000 },
      );
      if (data.error) {
        this.logger.error(`Payme receipts.create xatosi: ${JSON.stringify(data.error)}`);
        throw new HttpException(`Payme: ${data.error.message}`, HttpStatus.BAD_GATEWAY);
      }
      const receiptId = data.result?.receipt?._id;
      return {
        receiptId,
        payUrl: `https://checkout.${test ? 'test.' : ''}paycom.uz/${receiptId}`,
        amountSom,
      };
    } catch (e: any) {
      if (e instanceof HttpException) throw e;
      throw new HttpException(
        `Payme API bilan bog'lanib bo'lmadi: ${e.message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  // ---------------------------------------------------------------
  // Payme Merchant API — webhook (Paycom → biz), real JSON-RPC protokoli
  // https://developer.help.paycom.uz/
  // ---------------------------------------------------------------

  /** Har bir webhook chaqiruvidan oldin X-Auth header'ni tekshiradi. */
  verifyMerchantAuth(authHeader: string | undefined): void {
    if (!this.paymeConfigured) {
      throw this.paymeError(-32504, 'Xizmat sozlanmagan');
    }
    const expected = Buffer.from(`Paycom:${process.env.PAYME_SECRET_KEY}`).toString('base64');
    const got = (authHeader ?? '').replace(/^Basic\s+/i, '');
    if (got !== expected) {
      throw this.paymeError(-32504, 'Avtorizatsiya xatosi');
    }
  }

  private paymeError(code: number, message: string) {
    return { jsonrpc: '2.0', error: { code, message } };
  }

  async handleMerchantRpc(body: any) {
    const { method, params, id } = body ?? {};
    try {
      switch (method) {
        case 'CheckPerformTransaction':
          return { jsonrpc: '2.0', id, result: await this.checkPerformTransaction(params) };
        case 'CreateTransaction':
          return { jsonrpc: '2.0', id, result: await this.createTransaction(params) };
        case 'PerformTransaction':
          return { jsonrpc: '2.0', id, result: await this.performTransaction(params) };
        case 'CancelTransaction':
          return { jsonrpc: '2.0', id, result: await this.cancelTransaction(params) };
        case 'CheckTransaction':
          return { jsonrpc: '2.0', id, result: await this.checkTransactionStatus(params) };
        default:
          return { jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } };
      }
    } catch (e: any) {
      if (e?.error) return { jsonrpc: '2.0', id, ...e };
      throw e;
    }
  }

  private async resolveUser(account: any) {
    const userId = account?.user_id;
    if (!userId) throw this.paymeError(-31050, "user_id ko'rsatilmagan");
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw this.paymeError(-31050, 'Foydalanuvchi topilmadi');
    return user;
  }

  private async checkPerformTransaction(params: any) {
    const user = await this.resolveUser(params.account);
    if (params.amount < 100_000) {
      // minimal 1000 so'm — tiyin
      throw this.paymeError(-31001, "Noto'g'ri summa");
    }
    return { allow: true };
  }

  private async createTransaction(params: any) {
    const existing = await this.prisma.paymeTransaction.findUnique({
      where: { paycomId: params.id },
    });
    if (existing) {
      if (existing.state !== 1) throw this.paymeError(-31008, "Tranzaksiyani o'zgartirib bo'lmaydi");
      return {
        create_time: Number(existing.createTimeMs),
        transaction: existing.id,
        state: existing.state,
      };
    }

    const user = await this.resolveUser(params.account);
    const tx = await this.prisma.paymeTransaction.create({
      data: {
        paycomId: params.id,
        userId: user.id,
        amountTiyin: params.amount,
        state: 1,
        createTimeMs: BigInt(Date.now()),
      },
    });
    return { create_time: Number(tx.createTimeMs), transaction: tx.id, state: tx.state };
  }

  private async performTransaction(params: any) {
    const tx = await this.prisma.paymeTransaction.findUnique({ where: { paycomId: params.id } });
    if (!tx) throw this.paymeError(-31003, 'Tranzaksiya topilmadi');
    if (tx.state === 2) {
      return { transaction: tx.id, perform_time: Number(tx.performTimeMs), state: tx.state };
    }
    if (tx.state !== 1) throw this.paymeError(-31008, "Tranzaksiyani bajarib bo'lmaydi");

    const performTimeMs = BigInt(Date.now());
    const [, updatedTx] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: tx.userId },
        data: { balanceTiyin: { increment: tx.amountTiyin } },
      }),
      this.prisma.paymeTransaction.update({
        where: { id: tx.id },
        data: { state: 2, performTimeMs },
      }),
    ]);
    const fresh = await this.prisma.user.findUniqueOrThrow({
      where: { id: tx.userId },
      select: { balanceTiyin: true },
    });
    await this.prisma.creditLedger.create({
      data: {
        userId: tx.userId,
        kind: 'topup',
        amount: tx.amountTiyin,
        balanceAfter: fresh.balanceTiyin,
        meta: { paycomTransactionId: params.id },
      },
    });
    return { transaction: updatedTx.id, perform_time: Number(performTimeMs), state: 2 };
  }

  private async cancelTransaction(params: any) {
    const tx = await this.prisma.paymeTransaction.findUnique({ where: { paycomId: params.id } });
    if (!tx) throw this.paymeError(-31003, 'Tranzaksiya topilmadi');
    if (tx.state === -1 || tx.state === -2) {
      return { transaction: tx.id, cancel_time: Number(tx.cancelTimeMs), state: tx.state };
    }

    const cancelTimeMs = BigInt(Date.now());
    const newState = tx.state === 2 ? -2 : -1;

    if (tx.state === 2) {
      // Bajarilgan to'lov bekor qilinmoqda — balansdan qaytarib olamiz
      await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: tx.userId },
          data: { balanceTiyin: { decrement: tx.amountTiyin } },
        }),
        this.prisma.paymeTransaction.update({
          where: { id: tx.id },
          data: { state: newState, cancelTimeMs, reason: params.reason },
        }),
      ]);
      const fresh = await this.prisma.user.findUniqueOrThrow({
        where: { id: tx.userId },
        select: { balanceTiyin: true },
      });
      await this.prisma.creditLedger.create({
        data: {
          userId: tx.userId,
          kind: 'refund',
          amount: -tx.amountTiyin,
          balanceAfter: fresh.balanceTiyin,
          meta: { paycomTransactionId: params.id, cancelled: true },
        },
      });
    } else {
      await this.prisma.paymeTransaction.update({
        where: { id: tx.id },
        data: { state: newState, cancelTimeMs, reason: params.reason },
      });
    }

    return { transaction: tx.id, cancel_time: Number(cancelTimeMs), state: newState };
  }

  private async checkTransactionStatus(params: any) {
    const tx = await this.prisma.paymeTransaction.findUnique({ where: { paycomId: params.id } });
    if (!tx) throw this.paymeError(-31003, 'Tranzaksiya topilmadi');
    return {
      create_time: Number(tx.createTimeMs),
      perform_time: Number(tx.performTimeMs ?? 0),
      cancel_time: Number(tx.cancelTimeMs ?? 0),
      transaction: tx.id,
      state: tx.state,
      reason: tx.reason ?? null,
    };
  }
}
