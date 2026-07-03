import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClerkGuard } from '../auth/clerk.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { OperationsService } from './operations.service';
import type { User } from '@prisma/client';

@ApiTags('operations')
@ApiBearerAuth()
@UseGuards(ClerkGuard)
@Controller('operations')
export class OperationsController {
  constructor(private readonly ops: OperationsService) {}

  // Xodimlar
  @Get('employees')
  employees(@CurrentUser() user: User) {
    return this.ops.listEmployees(user);
  }

  @Post('employees')
  addEmployee(@CurrentUser() user: User, @Body() body: any) {
    return this.ops.addEmployee(user, body);
  }

  @Delete('employees/:id')
  removeEmployee(@CurrentUser() user: User, @Param('id') id: string) {
    return this.ops.removeEmployee(user, id);
  }

  // Jadval
  @Post('schedule/generate')
  generate(@CurrentUser() user: User, @Body() body: { instructions: string; weekStart?: string }) {
    return this.ops.generateSchedule(user, body.instructions, body.weekStart);
  }

  @Get('shifts')
  shifts(@CurrentUser() user: User, @Query('from') from?: string, @Query('to') to?: string) {
    return this.ops.listShifts(user, from, to);
  }

  @Patch('shifts/:id/status')
  shiftStatus(@CurrentUser() user: User, @Param('id') id: string, @Body() body: { status: string }) {
    return this.ops.setShiftStatus(user, id, body.status);
  }

  // Ta'til
  @Get('timeoff')
  timeoff(@CurrentUser() user: User) {
    return this.ops.listTimeOff(user);
  }

  @Post('timeoff')
  requestTimeOff(@CurrentUser() user: User, @Body() body: any) {
    return this.ops.requestTimeOff(user, body);
  }

  @Patch('timeoff/:id')
  decideTimeOff(@CurrentUser() user: User, @Param('id') id: string, @Body() body: { decision: 'approved' | 'rejected' }) {
    return this.ops.decideTimeOff(user, id, body.decision);
  }

  // Payroll-yaqin hisob
  @Get('payroll')
  payroll(@CurrentUser() user: User, @Query('from') from: string, @Query('to') to: string) {
    return this.ops.payroll(user, from, to);
  }

  // Tashqi kommunikatsiya
  @Get('outbound')
  outbound(@CurrentUser() user: User) {
    return this.ops.listOutbound(user);
  }

  @Post('outbound/draft')
  draft(@CurrentUser() user: User, @Body() body: any) {
    return this.ops.draftOutbound(user, body);
  }

  @Patch('outbound/:id')
  updateOutbound(@CurrentUser() user: User, @Param('id') id: string, @Body() body: any) {
    return this.ops.updateOutbound(user, id, body);
  }

  @Post('outbound/:id/send')
  send(@CurrentUser() user: User, @Param('id') id: string) {
    return this.ops.approveAndSend(user, id);
  }
}
