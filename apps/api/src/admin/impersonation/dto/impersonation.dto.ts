import { Transform } from 'class-transformer';
import { IsString, Length, MaxLength, MinLength } from 'class-validator';
import { IMPERSONATION_MIN_REASON } from '../../../auth/impersonation.policy';

/**
 * SEC-12 §6.6 — impersonation boshlash so'rovi.
 *
 * SABAB (§6.6 "sabab majburiy") SEC-11 (§6.5(1)) bilan AYNAN bir xil
 * konvensiyada: trim + minimum 20 belgi. Contract impersonation uchun
 * boshqa chegara bermaydi, shuning uchun mavjud qoida takrorlanadi —
 * "impersonation uchun bo'shroq sabab" degan jim istisno yaratilmaydi.
 *
 * TOTP — Contract §6.6 da NOMMA-NOM talab qilinmagan, LEKIN bu yerda
 * MAJBURIY qilingan (ataylab kuchaytirilgan, `impersonation-admin.service.ts`
 * izohiga qarang). Kuchaytirish hech kimni qulflab qo'ymaydi: 2FA'ni har
 * kim `/auth/2fa/*` orqali o'zi yoqadi.
 */
export class StartImpersonationDto {
  /** Ko'riladigan foydalanuvchi. */
  @IsString()
  @Length(1, 64)
  targetUserId: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(IMPERSONATION_MIN_REASON, {
    message: `Sabab kamida ${IMPERSONATION_MIN_REASON} belgi bo'lishi shart`,
  })
  @MaxLength(2000)
  reason: string;

  @IsString()
  @Length(6, 6, { message: "TOTP kodi 6 xonali bo'lishi shart" })
  totp: string;
}
