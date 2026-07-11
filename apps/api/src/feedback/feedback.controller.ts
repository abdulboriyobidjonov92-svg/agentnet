import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ClerkGuard } from '../auth/clerk.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { FeedbackService } from './feedback.service';
import type { User } from '@prisma/client';

class SubmitFeedbackDto {
  @ApiProperty({ enum: ['suggestion', 'bug', 'question'], required: false })
  @IsOptional()
  @IsIn(['suggestion', 'bug', 'question'])
  kind?: string;

  @ApiProperty({ description: 'Fikr/shikoyat/savol matni' })
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  message: string;

  @ApiProperty({ required: false, description: 'Qaysi sahifadan yuborilgan' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  page?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  locale?: string;
}

@ApiTags('feedback')
@ApiBearerAuth()
@UseGuards(ClerkGuard)
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  /** Foydalanuvchi fikr yuboradi (har sahifadagi "Fikr bildirish" tugmasidan). */
  @Post()
  @HttpCode(200)
  submit(@CurrentUser() user: User, @Body() dto: SubmitFeedbackDto) {
    return this.feedback.submit(user, dto);
  }

  /** Admin ro'yxati — faqat OWNER roli. */
  @Get()
  list(@CurrentUser() user: User, @Query('limit') limit?: string) {
    this.assertAdmin(user);
    return this.feedback.list(limit ? Number(limit) : undefined);
  }

  /** Admin holatni yangilaydi (seen/resolved) — faqat OWNER roli. */
  @Patch(':id/status')
  setStatus(@CurrentUser() user: User, @Param('id') id: string, @Body() body: { status: string }) {
    this.assertAdmin(user);
    return this.feedback.setStatus(id, body.status);
  }

  private assertAdmin(user: User) {
    if (user.role !== 'OWNER') throw new ForbiddenException('Faqat admin uchun');
  }
}
