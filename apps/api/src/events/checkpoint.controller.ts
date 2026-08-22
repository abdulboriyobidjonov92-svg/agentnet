import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { InternalTokenGuard } from '../auth/internal-token.guard';
import { Public } from '../auth/public.decorator';
import { CheckpointService } from './checkpoint.service';

/**
 * P0-8 — engine ↔ API checkpoint yo'li.
 *
 * FAQAT ichki (`InternalTokenGuard`): bu endpointlar foydalanuvchi
 * yuzasi emas, ular engine'ning `ApiCheckpointSaver` i uchun. `@Public()`
 * bu yerda faqat global `AuthGuard`ni o'tkazadi (CLAUDE.md guard matritsasi).
 */

class WriteItemDto {
  @Type(() => Number) @IsInt() @Min(0) idx!: number;
  @IsString() @MaxLength(200) channel!: string;
  @IsString() blob!: string;
}

export class PutCheckpointDto {
  @IsString() @IsNotEmpty() @MaxLength(64) threadId!: string;
  @IsOptional() @IsString() @MaxLength(200) checkpointNs?: string;
  @IsString() @IsNotEmpty() @MaxLength(200) checkpointId!: string;
  @IsOptional() @IsString() @MaxLength(200) parentCheckpointId?: string;
  @IsString() blob!: string;
  @IsOptional() metadata?: unknown;
}

export class PutWritesDto {
  @IsString() @IsNotEmpty() @MaxLength(64) threadId!: string;
  @IsOptional() @IsString() @MaxLength(200) checkpointNs?: string;
  @IsString() @IsNotEmpty() @MaxLength(200) checkpointId!: string;
  @IsString() @IsNotEmpty() @MaxLength(200) taskId!: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => WriteItemDto) writes!: WriteItemDto[];
}

@ApiTags('checkpoints')
@Controller('internal/checkpoints')
@Public()
@UseGuards(InternalTokenGuard)
export class CheckpointController {
  constructor(private readonly checkpoints: CheckpointService) {}

  @Post()
  put(@Body() dto: PutCheckpointDto) {
    return this.checkpoints.put(dto);
  }

  @Post('writes')
  putWrites(@Body() dto: PutWritesDto) {
    return this.checkpoints.putWrites(dto);
  }

  /** Oxirgi checkpoint (yoki `?checkpointId=` bilan aynan bittasi). */
  @Get(':threadId')
  get(
    @Param('threadId') threadId: string,
    @Query('checkpointNs') checkpointNs?: string,
    @Query('checkpointId') checkpointId?: string,
  ) {
    return this.checkpoints.get(threadId, checkpointNs ?? '', checkpointId);
  }

  /** Tarix — eng yangisidan eskisiga. */
  @Get(':threadId/list')
  list(
    @Param('threadId') threadId: string,
    @Query('checkpointNs') checkpointNs?: string,
    @Query('before') before?: string,
    @Query('limit') limit?: string,
  ) {
    return this.checkpoints.list(threadId, {
      checkpointNs: checkpointNs ?? '',
      before,
      limit: limit ? Number.parseInt(limit, 10) : undefined,
    });
  }

  /** Run tugagach tozalash (checkpoint — qisqa muddatli holat). */
  @Delete(':threadId')
  remove(@Param('threadId') threadId: string) {
    return this.checkpoints.deleteForThread(threadId);
  }
}
