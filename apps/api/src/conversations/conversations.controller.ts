import { Controller, Get, Post, Delete, Body, Param, Query, HttpCode } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { ConversationsService } from './conversations.service';
import { PageQueryDto } from '../common/pagination/page-query.dto';
import { AddMessageDto, AddMessagesDto } from './dto/add-message.dto';
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

  /** A15: DTO domeni DB enum'idan olinadi; timestamp berilmasa server vaqti. */
  @Post(':id/messages')
  addMessage(@CurrentUser() user: User, @Param('id') id: string, @Body() message: AddMessageDto) {
    return this.conversations.addMessage(id, user, message);
  }

  @Post(':id/messages/bulk')
  addMessages(@CurrentUser() user: User, @Param('id') id: string, @Body() body: AddMessagesDto) {
    return this.conversations.addMessages(id, user, body.messages ?? []);
  }

  /** A15: xabarlar sahifasi — eng yangilari birinchi, katta tarixni yuklamaslik uchun. */
  @Get(':id/messages')
  messages(@CurrentUser() user: User, @Param('id') id: string, @Query() page: PageQueryDto) {
    return this.conversations.messages(id, user, page);
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
