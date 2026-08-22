import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { MeteringService } from './metering.service';
import type { User } from '@prisma/client';

/** `?from=&to=` — ISO sana. Yaroqsiz qiymat JIM e'tiborsiz qoldiriladi. */
function parseRange(from?: string, to?: string) {
  const parse = (v?: string) => {
    if (!v) return undefined;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? undefined : d;
  };
  return { from: parse(from), to: parse(to) };
}

@ApiTags('usage')
@ApiBearerAuth()
@Controller('usage')
export class UsageSummaryController {
  constructor(private readonly metering: MeteringService) {}

  /**
   * Foydalanuvchining o'z sarfi.
   *
   * ⚠️ `internalCostTiyin` bu yerda YO'Q — u ichki ma'lumot (marja
   * tijorat siri). Servis uni umuman qaytarmaydi.
   */
  @Get('summary')
  summary(@CurrentUser() user: User, @Query('from') from?: string, @Query('to') to?: string) {
    return this.metering.summaryForUser(user, parseRange(from, to));
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/economy')
export class AdminEconomyController {
  constructor(private readonly metering: MeteringService) {}

  /**
   * V3-P0 EXIT GATE **G0.2** — "real gross margin raqami MAVJUD".
   *
   * `@Roles(OWNER, ADMIN)` → SEC-11 avtomatik `twoFactorEnabled` ni ham
   * talab qiladi.
   */
  @Get('margin')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  margin(@Query('from') from?: string, @Query('to') to?: string) {
    return this.metering.marginSummary(parseRange(from, to));
  }
}
