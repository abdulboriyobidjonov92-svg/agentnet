import {
  Controller, Get, Post, Patch, Delete, Body, Param, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AgentsService } from './agents.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { ComposeAgentDto } from './dto/compose-agent.dto';
import type { User } from '@prisma/client';

// Dekoratorlar SHART: global ValidationPipe whitelist:true dekoratorsiz
// maydonlarni o'chirib yuboradi — ilgari message/conversationId server'ga
// umuman yetib kelmasdi (bo'sh xabar bilan engine chaqirilardi).
class RunAgentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  message: string;

  @IsOptional()
  @IsString()
  conversationId?: string;
}

@ApiTags('agents')
@ApiBearerAuth()
@Controller('agents')
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  /** Y9: bir-klik agent — tabiiy til tavsifidan tayyor agent taklifi + narx (yaratmaydi). */
  @Post('compose')
  compose(@CurrentUser() user: User, @Body() dto: ComposeAgentDto) {
    return this.agents.compose(user, dto.description, dto.language);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateAgentDto) {
    return this.agents.create(user, dto);
  }

  @Get()
  findAll(@CurrentUser() user: User) {
    return this.agents.findAll(user);
  }

  @Get(':id')
  findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.agents.findOne(id, user);
  }

  @Patch(':id')
  update(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: UpdateAgentDto) {
    return this.agents.update(id, user, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.agents.remove(id, user);
  }

  @Post(':id/run')
  run(@CurrentUser() user: User, @Param('id') id: string, @Body() body: RunAgentDto) {
    return this.agents.run(id, user, body.message, body.conversationId);
  }

  /** Balans to'ldirilgandan keyin — muzlatilgan agentni qayta faollashtirish. */
  @Post(':id/reactivate')
  reactivate(@CurrentUser() user: User, @Param('id') id: string) {
    return this.agents.reactivate(id, user);
  }

  /** Ishonch-jurnali — bu agent bo'yicha qilingan har bir harakat va sabab. */
  @Get(':id/trust-log')
  trustLog(@CurrentUser() user: User, @Param('id') id: string) {
    return this.agents.trustLog(id, user);
  }
}
