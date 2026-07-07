import { IsString, IsOptional, IsIn, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** Y9: bir-klik agent — foydalanuvchi tabiiy tildagi tavsifi. */
export class ComposeAgentDto {
  @ApiProperty({ example: "Do'konim uchun tovar hisobini yurituvchi yordamchi kerak" })
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  description: string;

  @ApiProperty({ required: false, enum: ['en', 'ru', 'uz'] })
  @IsOptional()
  @IsIn(['en', 'ru', 'uz'])
  language?: string;
}
