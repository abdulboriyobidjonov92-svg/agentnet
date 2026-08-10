import { Module } from '@nestjs/common';
import { ReferralController } from './referral.controller';
import { ReferralService } from './referral.service';

// MUHIM: AuthModule import QILINMAYDI — AuthModule o'zi bu modulni import
// qiladi (OtpService signup'da applyReferralOnSignup chaqiradi), ya'ni
// teskari import aylanma bog'liqlik yasardi.
//
// SEC-13: ilgari bu yerda `AuthGuard` provider sifatida turardi ("faqat
// PrismaService'ga bog'liq" degan faraz bilan). SEC-12 unga
// `ImpersonationService`ni qo'shgach, o'sha faraz buzildi va butun API
// boot'da yiqildi. Guard SEC-05 (Option B) dan beri `APP_GUARD` sifatida
// GLOBAL — modul darajasidagi nusxa umuman kerak emas edi.
@Module({
  controllers: [ReferralController],
  providers: [ReferralService],
  exports: [ReferralService],
})
export class ReferralModule {}
