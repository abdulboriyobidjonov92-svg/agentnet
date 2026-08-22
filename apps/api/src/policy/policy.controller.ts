import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApprovalDecision, UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { PageQueryDto } from '../common/pagination/page-query.dto';
import { ApprovalService } from './approval.service';
import { GLOBAL_KILL_PHRASE, KillSwitchService } from './kill-switch.service';
import type { User } from '@prisma/client';

export class KillAgentDto {
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class GlobalKillDto {
  /** Yozib tasdiqlash — aynan `KILL ALL AGENTS` (§6.5 ruhida). */
  @IsIn([GLOBAL_KILL_PHRASE]) confirm!: string;
  /** Sabab majburiy, kamida 20 belgi (§6.5). */
  @IsString() @MinLength(20) @MaxLength(500) reason!: string;
}

export class DecideApprovalDto {
  @IsEnum(ApprovalDecision) decision!: ApprovalDecision;
  /** `MODIFIED` uchun MAJBURIY (servis tekshiradi). */
  @IsOptional() modifiedAction?: unknown;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

/**
 * P0-6 — kill switch va tasdiq endpointlari.
 *
 * Guard matritsasi (CLAUDE.md): oddiy foydalanuvchi endpointi — global
 * `AuthGuard`+`RolesGuard` yetarli. Global kill `@Roles(OWNER)` bilan, ya'ni
 * SEC-11 avtomatik `twoFactorEnabled` ni ham talab qiladi.
 */
@ApiTags('policy')
@ApiBearerAuth()
@Controller()
export class PolicyController {
  constructor(
    private readonly killSwitch: KillSwitchService,
    private readonly approvals: ApprovalService,
  ) {}

  /** Agentni DARHOL to'xtatadi (SAFETY §4). Egasi yoki OWNER/ADMIN. */
  @Post('agents/:id/kill')
  kill(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: KillAgentDto) {
    return this.killSwitch.kill(user, id, dto.reason);
  }

  /** Qayta faollashtirish — ATAYLAB alohida amal (avtomatik tiklanish yo'q). */
  @Post('agents/:id/resume')
  resume(@CurrentUser() user: User, @Param('id') id: string) {
    return this.killSwitch.resume(user, id);
  }

  /** Butun platformani to'xtatadi. Faqat OWNER + yozib tasdiqlash + sabab. */
  @Post('admin/kill-switch/global')
  @Roles(UserRole.OWNER)
  globalKill(@CurrentUser() user: User, @Body() dto: GlobalKillDto) {
    return this.killSwitch.globalKill(user, dto);
  }

  @Get('approvals')
  listPending(@CurrentUser() user: User, @Query() page: PageQueryDto) {
    return this.approvals.listPending(user, page);
  }

  @Post('approvals/:id/decide')
  decide(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: DecideApprovalDto,
  ) {
    return this.approvals.decide(user, id, dto);
  }
}
