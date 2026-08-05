import { Module } from '@nestjs/common';
import { AuditLogService, TwoFactorService, AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { OtpService } from './otp.service';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';
import { ReferralModule } from '../referral/referral.module';

@Module({
  imports: [ReferralModule], // OtpService signup'da referral-bonusni qo'llaydi
  controllers: [AuthController],
  providers: [AuditLogService, TwoFactorService, AuthService, OtpService, EmailService, SmsService],
  exports: [AuditLogService, TwoFactorService, AuthService, OtpService],
})
export class AuthModule {}
