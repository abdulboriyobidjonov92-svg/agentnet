import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { FeedbackStatus, PlatformPlan, UserRole } from '@prisma/client';
import { PageQueryDto } from '../../common/pagination/page-query.dto';

/**
 * Phase 4 §6.4 — admin ro'yxatlari uchun filtr/qidiruv DTO'lari.
 *
 * Hammasi `PageQueryDto`dan meros oladi: kursorli pagination shartnomasi
 * (`?limit=<=100&cursor=<id>`) barcha admin ro'yxatlarida bir xil.
 *
 * `@IsIn(Object.values(...))` — domen DB enum'idan olinadi (A14 naqshi),
 * ya'ni filtr qiymatlari sxema bilan hech qachon ayrilib keta olmaydi.
 */
export class AdminUsersQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(Object.values(UserRole))
  role?: UserRole;

  @IsOptional()
  @IsIn(Object.values(PlatformPlan))
  platformPlan?: PlatformPlan;

  /**
   * Qidiruv: email / telefon / id.
   *
   * ARCHITECTURAL_AUDIT §6.4: `contains` faqat indeks bilan — shu sabab
   * qidiruv `email`/`phone` prefiksi (`startsWith`) va ANIQ `id` bo'yicha
   * ishlaydi. `%...%` (ikki tomonlama) ATAYLAB ishlatilmaydi: u mavjud
   * `@@index([email])`/`@@index([phone])` dan foydalana olmaydi va 10k+
   * qatorda sekventsial skanga aylanadi.
   */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  /**
   * SEC-12 §6.4 — "bloklanganlar" filtri (`@@index([blockedAt])` shu uchun).
   * `'1'` — faqat bloklanganlar, `'0'` — faqat faol hisoblar.
   */
  @IsOptional()
  @IsIn(['0', '1'])
  blocked?: '0' | '1';
}

export class AdminAuditQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  actorId?: string;

  /** Amal nomi (`agent.create`, `2fa.enable`, ...) — aniq moslik. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  resourceType?: string;
}

export class AdminFeedbackQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(Object.values(FeedbackStatus))
  status?: FeedbackStatus;
}
