import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole, type User } from '@prisma/client';
import { CurrentUser } from '../../auth/current-user.decorator';
import { Roles } from '../../auth/roles.decorator';
import { PageQueryDto } from '../../common/pagination/page-query.dto';
import { DangerousActionService } from './dangerous-action.service';
import { DangerousActionQueryService } from './dangerous-action-query.service';
import {
  ConfirmDangerousActionDto,
  CreateDangerousActionDto,
} from './dto/dangerous-action.dto';

/**
 * SEC-11 §6.5 — xavfli amallar yuzasi.
 *
 * `@Roles(OWNER)`: hozirgi ikkala amal ham §6.1 matritsasida FAQAT OWNER
 * (rol tayinlash · sessiyalarni ommaviy bekor qilish). Bu — BIRINCHI
 * darvoza; ikkinchisi registrdagi `allowedRoles` (servis ichida), ya'ni
 * controller kengaytirilsa ham amal o'z chegarasini saqlaydi.
 *
 * `@Throttle`: §6.5 "admin xavfli amallari — 10/soat/admin".
 */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/dangerous-actions')
@Roles(UserRole.OWNER)
@Throttle({ default: { limit: 10, ttl: 60 * 60 * 1000 } })
export class DangerousActionController {
  constructor(
    private readonly dangerous: DangerousActionService,
    private readonly query: DangerousActionQueryService,
  ) {}

  /** 1-bosqich: sabab + TOTP + yozib tasdiqlash -> `pending` yozuv. */
  @Post()
  request(@CurrentUser() user: User, @Body() dto: CreateDangerousActionDto) {
    return this.dangerous.request(user, dto);
  }

  /** 2-bosqich: TOTP qayta -> amal bajariladi (`executed`). */
  @Post(':id/execute')
  execute(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: ConfirmDangerousActionDto,
  ) {
    return this.dangerous.execute(user, id, dto);
  }

  /** Bekor qilish oynasi ichida -> `cancelled`. */
  @Post(':id/cancel')
  cancel(@CurrentUser() user: User, @Param('id') id: string) {
    return this.dangerous.cancel(user, id);
  }

  /** Xavfli amallar tarixi (kursorli) — nazorat uchun. */
  @Get()
  list(@Query() page: PageQueryDto) {
    return this.query.list(page);
  }
}
