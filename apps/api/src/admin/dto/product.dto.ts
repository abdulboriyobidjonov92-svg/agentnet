import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Min, MaxLength, MinLength } from 'class-validator';

export class CreateProductDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(120) name: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(64) sku: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ description: 'UZS tiyin', required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  priceTiyin?: number;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  imageUrl?: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  categoryId?: string;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}
