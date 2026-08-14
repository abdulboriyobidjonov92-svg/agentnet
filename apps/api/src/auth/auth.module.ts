import { Module } from '@nestjs/common';
import { AuditLogService, TwoFactorService, AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { OtpService } from './otp.service';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';
import { GoogleOAuthService } from './google-oauth.service';
import { ImpersonationService } from './impersonation.service';
import { ReferralModule } from '../referral/referral.module';

@Module({
  imports: [ReferralModule], // OtpService + AuthController (Google) signup'da referral-bonusni qo'llaydi
  controllers: [AuthController],
  providers: [
    AuditLogService,
    TwoFactorService,
    AuthService,
    OtpService,
    EmailService,
    SmsService,
    GoogleOAuthService,
    // SEC-12: impersonation sessiyasining server-tomon hayoti. Aynan shu
    // yerda (admin modulida emas), chunki global `AuthGuard` uni HAR
    // so'rovda chaqiradi, guard'ning o'zida esa Prisma taqiqlangan (#22).
    ImpersonationService,
  ],
  exports: [AuditLogService, TwoFactorService, AuthService, OtpService, ImpersonationService],
})
export class AuthModule {}
