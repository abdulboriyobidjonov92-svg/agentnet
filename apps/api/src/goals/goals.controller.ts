import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ClerkGuard } from '../auth/clerk.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { GoalsService } from './goals.service';
import type { User } from '@prisma/client';

class CreateGoalDto {
  @ApiProperty({ description: "Yuqori darajadagi maqsad, oddiy tilda" })
  @IsString()
  @MinLength(5)
  @MaxLength(300)
  title: string;
}

@ApiTags('goals')
@ApiBearerAuth()
@UseGuards(ClerkGuard)
@Controller('goals')
export class GoalsController {
  constructor(private readonly goals: GoalsService) {}

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateGoalDto) {
    return this.goals.create(user, dto.title);
  }

  @Get()
  findAll(@CurrentUser() user: User) {
    return this.goals.findAll(user);
  }

  @Get(':id')
  findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.goals.findOne(id, user);
  }

  @Post(':id/advance')
  advance(@CurrentUser() user: User, @Param('id') id: string) {
    return this.goals.advance(id, user);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.goals.remove(id, user);
  }
}
