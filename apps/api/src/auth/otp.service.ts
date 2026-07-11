import {
  Injectable,
  BadRequestException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService, ClerkSyncService, TwoFactorService } from './auth.service';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';

const CODE_TTL_MS = 10 * 60 * 1000; // 10 daqiqa
const RESEND_COOLDOWN_MS = 60 * 1000; // 1 daqiqa — spam'ga qarshi
const MAX_VERIFY_ATTEMPTS = 5;

export interface OtpRequestResult {
  sent: true;
  channel: 'email' | 'phone';
  expiresInSec: number;
}

export type OtpVerifyResult =
  | { needsTwoFactor: true; userId: string }
  | ({ needsTwoFactor: false } & ReturnType<ClerkSyncService['issueSession']>);

/**
 * Bir martalik login kodi (OTP) — dev-login o'rnini bosuvchi HAQIQIY
 * autentifikatsiya. Kod hech qachon ochiq saqlanmaydi (faqat sha256 hash),
 * shuning uchun DB dampi o'g'irlansa ham kodlar ishlatib bo'lmaydi.
 *
 * Oqim: requestOtp -> foydalanuvchiga kod yuboriladi -> verifyOtp -> agar
 * hisobda 2FA yoqilgan bo'lsa needsTwoFactor qaytadi (frontend TOTP so'raydi,
 * /auth/2fa/login-verify chaqiradi), aks holda darhol imzolangan sessiya beradi.
 */
@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly sms: SmsService,
    private readonly clerkSync: ClerkSyncService,
    private readonly auditLog: AuditLogService,
    private readonly twoFactor: TwoFactorService,
  ) {}

  async requestOtp(input: { email?: string; phone?: string }): Promise<OtpRequestResult> {
    const { channel, identifier } = this.resolveIdentifier(input);

    if (channel === 'phone' && !this.sms.isConfigured()) {
      throw new BadRequestException(
        "Telefon orqali kirish hozircha mavjud emas — iltimos, email bilan kiring",
      );
    }

    // Spam'ga qarshi: identifikator uchun so'nggi so'nggi so'rovdan beri
    // 1 daqiqa o'tmagan bo'lsa, yangi kod yubormaymiz.
    const recent = await this.prisma.otpCode.findFirst({
      where: { identifier, consumedAt: null, createdAt: { gt: new Date(Date.now() - RESEND_COOLDOWN_MS) } },
      orderBy: { createdAt: 'desc' },
    });
    if (recent) {
      throw new HttpException(
        'Kod allaqachon yuborilgan — biroz kutib, qayta urinib ko\'ring',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = this.generateCode();
    await this.prisma.otpCode.create({
      data: {
        identifier,
        channel,
        codeHash: this.hashCode(identifier, code),
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    });

    if (channel === 'email') {
      await this.email.sendOtpCode(identifier, code);
    } else {
      await this.sms.sendOtpCode(identifier, code);
    }

    return { sent: true, channel, expiresInSec: CODE_TTL_MS / 1000 };
  }

  async verifyOtp(input: {
    email?: string;
    phone?: string;
    code: string;
    name?: string;
  }): Promise<OtpVerifyResult> {
    const { channel, identifier } = this.resolveIdentifier(input);
    const code = (input.code || '').trim();
    if (!/^\d{6}$/.test(code)) {
      throw new BadRequestException('6 xonali kodni kiriting');
    }

    const otp = await this.prisma.otpCode.findFirst({
      where: { identifier, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp || otp.expiresAt < new Date()) {
      throw new BadRequestException("Kod topilmadi yoki muddati o'tgan — qaytadan so'rang");
    }
    if (otp.attempts >= MAX_VERIFY_ATTEMPTS) {
      throw new HttpException('Urinishlar soni tugadi — yangi kod so\'rang', HttpStatus.TOO_MANY_REQUESTS);
    }

    const expectedHash = this.hashCode(identifier, code);
    const valid = this.safeEqual(expectedHash, otp.codeHash);

    if (!valid) {
      await this.prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      throw new BadRequestException("Kod noto'g'ri");
    }

    await this.prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });

    const { user, isNewUser } = await this.clerkSync.findOrCreateUser(
      channel === 'email' ? { email: identifier, name: input.name } : { phone: identifier, name: input.name },
      { action: 'auth.otp_login' },
    );

    if (user.twoFactorEnabled) {
      await this.auditLog.record({
        actorId: user.id,
        action: 'auth.otp_verified_pending_2fa',
        resourceType: 'user',
        resourceId: user.id,
      });
      return { needsTwoFactor: true, userId: user.id };
    }

    const session = this.clerkSync.issueSession(user, isNewUser);
    return { needsTwoFactor: false, ...session };
  }

  /**
   * Login oqimining 2FA-yakunlash bosqichi. MUHIM: `twoFactorEnabled` bu yerda
   * qat'iy tekshiriladi — TwoFactorService.verifyLogin() o'zi 2FA yoqilmagan
   * foydalanuvchi uchun har doim `true` qaytaradi (bu boshqa joyda — allaqachon
   * autentifikatsiya qilingan foydalanuvchini keyingi tekshiruvlardan o'tkazish
   * uchun — to'g'ri xulq). Agar shu tekshiruvsiz to'g'ridan-to'g'ri chaqirilsa,
   * 2FA yoqilmagan islohiy userId bilan HECH QANDAY kodsiz token olish mumkin
   * bo'lardi — shuning uchun bu yerda avval mustaqil ravishda tasdiqlanadi.
   */
  async completeTwoFactorLogin(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorEnabled) {
      throw new UnauthorizedException('2FA yoqilmagan yoki foydalanuvchi topilmadi');
    }

    const ok = await this.twoFactor.verifyLogin(userId, token);
    if (!ok) throw new UnauthorizedException("TOTP kodi noto'g'ri");

    return { needsTwoFactor: false as const, ...this.clerkSync.issueSession(user, false) };
  }

  private resolveIdentifier(input: { email?: string; phone?: string }): {
    channel: 'email' | 'phone';
    identifier: string;
  } {
    if (input.phone) {
      const phone = this.clerkSync.normalizePhone(input.phone);
      if (!phone) throw new BadRequestException('Yaroqli telefon raqamini kiriting');
      return { channel: 'phone', identifier: phone };
    }
    const clean = (input.email || '').trim().toLowerCase();
    if (!clean || !clean.includes('@')) {
      throw new BadRequestException('Yaroqli email kiriting');
    }
    return { channel: 'email', identifier: clean };
  }

  private generateCode(): string {
    // 000000-999999 oralig'ida bir xilda taqsimlangan (modulo-bias'siz, 900000<2^32).
    return (crypto.randomInt(0, 1_000_000)).toString().padStart(6, '0');
  }

  private hashCode(identifier: string, code: string): string {
    const pepper = process.env.AUTH_JWT_SECRET || 'agentnet-dev-otp-pepper';
    return crypto.createHash('sha256').update(`${identifier}:${code}:${pepper}`).digest('hex');
  }

  private safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }
}
