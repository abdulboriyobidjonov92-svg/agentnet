import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(80) name: string;

  @ApiProperty({ required: false, description: 'Bo\'sh qoldirilsa name\'dan avtomatik hosil qilinadi' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: 'slug faqat kichik lotin harflar, raqam va tire' })
  @MaxLength(100)
  slug?: string;

  @ApiProperty({ enum: ['agent', 'product'], required: false, default: 'product' })
  @IsOptional()
  @IsIn(['agent', 'product'])
  type?: string;

  @ApiProperty({ required: false, description: 'Emoji yoki ikonka kaliti' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  icon?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  order?: number;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
