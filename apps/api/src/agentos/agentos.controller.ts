import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ClerkGuard } from '../auth/clerk.guard';
import { LlmQuotaGuard } from '../usage/llm-quota.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AgentOsService } from './agentos.service';
import type { User } from '@prisma/client';

class CreateWorkspaceDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(80) name: string;

  @ApiProperty({ enum: ['company', 'government', 'startup', 'enterprise'] })
  @IsOptional() @IsIn(['company', 'government', 'startup', 'enterprise'])
  kind?: string;

  @ApiProperty({ enum: ['startup', 'mid', 'gov', 'enterprise'] })
  @IsOptional() @IsIn(['startup', 'mid', 'gov', 'enterprise'])
  tier?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString() @MaxLength(80)
  industry?: string;
}

class CommandDto {
  @ApiProperty() @IsString() @MinLength(4) @MaxLength(500) command: string;
}

@ApiTags('agentos')
@ApiBearerAuth()
@UseGuards(ClerkGuard)
@Controller('agentos')
export class AgentOsController {
  constructor(private readonly agentos: AgentOsService) {}

  @Get('workspace')
  workspace(@CurrentUser() user: User) {
    return this.agentos.getWorkspace(user);
  }

  @Post('workspace')
  create(@CurrentUser() user: User, @Body() dto: CreateWorkspaceDto) {
    return this.agentos.createWorkspace(user, dto);
  }

  @Get('csuite')
  csuite(@CurrentUser() user: User) {
    return this.agentos.csuiteCatalog(user);
  }

  @Post('command')
  @UseGuards(LlmQuotaGuard) // orkestrator → engine LLM (C-suite ijrosi)
  command(@CurrentUser() user: User, @Body() dto: CommandDto) {
    return this.agentos.runCommand(user, dto.command);
  }

  @Get('history')
  history(@CurrentUser() user: User) {
    return this.agentos.history(user);
  }
}
