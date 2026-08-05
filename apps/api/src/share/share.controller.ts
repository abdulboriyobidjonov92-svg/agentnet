import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ClerkGuard } from '../auth/clerk.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { ShareService } from './share.service';
import type { User } from '@prisma/client';

class CreateShareBody {
  @ApiProperty({ required: false, enum: ['retail_forecast', 'twin', 'goal', 'generic'] })
  @IsOptional()
  @IsIn(['retail_forecast', 'twin', 'goal', 'generic'])
  kind?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  subtitle?: string;

  @ApiProperty({ required: false, type: 'array', items: { type: 'object' } })
  @IsOptional()
  @IsArray()
  metrics?: { label: string; value: string; hint?: string }[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  body?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  locale?: string;
}

@ApiTags('share')
@Controller('share')
export class ShareController {
  constructor(private readonly share: ShareService) {}

  /** Natijani ulashish uchun public token yaratadi (faqat autentifikatsiya qilingan). */
  @Post()
  @ApiBearerAuth()
  @UseGuards(ClerkGuard)
  @HttpCode(200)
  create(@CurrentUser() user: User, @Body() body: CreateShareBody) {
    return this.share.create(user, body);
  }

  /** Ulashilgan natijani ochadi — PUBLIC, kirishsiz (guard yo'q). */
  @Get(':token')
  @Public()
  getPublic(@Param('token') token: string) {
    return this.share.getPublic(token);
  }
}
