import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * SEC-05 prerequisite — `PATCH /users/me` uchun HAQIQIY DTO klassi.
 *
 * Ilgari bu endpoint `@Body()`ni oddiy inline TypeScript tipi bilan qabul
 * qilardi. Global `ValidationPipe({ whitelist: true })` faqat class-validator
 * METADATASI bo'lgan klasslarni filtrlaydi — inline tipda metadata yo'q,
 * shuning uchun whitelist umuman ishlamasdi va xom body `updateProfile()`da
 * Prisma `data`ga to'g'ridan-to'g'ri yoyilardi (mass-assignment).
 *
 * Jonli tasdiqlangan oqibat: `{"role":"OWNER"}` va `{"balanceTiyin":999999999}`
 * muvaffaqiyatli yozilardi — ya'ni istalgan foydalanuvchi o'zini platforma
 * OWNER'i qilishi yoki balansini xohlagancha oshirishi mumkin edi.
 *
 * Bu klass ruxsat etilgan TO'RTTA maydonni aniq e'lon qiladi; boshqa har
 * qanday maydon (role, balanceTiyin, plan, tokenVersion, ...) whitelist
 * tomonidan JIMGINA OLIB TASHLANADI.
 */
export class UpdateProfileDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isBusinessAccount?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  tourCompleted?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  briefingOptIn?: boolean;
}
