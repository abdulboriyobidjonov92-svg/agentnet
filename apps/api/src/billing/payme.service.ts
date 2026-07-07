import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { WalletCreditService } from './wallet-credit.service';
import type { PaymentProviderService, TopupReceipt } from './payment-provider.interface';
import type { User } from '@prisma/client';

/**
 * Payme Merchant API (JSON-RPC) — https://developer.help.paycom.uz/
 * Platforma o'zining PAYME_MERCHANT_ID/PAYME_SECRET_KEY (.env) orqali ishlaydi.
 */
@Injectable()
export class PaymeService implements PaymentProviderService {
  readonly providerId = 'payme' as const;
  private readonly logger = new Logger(PaymeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletCreditService,
  ) {}

  isConfigured(): boolean {
    return !!(process.env.PAYME_MERCHANT_ID && process.env.PAYME_SECRET_KEY);
  }

  /** Foydalanuvchi balansini to'ldirish uchun Payme kvitansiyasi yaratadi. */
  async createTopupReceipt(user: User, amountSom: number): Promise<TopupReceipt> {
    if (!this.isConfigured()) {
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
      throw new HttpException("Minimal to'ldirish miqdori 1000 so'm", HttpStatus.BAD_REQUEST);
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
          params: { amount: amountTiyin, account: { user_id: user.id } },
        },
        { headers, timeout: 15_000 },
      );
      if (data.error) {
        this.logger.error(`Payme receipts.create xatosi: ${JSON.stringify(data.error)}`);
        throw new HttpException(`Payme: ${data.error.message}`, HttpStatus.BAD_GATEWAY);
      }
      const receiptId = data.result?.receipt?._id;
      return {
        provider: 'payme',
        receiptId,
        payUrl: `https://checkout.${test ? 'test.' : ''}paycom.uz/${receiptId}`,
        amountSom,
      };
    } catch (e: any) {
      if (e instanceof HttpException) throw e;
      throw new HttpException(`Payme API bilan bog'lanib bo'lmadi: ${e.message}`, HttpStatus.BAD_GATEWAY);
    }
  }

  // ---------------------------------------------------------------
  // Payme Merchant API — webhook (Paycom → biz), real JSON-RPC protokoli
  // ---------------------------------------------------------------

  /** Har bir webhook chaqiruvidan oldin X-Auth header'ni tekshiradi. */
  verifyMerchantAuth(authHeader: string | undefined): void {
    if (!this.isConfigured()) {
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
    await this.resolveUser(params.account);
    if (params.amount < 100_000) {
      throw this.paymeError(-31001, "Noto'g'ri summa");
    }
    return { allow: true };
  }

  private async createTransaction(params: any) {
    const existing = await this.prisma.paymeTransaction.findUnique({ where: { paycomId: params.id } });
    if (existing) {
      if (existing.state !== 1) throw this.paymeError(-31008, "Tranzaksiyani o'zgartirib bo'lmaydi");
      return { create_time: Number(existing.createTimeMs), transaction: existing.id, state: existing.state };
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
    const updatedTx = await this.prisma.$transaction(async (client) => {
      const updated = await client.paymeTransaction.update({
        where: { id: tx.id },
        data: { state: 2, performTimeMs },
      });
      await this.wallet.credit(tx.userId, tx.amountTiyin, { paycomTransactionId: params.id }, client);
      return updated;
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
      await this.prisma.$transaction(async (client) => {
        await client.paymeTransaction.update({
          where: { id: tx.id },
          data: { state: newState, cancelTimeMs, reason: params.reason },
        });
        await this.wallet.debit(tx.userId, tx.amountTiyin, { paycomTransactionId: params.id, cancelled: true }, client);
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
