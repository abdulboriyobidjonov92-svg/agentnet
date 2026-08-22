import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { EventActor, ExecutionEventType } from '@prisma/client';
import { InternalTokenGuard } from '../auth/internal-token.guard';
import { Public } from '../auth/public.decorator';
import { ExecutionEventBus } from './execution-event-bus.service';

/**
 * Engine / browser-worker → API hodisa yo'li (P0-13).
 *
 * Guard matritsasi (CLAUDE.md): servis-ichi chaqiruv → `@Public()` +
 * `InternalTokenGuard`. `@Public()` faqat global `AuthGuard`ni o'tkazadi;
 * `InternalTokenGuard` o'z holicha ishlashda davom etadi.
 */
export class EmitExecutionEventDto {
  @IsString() @IsNotEmpty() @MaxLength(64) runId!: string;
  @IsOptional() @IsString() @MaxLength(64) stepId?: string;
  @IsEnum(ExecutionEventType) type!: ExecutionEventType;
  @IsEnum(EventActor) actor!: EventActor;
  @IsString() @IsNotEmpty() @MaxLength(64) agentId!: string;
  @IsString() @IsNotEmpty() @MaxLength(64) tenantId!: string;
  /** Ixtiyoriy, xom — bus uni MAJBURIY redaksiyadan o'tkazadi. */
  @IsOptional() payload?: unknown;
  /** Tiyin — JSON'da satr sifatida keladi (BigInt JSON'da yo'q). */
  @IsOptional() @IsString() @MaxLength(32) costTiyin?: string;
  @IsOptional() @Type(() => Number) @IsInt() latencyMs?: number;
}

@ApiTags('execution-events')
@Controller('internal/execution-events')
export class ExecutionEventsController {
  constructor(private readonly bus: ExecutionEventBus) {}

  @Post()
  @Public()
  @UseGuards(InternalTokenGuard)
  async emit(@Body() dto: EmitExecutionEventDto) {
    const event = await this.bus.emit({
      runId: dto.runId,
      stepId: dto.stepId ?? null,
      type: dto.type,
      actor: dto.actor,
      agentId: dto.agentId,
      tenantId: dto.tenantId,
      payload: dto.payload,
      costTiyin: dto.costTiyin ? BigInt(dto.costTiyin) : null,
      latencyMs: dto.latencyMs ?? null,
    });
    // `null` — hodisa yozilmadi (bo'ron chegarasi yoki yozuv xatosi).
    // Chaqiruvchi (engine/worker) buni BILISHI kerak, lekin ijroni
    // to'xtatmaydi — shuning uchun 2xx, xato emas.
    return { accepted: event !== null, seq: event?.seq ?? null };
  }
}
