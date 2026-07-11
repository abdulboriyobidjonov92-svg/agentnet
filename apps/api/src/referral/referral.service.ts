import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { User } from '@prisma/client';

function intEnv(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

/**
 * Referral (taklif) tizimi — PLG viral halqasi. Do'stini taklif qilgan
 * foydalanuvchi VA yangi kelgan foydalanuvchi ikkalasi ham balans-bonus oladi
 * (CreditLedger kind: 'referral_bonus' — mavjud wallet infra qayta ishlatiladi,
 * yangi pul-tizimi YO'Q).
 *
 * Himoya: referredById faqat ro'yxatdan o'tishda BIR MARTA o'rnatiladi;
 * o'z-o'zini taklif qilish rad etiladi; noma'lum kod jimgina e'tiborsiz
 * qoldiriladi (signup hech qachon buzilmaydi — bonus "best-effort").
 */
@Injectable()
export class ReferralService {
  private readonly logger = new Logger(ReferralService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Ikkala tomonga ham beriladigan bonus (tiyin). Default ~5 000 so'm (~10 xabar). */
  get bonusTiyin(): number {
    return intEnv('REFERRAL_BONUS_TIYIN', 500_000);
  }

  /** O'qilishi oson, URL-xavfsiz 8 belgili kod (o'xshash belgilar chiqarilgan). */
  private generateCode(): string {
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const bytes = randomBytes(8);
    let code = '';
    for (let i = 0; i < 8; i++) code += alphabet[bytes[i] % alphabet.length];
    return code;
  }

  /** Foydalanuvchining taklif-ma'lumoti — kod lazily yaratiladi. */
  async getMyReferralInfo(user: User) {
    let code = user.referralCode;
    if (!code) {
      // Unique-to'qnashuvda (juda kam ehtimol) qayta urinamiz; updateMany —
      // "faqat hali kodi yo'q bo'lsa" sharti bilan (parallel so'rovlarga chidamli)
      for (let attempt = 0; attempt < 3 && !code; attempt++) {
        try {
          await this.prisma.user.updateMany({
            where: { id: user.id, referralCode: null },
            data: { referralCode: this.generateCode() },
          });
        } catch {
          // unique-to'qnashuv — keyingi urinishda yangi kod
        }
        const fresh = await this.prisma.user.findUnique({
          where: { id: user.id },
          select: { referralCode: true },
        });
        code = fresh?.referralCode ?? null;
      }
    }

    const [invitedCount, earned] = await Promise.all([
      this.prisma.user.count({ where: { referredById: user.id } }),
      this.prisma.creditLedger.aggregate({
        where: { userId: user.id, kind: 'referral_bonus' },
        _sum: { amount: true },
      }),
    ]);

    return {
      code,
      invitedCount,
      bonusSom: Math.round(this.bonusTiyin / 100),
      earnedSom: Math.round((earned._sum.amount ?? 0) / 100),
    };
  }

  /**
   * Ro'yxatdan o'tishda taklif-kodni qo'llaydi — FAQAT yangi foydalanuvchi uchun.
   * Har qanday xato signup'ni buzmasligi kerak (chaqiruvchi try/catch bilan o'raydi),
   * lekin bu yerda ham himoya: noma'lum kod / o'zini-o'zi / allaqachon bog'langan — no-op.
   */
  async applyReferralOnSignup(newUserId: string, code: string): Promise<boolean> {
    const normalized = (code || '').trim().toUpperCase();
    if (!/^[A-Z2-9]{8}$/.test(normalized)) return false;

    const referrer = await this.prisma.user.findUnique({
      where: { referralCode: normalized },
      select: { id: true },
    });
    if (!referrer || referrer.id === newUserId) return false;

    const bonus = this.bonusTiyin;
    try {
      await this.prisma.$transaction(async (tx) => {
        // Faqat hali bog'lanmagan foydalanuvchiga qo'llanadi — takror chaqiruv no-op
        const linked = await tx.user.updateMany({
          where: { id: newUserId, referredById: null },
          data: { referredById: referrer.id },
        });
        if (linked.count === 0) throw new Error('already_linked');

        // Ikkala tomonga bonus + ledger (balanceAfter aniq bo'lishi uchun ketma-ket)
        for (const [userId, side] of [
          [newUserId, 'invited'],
          [referrer.id, 'referrer'],
        ] as const) {
          const fresh = await tx.user.update({
            where: { id: userId },
            data: { balanceTiyin: { increment: bonus } },
            select: { balanceTiyin: true },
          });
          await tx.creditLedger.create({
            data: {
              userId,
              kind: 'referral_bonus',
              amount: bonus,
              balanceAfter: fresh.balanceTiyin,
              meta: { side, code: normalized, counterpartId: side === 'invited' ? referrer.id : newUserId },
            },
          });
        }
      });
      this.logger.log(`Referral qo'llandi: ${normalized} -> ${newUserId} (+${bonus} tiyin x2)`);
      return true;
    } catch (e: any) {
      if (e?.message !== 'already_linked') {
        this.logger.warn(`Referral qo'llanmadi (${normalized}): ${e?.message}`);
      }
      return false;
    }
  }
}
