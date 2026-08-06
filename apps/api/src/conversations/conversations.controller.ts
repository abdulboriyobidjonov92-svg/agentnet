import { Controller, Get, Post, Delete, Body, Param, Query, HttpCode } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { ConversationsService } from './conversations.service';
import { PageQueryDto } from '../common/pagination/page-query.dto';
import type { User } from '@prisma/client';

@ApiTags('conversations')
@ApiBearerAuth()
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Post()
  create(@CurrentUser() user: User, @Body() body: { agentId: string }) {
    return this.conversations.create(user, body.agentId);
  }

  /** Phase 3: kursorli pagination — `?limit=<=100&cursor=<id>`. */
  @Get()
  @ApiQuery({ name: 'agentId', required: false })
  findAll(
    @CurrentUser() user: User,
    @Query() page: PageQueryDto,
    @Query('agentId') agentId?: string,
  ) {
    return this.conversations.findAll(user, agentId, page);
  }

  @Get(':id')
  findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.conversations.findOne(id, user);
  }

  @Post(':id/messages')
  addMessage(@CurrentUser() user: User, @Param('id') id: string, @Body() message: any) {
    return this.conversations.addMessage(id, user, {
      ...message,
      timestamp: message.timestamp ?? new Date().toISOString(),
    });
  }

  @Post(':id/messages/bulk')
  addMessages(@CurrentUser() user: User, @Param('id') id: string, @Body() body: { messages: any[] }) {
    const stamped = (body.messages ?? []).map((m) => ({
      ...m,
      timestamp: m.timestamp ?? new Date().toISOString(),
    }));
    return this.conversations.addMessages(id, user, stamped);
  }

  @Delete(':id/messages')
  @HttpCode(204)
  clear(@CurrentUser() user: User, @Param('id') id: string) {
    return this.conversations.clear(id, user);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.conversations.remove(id, user);
  }
}
