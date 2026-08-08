import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { MessageRole } from '@prisma/client';

/**
 * A15 — bitta xabar (POST /conversations/:id/messages).
 *
 * Ilgari controller `message: any` qabul qilib `...message` bilan JSON'ga
 * yozardi — ya'ni istalgan kalit saqlanardi. Endi jadval normallashgan va
 * DTO domenni ANIQ belgilaydi (A14 naqshi: `@IsIn(Object.values(...))` —
 * validatsiya domeni DB enum'idan olinadi, drift mumkin emas).
 */
export class AddMessageDto {
  @IsIn(Object.values(MessageRole))
  role: MessageRole;

  // Bo'sh satrga ruxsat: assistant xabari xato-fallback holatida '' bo'lishi
  // mumkin (agents.service run() shunday yozadi).
  @IsString()
  @MaxLength(100_000)
  content: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  halalFlag?: string;

  /** Engine demo rejimda javob bergan (pul qaytarilgan) — frontend yuboradi. */
  @IsOptional()
  @IsBoolean()
  demoMode?: boolean;

  /** Mijoz vaqti (ixtiyoriy) — berilmasa server vaqti ishlatiladi. */
  @IsOptional()
  @IsISO8601()
  timestamp?: string;
}

/** A15 — bir nechta xabar birdaniga (POST /conversations/:id/messages/bulk). */
export class AddMessagesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddMessageDto)
  messages: AddMessageDto[];
}
