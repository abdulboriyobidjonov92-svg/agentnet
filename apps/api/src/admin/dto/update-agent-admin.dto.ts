import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Min, MaxLength } from 'class-validator';

/**
 * Admin panelidan istalgan foydalanuvchining agentini moderatsiya qilish uchun
 * — oddiy agents.controller PATCH'idan farqli, egasi tekshirilmaydi (faqat
 * AdminGuard). Faqat moderatsiya maydonlari — systemPrompt/toolsConfig kabi
 * mazmun agent egasining o'ziga tegishli bo'lib qoladi.
 */
export class UpdateAgentAdminDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(100) name?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() isPublished?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() verified?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() frozen?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() halalFilterEnabled?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsInt() @Min(0) marketplacePrice?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() categoryId?: string | null;
}
