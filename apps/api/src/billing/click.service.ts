import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { WalletCreditService } from './wallet-credit.service';
import { PlatformBillingService, type SelfServePlatformPlan } from './platform-billing.service';
import type { PaymentProviderService, TopupReceipt } from './payment-provider.interface';
import type { User, PaymentPurpose } from '@prisma/client';

/**
 * Click Merchant API (Prepare/Complete) — https://docs.click.uz
 *
 * Payme JSON-RPC ishlatadi, Click esa oddiy POST + action maydoni bilan ikki
 * bosqichli oqim: action=0 (Prepare — to'lovni tasdiqlashdan oldin) va
 * action=1 (Complete — haqiqiy to'lov). Har ikkalasi ham imzo (sign_string,
 * MD5) bilan tekshiriladi — merchant_trans_id = userId (Payme'dagi
 * account.user_id bilan bir xil: bitta hisobga to'lov).
 */

// Click standart xato kodlari (rasmiy hujjatdan)
const ClickError = {
  Success: 0,
  SignFailed: -1,
  BadAmount: -2,
  ActionNotFound: -3,
  AlreadyPaid: -4,
  UserNotFound: -5,
  TransactionNotFound: -6,
  BadRequest: -8,
  TransactionCancelled: -9,
} as const;

function clickErrorNote(code: number): string {
  switch (code) {
    case ClickError.SignFailed:
      return 'SIGN CHECK FAILED';
    case ClickError.BadAmount:
      return "Noto'g'ri summa";
    case ClickError.ActionNotFound:
      return 'Action not found';
    case ClickError.AlreadyPaid:
      return "Allaqachon to'langan";
    case ClickError.UserNotFound:
      return 'Foydalanuvchi topilmadi';
    case ClickError.TransactionNotFound:
      return 'Tranzaksiya topilmadi';
    case ClickError.TransactionCancelled:
      return 'Tranzaksiya bekor qilingan';
    default:
      return "Noto'g'ri so'rov";
  }
}

@Injectable()
export class ClickService implements PaymentProviderService {
  readonly providerId = 'click' as const;
  private readonly logger = new Logger(ClickService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletCreditService,
    private readonly platformBilling: PlatformBillingService,
  ) {}

  isConfigured(): boolean {
    return !!(process.env.CLICK_MERCHANT_ID && process.env.CLICK_SERVICE_ID && process.env.CLICK_SECRET_KEY);
  }

