import { Module } from '@nestjs/common';
import { AuditLogService, TwoFactorService, ClerkSyncService } from './auth.service';
import { AuthController } from './auth.controller';
import { OtpService } from './otp.service';
import { GoogleAuthService } from './google.service';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';
import { ReferralModule } from '../referral/referral.module';

@Module({
  imports: [ReferralModule], // OtpService signup'da referral-bonusni qo'llaydi
  controllers: [AuthController],
  providers: [
    AuditLogService,
    TwoFactorService,
    ClerkSyncService,
    OtpService,
    GoogleAuthService,
    EmailService,
    SmsService,
  ],
  exports: [AuditLogService, TwoFactorService, ClerkSyncService, OtpService],
})
export class AuthModule {}
