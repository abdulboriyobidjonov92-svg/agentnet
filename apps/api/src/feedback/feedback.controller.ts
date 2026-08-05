import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { FeedbackService } from './feedback.service';
import { UserRole, type User } from '@prisma/client';

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
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  /** Foydalanuvchi fikr yuboradi (har sahifadagi "Fikr bildirish" tugmasidan). */
  @Post()
  @HttpCode(200)
  submit(@CurrentUser() user: User, @Body() dto: SubmitFeedbackDto) {
    return this.feedback.submit(user, dto);
  }

  /**
   * Admin ro'yxati — faqat OWNER roli.
   * SEC-05: ilgari bu yerda inline `assertAdmin()` tekshiruvi bor edi —
   * endi global `RolesGuard` majburlaydi (AC #5).
   */
  @Get()
  @Roles(UserRole.OWNER)
  list(@Query('limit') limit?: string) {
    return this.feedback.list(limit ? Number(limit) : undefined);
  }

  /** Admin holatni yangilaydi (seen/resolved) — faqat OWNER roli. */
  @Patch(':id/status')
  @Roles(UserRole.OWNER)
  setStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.feedback.setStatus(id, body.status);
  }
}
