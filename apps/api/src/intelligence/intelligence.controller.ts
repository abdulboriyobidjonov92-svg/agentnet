import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ClerkGuard } from '../auth/clerk.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { IntelligenceService } from './intelligence.service';
import type { User } from '@prisma/client';

class FusionDto {
  @ApiProperty() @IsString() @MinLength(10) @MaxLength(2000) problem: string;
  @ApiProperty({ required: false, type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  roles?: string[];
}

class EthicsDto {
  @ApiProperty() @IsString() @MinLength(5) @MaxLength(1000) action: string;
}

class KnowledgeDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(300) query: string;
}

class SuperModeDto {
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(500) command: string;
}

@ApiTags('intelligence')
@ApiBearerAuth()
@UseGuards(ClerkGuard)
@Controller()
export class IntelligenceController {
  constructor(private readonly intelligence: IntelligenceService) {}

  @Post('fusion')
  fusion(@CurrentUser() user: User, @Body() dto: FusionDto) {
    return this.intelligence.fusion(user, dto.problem, dto.roles ?? []);
  }

  @Get('fusion/roles')
  fusionRoles(@CurrentUser() user: User) {
    return this.intelligence.fusionRoles(user);
  }

  @Post('ethics/evaluate')
  ethics(@CurrentUser() user: User, @Body() dto: EthicsDto) {
    return this.intelligence.ethicsEvaluate(user, dto.action);
  }

  @Post('knowledge/search')
  knowledge(@CurrentUser() user: User, @Body() dto: KnowledgeDto) {
    return this.intelligence.knowledgeSearch(user, dto.query);
  }

  @Post('supermode')
  superMode(@CurrentUser() user: User, @Body() dto: SuperModeDto) {
    return this.intelligence.superMode(user, dto.command);
  }
}
