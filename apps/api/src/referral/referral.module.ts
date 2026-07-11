import { Module } from '@nestjs/common';
import { ReferralController } from './referral.controller';
import { ReferralService } from './referral.service';
import { ClerkGuard } from '../auth/clerk.guard';

// MUHIM: AuthModule import QILINMAYDI — AuthModule o'zi bu modulni import qiladi
// (OtpService signup'da applyReferralOnSignup chaqiradi). ClerkGuard faqat
// PrismaService'ga bog'liq (global), shuning uchun bevosita provide qilinadi.
@Module({
  controllers: [ReferralController],
  providers: [ReferralService, ClerkGuard],
  exports: [ReferralService],
})
export class ReferralModule {}
