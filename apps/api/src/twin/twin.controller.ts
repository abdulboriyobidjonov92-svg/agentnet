import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { TwinService } from './twin.service';
import { AddFactDto, ExtractDto, WhatIfDto } from './dto/twin.dto';
import type { User } from '@prisma/client';

@ApiTags('twin')
@ApiBearerAuth()
@Controller('twin')
export class TwinController {
  constructor(private readonly twin: TwinService) {}

  @Get('facts')
  listFacts(@CurrentUser() user: User) {
    return this.twin.listFacts(user.id);
  }

  @Post('facts')
  addFact(@CurrentUser() user: User, @Body() dto: AddFactDto) {
    return this.twin.addFact(user, dto);
  }

  @Delete('facts/:id')
  removeFact(@CurrentUser() user: User, @Param('id') id: string) {
    return this.twin.removeFact(user, id);
  }

  @Get('summary')
  summary(@CurrentUser() user: User) {
    return this.twin.summary(user);
  }

  @Post('whatif')
  whatIf(@CurrentUser() user: User, @Body() dto: WhatIfDto) {
    return this.twin.whatIf(user, dto.question);
  }

  @Post('extract')
  extract(@CurrentUser() user: User, @Body() dto: ExtractDto) {
    return this.twin.extractAndStore(user, dto.text, 'manual');
  }
}
