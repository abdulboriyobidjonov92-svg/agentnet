import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min, Max, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export const TWIN_CATEGORIES = ['health', 'finance', 'family', 'work', 'habits', 'education', 'other'] as const;

export class AddFactDto {
  @ApiProperty({ enum: TWIN_CATEGORIES })
  @IsIn(TWIN_CATEGORIES as unknown as string[])
  category: string;

  @ApiProperty() @IsString() @MinLength(1) @MaxLength(80) label: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(300) value: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsIn(['onboarding', 'conversation', 'manual', 'agent'])
  source?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsNumber() @Min(0) @Max(1)
  confidence?: number;
}

export class WhatIfDto {
  @ApiProperty() @IsString() @MinLength(5) @MaxLength(1000) question: string;
}

export class ExtractDto {
  @ApiProperty() @IsString() @MinLength(5) @MaxLength(4000) text: string;
}
