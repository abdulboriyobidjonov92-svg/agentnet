import { IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ToolSpecDto } from '../../agents/dto/create-agent.dto';

export class OnboardingDto {
  @ApiProperty({ description: "Foydalanuvchi o'zi haqida erkin matn" })
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  text: string;

  @ApiProperty({ enum: ['en', 'ru', 'uz'], default: 'en' })
  @IsOptional()
  @IsIn(['en', 'ru', 'uz'])
  language?: string = 'en';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;
}

export class InstallAgentDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(100) name: string;
  @ApiProperty() @IsString() @MinLength(1) systemPrompt: string;

  @ApiProperty({ type: [ToolSpecDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ToolSpecDto)
  toolsConfig?: ToolSpecDto[] = [];
}

export class InstallRecommendationsDto {
  @ApiProperty({ type: [InstallAgentDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InstallAgentDto)
  agents: InstallAgentDto[];
}