  /** Click'ning to'g'ridan-to'g'ri to'lov havolasi (Checkout) — invoice API'siz eng oddiy MVP oqimi. */
  async createTopupReceipt(user: User, amountSom: number): Promise<TopupReceipt> {
    if (!this.isConfigured()) {
      throw new HttpException(
        {
          message:
            "To'lov tizimi hali sozlanmagan. Platforma administratori CLICK_MERCHANT_ID / CLICK_SERVICE_ID / CLICK_SECRET_KEY ni .env ga qo'yishi kerak.",
          reason: 'payment_not_configured',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    if (!Number.isFinite(amountSom) || amountSom < 1000) {
      throw new HttpException("Minimal to'ldirish miqdori 1000 so'm", HttpStatus.BAD_REQUEST);
    }

    const params = new URLSearchParams({
      service_id: process.env.CLICK_SERVICE_ID!,
      merchant_id: process.env.CLICK_MERCHANT_ID!,
      amount: amountSom.toFixed(2),
      transaction_param: user.id, // merchant_trans_id — webhook shu orqali foydalanuvchini topadi
    });
    return {
      provider: 'click',
      payUrl: `https://my.click.uz/services/pay?${params.toString()}`,
      amountSom,
    };
  }

  /**
   * Platforma obunasi (Pro/Max) uchun to'lov havolasi. Click'ning
   * transaction_param bitta oddiy satr (Payme'dagi `account` JSON'i kabi
   * emas) — shuning uchun `userId::sub::plan` shaklida kodlaymiz va
   * prepare()da qayta ochamiz (webhook shu orqali maqsadni biladi).
   */
  async createSubscriptionReceipt(user: User, plan: SelfServePlatformPlan, amountSom: number): Promise<TopupReceipt> {
    if (!this.isConfigured()) {
      throw new HttpException(
        {
          message:
            "To'lov tizimi hali sozlanmagan. Platforma administratori CLICK_MERCHANT_ID / CLICK_SERVICE_ID / CLICK_SECRET_KEY ni .env ga qo'yishi kerak.",
          reason: 'payment_not_configured',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const params = new URLSearchParams({
      service_id: process.env.CLICK_SERVICE_ID!,
      merchant_id: process.env.CLICK_MERCHANT_ID!,
      amount: amountSom.toFixed(2),
      transaction_param: `${user.id}::sub::${plan}`,
    });
    return {
      provider: 'click',
      payUrl: `https://my.click.uz/services/pay?${params.toString()}`,
      amountSom,
    };
  }

  // ---------------------------------------------------------------
  // Click Merchant API — webhook (Prepare/Complete)
  // ---------------------------------------------------------------

  private signString(parts: (string | number)[]): string {
    return createHash('md5').update(parts.join('')).digest('hex');
  }

  private verifySign(body: any): boolean {
    const secret = process.env.CLICK_SECRET_KEY ?? '';
    const isComplete = Number(body.action) === 1;
    const parts = isComplete
      ? [body.click_trans_id, body.service_id, secret, body.merchant_trans_id, body.merchant_prepare_id, body.amount, body.action, body.sign_time]
      : [body.click_trans_id, body.service_id, secret, body.merchant_trans_id, body.amount, body.action, body.sign_time];
    return this.signString(parts) === body.sign_string;
  }

  private reply(body: any, error: number, extra: Record<string, unknown> = {}) {
    return {
      click_trans_id: body.click_trans_id,
      merchant_trans_id: body.merchant_trans_id,
      error,
      error_note: error === ClickError.Success ? 'Success' : clickErrorNote(error),
      ...extra,
    };
  }

  /** Click serverlaridan keladigan yagona webhook — action=0 (Prepare) yoki action=1 (Complete). */
  async handleWebhook(body: any) {
    if (!this.isConfigured()) {
      return this.reply(body, ClickError.BadRequest, { error_note: 'Xizmat sozlanmagan' });
    }
    if (!this.verifySign(body)) {
      return this.reply(body, ClickError.SignFailed);
    }

    const action = Number(body.action);
    if (action === 0) return this.prepare(body);
    if (action === 1) return this.complete(body);
    return this.reply(body, ClickError.ActionNotFound);
  }

  /** transaction_param'ni ochadi: oddiy "userId" (topup) yoki "userId::sub::plan" (obuna). */
  private parseTransactionParam(raw: string): { userId: string; purpose: PaymentPurpose; plan: string | null } {
    const [userId, kind, plan] = String(raw).split('::');
    if (kind === 'sub' && plan) return { userId, purpose: 'platform_subscription', plan };
    return { userId, purpose: 'topup', plan: null };
  }

  private async prepare(body: any) {
    const { userId, purpose, plan } = this.parseTransactionParam(body.merchant_trans_id);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return this.reply(body, ClickError.UserNotFound);

    // A13: tashqi protokol summani `number` (so'm) sifatida yuboradi.
    // Validatsiya `number`da bajariladi (isFinite/NaN tekshiruvi bigint'da
    // mumkin emas), so'ng chegara ichida ekani tasdiqlangach BIR MARTA
    // `bigint`ga o'tkaziladi — ichkarida hamma joyda faqat bigint yuradi.
    const amountRaw = Math.round(Number(body.amount) * 100);
    if (!Number.isFinite(amountRaw) || amountRaw < 100_000) {
      return this.reply(body, ClickError.BadAmount);
    }
    const amountTiyin = BigInt(amountRaw);

    const clickTransId = String(body.click_trans_id);
    const existing = await this.prisma.clickTransaction.findUnique({ where: { clickTransId } });
    if (existing) {
      // Idempotent — Click bir xil so'rovni qayta yuborishi mumkin
      return this.reply(body, ClickError.Success, { merchant_prepare_id: existing.id });
    }

    const tx = await this.prisma.clickTransaction.create({
      data: {
        clickTransId,
        userId: user.id,
        amountTiyin,
        state: 0,
        prepareTimeMs: BigInt(Date.now()),
        purpose,
        subscriptionPlan: plan,
      },
    });
    return this.reply(body, ClickError.Success, { merchant_prepare_id: tx.id });
  }

  private async complete(body: any) {
    const clickTransId = String(body.click_trans_id);
    const tx = await this.prisma.clickTransaction.findUnique({ where: { clickTransId } });
    if (!tx) return this.reply(body, ClickError.TransactionNotFound);

    if (tx.state === 1) {
      // Allaqachon bajarilgan — Click qayta yuborsa ham ikkinchi marta kreditlanmaydi
      return this.reply(body, ClickError.Success, { merchant_confirm_id: tx.id });
    }
    if (tx.state === -1 || tx.state === -2) {
      return this.reply(body, ClickError.TransactionCancelled);
    }

    // Click "error" maydoni manfiy bo'lsa — foydalanuvchi tomonidan bekor qilingan
    if (Number(body.error) < 0) {
      await this.prisma.clickTransaction.update({
        where: { id: tx.id },
        data: { state: -1, errorCode: Number(body.error), cancelTimeMs: BigInt(Date.now()) },
      });
      return this.reply(body, ClickError.TransactionCancelled);
    }

    const confirmTimeMs = BigInt(Date.now());
    // Holat-himoyalangan atomik update: Click Complete'ni takror yuborsa yoki
    // parallel yetkazsa ham balans/obuna FAQAT BIR MARTA qo'llanadi —
    // `WHERE state=0` sharti bo'yicha aynan bitta chaqiruv g'olib chiqadi.
    await this.prisma.$transaction(async (client) => {
      const confirmed = await client.clickTransaction.updateMany({
        where: { id: tx.id, state: 0 },
        data: { state: 1, confirmTimeMs },
      });
      if (confirmed.count === 0) return; // boshqa parallel chaqiruv allaqachon bajardi
      if (tx.purpose === 'platform_subscription' && tx.subscriptionPlan) {
        await this.platformBilling.activateFromPayment(tx.userId, tx.subscriptionPlan as SelfServePlatformPlan, client);
      } else {
        await this.wallet.credit(tx.userId, tx.amountTiyin, { clickTransId }, client);
      }
    });
    return this.reply(body, ClickError.Success, { merchant_confirm_id: tx.id });
  }
}
