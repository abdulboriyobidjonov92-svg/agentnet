import {
  Controller,
  Post,
  Body,
  HttpCode,
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuditLogService, AuthService, TwoFactorService } from './auth.service';
import { OtpService } from './otp.service';
import { GoogleOAuthService } from './google-oauth.service';
import { CurrentUser } from './current-user.decorator';
import { Public } from './public.decorator';
import { ReferralService } from '../referral/referral.service';
import type { User } from '@prisma/client';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly twoFactor: TwoFactorService,
    private readonly otp: OtpService,
    private readonly google: GoogleOAuthService,
    private readonly auditLog: AuditLogService,
    private readonly referral: ReferralService,
  ) {}

  /**
   * Lokal dev login — tashqi provayder ishlatilmaydi, email YOKI telefon bilan kirish/ro'yxatdan o'tish.
   * FAQAT NODE_ENV!==production. Real login endi /auth/otp/* orqali — parol/OTP'siz
   * hech kimning hisobiga kirib bo'lmaydi (avvalgi zaiflik shu yerda yopildi).
   */
  @Post('dev-login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Public()
  @HttpCode(200)
  async devLogin(@Body() body: { email?: string; phone?: string; name?: string }) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('dev-login production ortamida faol emas');
    }
    return this.auth.devLogin(body);
  }

  /** 1-qadam: email yoki telefonga bir martalik kirish kodi yuboradi */
  @Post('otp/request')
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) // kod-spam'ga qarshi
  @Public()
  @HttpCode(200)
  async requestOtp(@Body() body: { email?: string; phone?: string }) {
    return this.otp.requestOtp(body);
  }

  /**
   * 2-qadam: kodni tasdiqlaydi. Agar hisobda 2FA yoqilgan bo'lsa, token darhol
   * berilmaydi — needsTwoFactor qaytadi, frontend /auth/2fa/login-verify'ni chaqiradi.
   */
  @Post('otp/verify')
  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // kod-taxminlashga qarshi
  @Public()
  @HttpCode(200)
  async verifyOtp(@Body() body: { email?: string; phone?: string; code: string; name?: string; ref?: string }) {
    return this.otp.verifyOtp(body);
  }

  /**
   * Google "Continue with" — BFF (`/api/auth/google/callback` route) Google'dan
   * olgan `code`ni shu yerga uzatadi (server-server, brauzer buni ko'rmaydi).
   * Javob shakli OTP `verify` bilan AYNAN bir xil (`needsTwoFactor` yoki
   * to'liq sessiya) — frontend ikkalasini bitta `finishLogin` bilan qabul
   * qiladi.
   */
  @Post('google/exchange')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Public()
  @HttpCode(200)
  async googleExchange(@Body() body: { code?: string; redirectUri?: string; ref?: string }) {
    if (!body.code || !body.redirectUri) {
      throw new BadRequestException('code va redirectUri majburiy');
    }
    const profile = await this.google.exchangeCode(body.code, body.redirectUri);
    if (!profile) {
      throw new ServiceUnavailableException({
        statusCode: 503,
        reason: 'google_oauth_failed',
        message: "Google orqali kirib bo'lmadi, birozdan so'ng qayta urinib ko'ring",
      });
    }

    const { user, isNewUser } = await this.auth.findOrCreateUser(
      { email: profile.email, name: profile.name },
      { action: 'auth.google_login' },
    );

    // Referral-bonus — FAQAT yangi foydalanuvchi, best-effort (OtpService.verifyOtp bilan bir xil naqsh)
    if (isNewUser && body.ref) {
      await this.referral.applyReferralOnSignup(user.id, body.ref).catch(() => undefined);
    }

    if (user.twoFactorEnabled) {
      await this.auditLog.record({
        actorId: user.id,
        action: 'auth.google_verified_pending_2fa',
        resourceType: 'user',
        resourceId: user.id,
      });
      return { needsTwoFactor: true, userId: user.id };
    }

    return { needsTwoFactor: false, ...this.auth.issueSession(user, isNewUser) };
  }

  /** 2FA yoqilgan hisoblar uchun login'ning yakuniy qadami — TOTP kodni tekshiradi */
  @Post('2fa/login-verify')
  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // TOTP-kodni taxminlashga qarshi
  @Public()
  @HttpCode(200)
  async loginVerify2fa(@Body() body: { userId: string; token: string }) {
    return this.otp.completeTwoFactorLogin(body.userId, body.token);
  }

  /** 2FA sozlash — QR kod va secret qaytaradi. Faqat autentifikatsiya qilingan foydalanuvchi uchun. */
  @Post('2fa/setup')
  async setup2fa(@CurrentUser() user: User) {
    return this.twoFactor.generateSecret(user.id, user.email);
  }

  /** 2FA tasdiqlash va yoqish. Faqat autentifikatsiya qilingan foydalanuvchi o'zi uchun. */
  @Post('2fa/verify')
  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // TOTP-kodni taxminlashga qarshi
  async verify2fa(@CurrentUser() user: User, @Body() body: { token: string }) {
    const ok = await this.twoFactor.verifyAndEnable(user.id, body.token);
    return { success: ok };
  }

  /**
   * SEC-03 AC#5 — joriy sessiyani jimgina (bir marta) yangilaydi: yangi
   * 7-kunlik token qaytaradi, tokenVersion o'zgarmaydi. AuthGuard bilan
   * himoyalangan — joriy token allaqachon bekor qilingan (tv mos kelmagan)
   * bo'lsa bu yerga umuman yetib kelmaydi (401 guard darajasida).
   */
  @Post('session/refresh')
  refreshSession(@CurrentUser() user: User) {
    return this.auth.refreshSession(user);
  }
}
