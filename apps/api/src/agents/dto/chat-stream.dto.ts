import { IsArray, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * SEC-10: chat oqimi endi engine'ga TO'G'RIDAN-TO'G'RI emas, API orqali boradi
 * (engine Render'da private service — Vercel'dagi BFF unga yeta olmaydi).
 *
 * MUHIM: global `ValidationPipe({ whitelist: true })` dekoratorSIZ maydonlarni
 * butunlay o'chirib yuboradi — shuning uchun engine'ga uzatiladigan HAR bir
 * maydon shu yerda e'lon qilinishi SHART (aks holda engine bo'sh xabar oladi).
 *
 * `user_id` ATAYLAB yo'q: uni API autentifikatsiyalangan foydalanuvchidan
 * (`@CurrentUser()`) oladi. Ilgari BFF uni body'da uzatardi — endi u umuman
 * so'ralmaydi, ya'ni "boshqa foydalanuvchi nomidan" yuborish yuzasi yo'qoladi.
 */
export class ChatStreamDto {
  /** Agent ta'rifi (engine sxemasi bo'yicha erkin obyekt). */
  @IsObject()
  agentDefinition: Record<string, unknown>;

  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  message: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  conversationId?: string;

  /**
   * Qaysi agent ijro etadi — ijro izi (P0-7) shu bilan bog'lanadi.
   *
   * IXTIYORIY va fail-open: berilmasa (yoki begona agent bo'lsa) chat
   * ODATDAGIDEK ishlaydi, faqat trace yozilmaydi. Trace uchun pul yo'lini
   * bloklash — noto'g'ri almashinuv.
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  agentId?: string;

  /** Oldingi xabarlar (engine kontekst uchun ishlatadi). */
  @IsOptional()
  @IsArray()
  conversationHistory?: Array<Record<string, unknown>>;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  profession?: string;
}
