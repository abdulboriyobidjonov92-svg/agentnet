import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  Req,
  BadRequestException,
  ForbiddenException,
  type RawBodyRequest,
} from '@nestjs/common';
import type { Request } from 'express';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { Webhook } from 'svix';
import { ClerkSyncService, TwoFactorService } from './auth.service';
import { OtpService } from './otp.service';
import { CurrentUser } from './current-user.decorator';
import { Public } from './public.decorator';
import type { User } from '@prisma/client';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly clerkSync: ClerkSyncService,
    private readonly twoFactor: TwoFactorService,
    private readonly otp: OtpService,
  ) {}

  /** Clerk webhook — foydalanuvchi yaratish/o'chirish eventlarini qabul qiladi */
  @Post('webhooks/clerk')
  @SkipThrottle() // Clerk serverlaridan keladi (svix imzosi bilan tekshiriladi)
  @Public()
  @HttpCode(200)
  async clerkWebhook(
    @Headers('svix-id') svixId: string,
    @Headers('svix-timestamp') svixTimestamp: string,
    @Headers('svix-signature') svixSignature: string,
    // Imzo XOM baytlar ustida tekshiriladi — @Body() bu yerda ishlamaydi
    // (parsed obyekt .toString() da "[object Object]" bo'lib, imzo doim
    // yiqilardi). req.rawBody main.ts'dagi `rawBody: true` bilan to'ladi.
    @Req() req: RawBodyRequest<Request>,
  ) {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    if (!webhookSecret) throw new BadRequestException('Webhook secret sozlanmagan');
    if (!req.rawBody) throw new BadRequestException('Xom so\'rov tanasi mavjud emas');

    const wh = new Webhook(webhookSecret);
    let event: any;
    try {
      event = wh.verify(req.rawBody.toString('utf8'), {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      });
    } catch {
      throw new BadRequestException("Webhook imzosi noto'g'ri");
    }

    await this.clerkSync.handleWebhook(event);
    return { received: true };
  }

  /**
   * Lokal dev login — Clerk'siz, email YOKI telefon bilan kirish/ro'yxatdan o'tish.
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
    return this.clerkSync.devLogin(body);
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
   * 7-kunlik token qaytaradi, tokenVersion o'zgarmaydi. ClerkGuard bilan
   * himoyalangan — joriy token allaqachon bekor qilingan (tv mos kelmagan)
   * bo'lsa bu yerga umuman yetib kelmaydi (401 guard darajasida).
   */
  @Post('session/refresh')
  refreshSession(@CurrentUser() user: User) {
    return this.clerkSync.refreshSession(user);
  }
}
