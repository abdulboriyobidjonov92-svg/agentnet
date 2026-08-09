import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsOptional, IsString, Length, MaxLength, MinLength } from 'class-validator';
import { DangerousActionKind, UserRole } from '@prisma/client';

/**
 * SEC-11 §6.5 — xavfli amal so'rovi.
 *
 * Uchala majburiy dalil (sabab, TOTP, yozib tasdiqlash) SHU DTO'da:
 * ular ixtiyoriy emas, ya'ni "unutilgan tekshiruv" mumkin emas — so'rov
 * global `ValidationPipe` darajasida rad etiladi.
 */
export class CreateDangerousActionDto {
  @IsEnum(DangerousActionKind)
  kind: DangerousActionKind;

  /** Amal qaratilgan foydalanuvchi. */
  @IsString()
  @Length(1, 64)
  targetUserId: string;

  /**
   * §6.5(1) — sabab, MINIMUM 20 belgi.
   *
   * `@Transform` bilan avval trim qilinadi: aks holda 20 ta probel
   * tekshiruvdan o'tib ketardi (bo'sh sabab = sababsiz amal).
   */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(20, { message: "Sabab kamida 20 belgi bo'lishi shart" })
  @MaxLength(2000)
  reason: string;

  /**
   * §6.5(2) — TOTP qayta-autentifikatsiya kodi.
   * Mavjud `TwoFactorService` bilan tekshiriladi (ikkinchi auth mexanizmi
   * YARATILMAYDI).
   */
  @IsString()
  @Length(6, 6, { message: "TOTP kodi 6 xonali bo'lishi shart" })
  totp: string;

  /**
   * §6.5(3) — qo'lda yozib tasdiqlash (`ROLE user_abc123` naqshi).
   * Server kutilgan satrni O'ZI hisoblaydi va aynan solishtiradi —
   * `confirmed: true` kabi mijoz bayrog'iga ISHONILMAYDI.
   */
  @IsString()
  @MaxLength(200)
  confirmation: string;

  /**
   * `role_assign` uchun yangi rol. Boshqa amallarda berilmaydi.
   * VIEWER/MEMBER/SUPPORT/ADMIN/OWNER — `UserRole` domeni.
   */
  @IsOptional()
  @IsIn(Object.values(UserRole))
  newRole?: UserRole;
}

/**
 * Bajarish/bekor qilish — TOTP QAYTA so'raladi.
 *
 * NEGA: tasdiq 24 soat yashaydi. Agar bajarish bosqichida qayta-auth
 * bo'lmasa, o'g'irlangan sessiya oyna ichida tasdiqlangan amalni
 * kodsiz ijro etardi — ya'ni §6.5(2) ning ma'nosi yo'qolardi.
 */
export class ConfirmDangerousActionDto {
  @IsString()
  @Length(6, 6, { message: "TOTP kodi 6 xonali bo'lishi shart" })
  totp: string;
}
