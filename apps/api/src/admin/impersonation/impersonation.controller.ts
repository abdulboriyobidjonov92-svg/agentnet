import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole, type User } from '@prisma/client';
import { CurrentUser } from '../../auth/current-user.decorator';
import { Roles } from '../../auth/roles.decorator';
import { ImpersonationAdminService } from './impersonation-admin.service';
import { StartImpersonationDto } from './dto/impersonation.dto';

/**
 * SEC-12 §6.6 — impersonation yuzasi.
 *
 * `@Roles(OWNER, ADMIN, SUPPORT)` — §6.1: "Impersonation (read-only)" uchala
 * admin rolida ham ruxsat etilgan. Bu BIRINCHI darvoza; ikkinchisi servis
 * ichidagi `canImpersonateRole(actor, target)` (nishon roli aktordan qat'iy
 * past bo'lishi shart), ya'ni controller kengaytirilsa ham imtiyoz oshirish
 * yo'li ochilmaydi.
 *
 * MUHIM: bu yo'llar `@Roles(...)` bilan himoyalangani uchun IMPERSONATION
 * SESSIYASIDAN OCHILMAYDI (`RolesGuard` §10 qoidasi) — ya'ni impersonation
 * ichidan yangi impersonation boshlab bo'lmaydi (zanjir hujumi yopiq).
 * "To'xtatish" ham shu sababdan HAQIQIY operator tokeni bilan chaqiriladi.
 *
 * `@Throttle`: SEC-11 dagi bilan bir xil chegara (10/soat/operator).
 */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/impersonation')
@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.SUPPORT)
@Throttle({ default: { limit: 10, ttl: 60 * 60 * 1000 } })
export class ImpersonationController {
  constructor(private readonly impersonation: ImpersonationAdminService) {}

  /** §6.6 — boshlash: sabab + TOTP -> 30 daqiqalik read-only token. */
  @Post()
  start(@CurrentUser() user: User, @Body() dto: StartImpersonationDto) {
    return this.impersonation.start(user, dto);
  }

  /** §17 — aniq to'xtatish (haqiqiy operator tokeni bilan). */
  @Post(':id/stop')
  stop(@CurrentUser() user: User, @Param('id') id: string) {
    return this.impersonation.stop(user, id);
  }

  /** Operatorning hozirgi ochiq sessiyasi (holatni tiklash uchun). */
  @Get('current')
  current(@CurrentUser() user: User) {
    return this.impersonation.current(user);
  }

  /** §6.3 — impersonation tarixi (nazorat). */
  @Get('history')
  history(@Query('limit') limit?: string) {
    return this.impersonation.history(limit ? Number(limit) : undefined);
  }
}
