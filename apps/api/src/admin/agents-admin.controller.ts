import { Body, Controller, Delete, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClerkGuard } from '../auth/clerk.guard';
import { AdminGuard } from './admin.guard';
import { AgentsAdminService } from './agents-admin.service';
import { UpdateAgentAdminDto } from './dto/update-agent-admin.dto';

/** Admin panelidan BARCHA foydalanuvchilarning agentlarini moderatsiya qilish. */
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(ClerkGuard, AdminGuard)
@Controller('admin/agents')
export class AdminAgentsController {
  constructor(private readonly agents: AgentsAdminService) {}

  @Get()
  list(
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('publishedOnly') publishedOnly?: string,
    @Query('limit') limit?: string,
  ) {
    return this.agents.list({
      search,
      categoryId,
      publishedOnly: publishedOnly === 'true',
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAgentAdminDto) {
    return this.agents.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.agents.remove(id);
  }
}
