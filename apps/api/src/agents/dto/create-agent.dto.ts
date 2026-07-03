import {
  IsString, IsBoolean, IsArray, IsOptional, IsIn,
  MinLength, MaxLength, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ToolSpecDto {
  @IsString() tool_id: string;
  @IsOptional() config?: Record<string, unknown>;
}

export class CreateAgentDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(100) name: string;
  @ApiProperty() @IsString() @MinLength(1) systemPrompt: string;

  @ApiProperty({ enum: ['claude-sonnet-4-6', 'claude-haiku-4-5', 'claude-opus-4-8'] })
  @IsOptional()
  @IsIn(['claude-sonnet-4-6', 'claude-haiku-4-5', 'claude-opus-4-8'])
  model?: string = 'claude-sonnet-4-6';

  @ApiProperty({ default: true })
  @IsOptional() @IsBoolean()
  halalFilterEnabled?: boolean = true;

  @ApiProperty({ default: true })
  @IsOptional() @IsBoolean()
  memoryEnabled?: boolean = true;

  @ApiProperty({ type: [ToolSpecDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ToolSpecDto)
  toolsConfig?: ToolSpecDto[] = [];

  // S3: vertical compliance pack (healthcare|finance|government|legal|retail|trade)
  @ApiProperty({ required: false })
  @IsOptional()
  @IsIn(['healthcare', 'finance', 'government', 'legal', 'retail', 'trade'])
  vertical?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString() @MaxLength(300)
  description?: string;
}
