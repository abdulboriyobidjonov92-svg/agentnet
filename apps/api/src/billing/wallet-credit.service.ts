import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '@prisma/client';

/**
 * To'lov muvaffaqiyatli bo'lganda balansni yangilaydigan UMUMIY logika —
 * Payme va Click ikkalasi ham shu servisdan foydalanadi (ularning webhook
 * protokoli boshqa-boshqa, lekin "pul kirdi/qaytdi" bir xil buxgalteriya).
 *
 * `client` — ixtiyoriy `Prisma.TransactionClient` (agents.service.ts'dagi
 * assertCanCreateAgent bilan bir xil naqsh): chaqiruvchi o'z tranzaksiya
 * jadvalini (PaymeTransaction/ClickTransaction) yangilashni shu bilan bitta
 * atomik $transaction'ga o'rashi mumkin.
 */
@Injectable()
export class WalletCreditService {
  constructor(private readonly prisma: PrismaService) {}

  /** To'lov tasdiqlanganda balansni oshiradi + CreditLedger yozadi (atomik). */
  async credit(
    userId: string,
    amountTiyin: number,
    meta: Record<string, unknown>,
    client: Prisma.TransactionClient = this.prisma,
  ) {
    const fresh = await client.user.update({
      where: { id: userId },
      data: { balanceTiyin: { increment: amountTiyin } },
      select: { balanceTiyin: true },
    });
    return client.creditLedger.create({
      data: { userId, kind: 'topup', amount: amountTiyin, balanceAfter: fresh.balanceTiyin, meta: meta as any },
    });
  }

  /** Bajarilgan to'lov bekor qilinganda (chargeback) — balansdan qaytarib oladi. */
  async debit(
    userId: string,
    amountTiyin: number,
    meta: Record<string, unknown>,
    client: Prisma.TransactionClient = this.prisma,
  ) {
    const fresh = await client.user.update({
      where: { id: userId },
      data: { balanceTiyin: { decrement: amountTiyin } },
      select: { balanceTiyin: true },
    });
    return client.creditLedger.create({
      data: { userId, kind: 'refund', amount: -amountTiyin, balanceAfter: fresh.balanceTiyin, meta: meta as any },
    });
  }
}
