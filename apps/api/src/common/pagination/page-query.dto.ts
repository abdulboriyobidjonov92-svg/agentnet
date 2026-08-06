import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { MAX_PAGE_LIMIT } from './paginate';

/**
 * Phase 3 — kursorli pagination shartnomasi (Engineering Contract A18 / ADR-009,
 * Konstitutsiya qoidasi #24: "Har ro'yxat endpointi kursorli pagination bilan;
 * `limit` maksimumi 100").
 *
 * Ishlatish (controller):
 *   `list(@CurrentUser() user: User, @Query() page: PageQueryDto)`
 *
 * `@Type(() => Number)` SHART: query parametrlari doim string bo'lib keladi,
 * global `ValidationPipe({ transform: true })` esa aynan shu dekorator orqali
 * songa o'giradi. Usiz `@IsInt()` har doim yiqilardi.
 *
 * Offset (`skip`/`page=N`) ATAYLAB YO'Q — Contract uni taqiqlaydi: chuqur
 * sahifada sekin va jonli ma'lumotda dublikat/yo'qolgan qator beradi.
 */
export class PageQueryDto {
  /** Sahifa hajmi. Bo'lmasa `DEFAULT_PAGE_LIMIT` (30), maksimum 100. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_LIMIT)
  limit?: number;

  /**
   * Oldingi sahifaning `nextCursor` qiymati (oxirgi qatorning `id`si).
   * Eskirgan/yaroqsiz kursor xato BERMAYDI — bo'sh sahifa qaytadi
   * (`paginate` izohiga qarang).
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  cursor?: string;
}
