import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClerkGuard } from '../auth/clerk.guard';
import { AdminGuard } from './admin.guard';
import { AdminStatsService } from './stats.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(ClerkGuard, AdminGuard)
@Controller('admin/stats')
export class AdminStatsController {
  constructor(private readonly stats: AdminStatsService) {}

  @Get('overview')
  overview() {
    return this.stats.overview();
  }
}
