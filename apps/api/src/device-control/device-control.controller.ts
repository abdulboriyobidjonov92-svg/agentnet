import {
  Body,
  Controller,
  Get,
  Headers,
  Patch,
  Post,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsBoolean, IsIn, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { Response } from 'express';
import { LlmQuotaGuard } from '../usage/llm-quota.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { Delete, Param, Query } from '@nestjs/common';
import { AutomationService } from '../automation/automation.service';
import { DeviceControlService } from './device-control.service';
import { DeviceCompanionService } from './device-companion.service';
import { CallRecordingService } from './call-recording.service';
import { CapabilityRouterService } from './capability-router.service';
import type { User } from '@prisma/client';

class BrowserRunDto {
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  goal: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  startUrl?: string;
}

class ConnectDto {
  @IsIn(['computer', 'phone'])
  deviceType: string;
}

class PermissionDto {
  @IsIn(['computer', 'phone'])
  deviceType: string;

  @IsString()
  @MaxLength(40)
  category: string;

  @IsBoolean()
  enabled: boolean;
}

class CompanionRegisterDto {
  @IsIn(['computer', 'phone'])
  kind: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  name?: string;
}

class CommandDto {
  @IsIn(['send_sms', 'call', 'open_app', 'computer_use'])
  kind: string;

  @IsObject()
  payload: Record<string, unknown>;
}

class PairDto {
  @IsString()
  @MinLength(4)
  @MaxLength(12)
  pairingCode: string;
}

class CompanionResultDto {
  @IsString()
  commandId: string;

  @IsString()
  @IsIn(['done', 'failed', 'denied'])
  status: string;

  @IsOptional()
  result?: unknown;
}

class ComputerUsePlanDto {
  @IsString()
  @MaxLength(2000)
  goal: string;

  @IsOptional()
  @IsString()
  screenshot?: string;

  @IsOptional()
  @IsObject()
  screen?: { width: number; height: number };

  @IsOptional()
  history?: unknown[];
}

class RecordingDto {
  @IsString()
  data: string; // base64 audio

  @IsOptional()
  @IsString()
  @MaxLength(60)
  mimeType?: string;

  @IsOptional()
  label?: string;

  durationSec?: number;

  @IsBoolean()
  consentAck: boolean; // huquqiy ogohlantirish tasdig'i — MAJBURIY

  @IsOptional()
  @IsBoolean()
  partyNotified?: boolean;
}

/**
 * Device Control — BOSQICH 0: brauzer-agent (mavjud Playwright poydevorida).
 *
 * XAVFSIZLIK-MODELI (muhim): bu SANDBOX brauzer — har yurgizish YANGI, izolyatsiya
 * qilingan headless Chromium (foydalanuvchining shaxsiy cookie/login'i YO'Q).
 * Shuning uchun u faqat OMMAVIY vebni boshqara oladi (qidiruv, ochiq ma'lumot
 * o'qish, ochiq forma to'ldirish). Instagram/YouTube kabi SHAXSIY hisoblarга
 * kirish uchun foydalanuvchi sessiyasi kerak — bu ATAYLAB hozircha YO'Q (parolni
 * serverда saqlamaymiz). Shaxsiy-login yo'li BOSQICH 1+ da xavfsiz usul bilan
 * (per-user shifrlangan persistent-profil YOKI brauzer-kengaytma) qo'shiladi.
 *
 * Bu endpoint SSE (Server-Sent Events) bilan HAR qadamni jonli chiqaradi —
 * frontend "1. Ochilmoqda... 2. Qidiruv..." jonli logini ko'rsatadi.
 */
@ApiTags('device-control')
@Controller('device')
export class DeviceControlController {
  constructor(
    private readonly automation: AutomationService,
    private readonly device: DeviceControlService,
    private readonly companion: DeviceCompanionService,
    private readonly recordings: CallRecordingService,
    private readonly router: CapabilityRouterService,
  ) {}

  // ---- BOSQICH 5: qo'ng'iroq yozib olish (shifrlangan, majburiy rozilik) ----

  @Post('recordings')
  @ApiBearerAuth()
  createRecording(@CurrentUser() user: User, @Body() dto: RecordingDto) {
    return this.recordings.create(user, dto);
  }

  @Get('recordings')
  @ApiBearerAuth()
  listRecordings(@CurrentUser() user: User) {
    return this.recordings.list(user);
  }

  @Get('recordings/:id')
  @ApiBearerAuth()
  getRecording(@CurrentUser() user: User, @Param('id') id: string) {
    return this.recordings.get(user, id);
  }

  @Delete('recordings/:id')
  @ApiBearerAuth()
  deleteRecording(@CurrentUser() user: User, @Param('id') id: string) {
    return this.recordings.remove(user, id);
  }

  // ---- BOSQICH 6: qobiliyat-yo'naltiruvchi (MCP/connector-birinchi) ----

  /** Berilgan target uchun eng tez bajaruvchini tanlaydi (connector > brauzer > ekran). */
  @Get('resolve')
  @ApiBearerAuth()
  resolve(@Query('target') target: string) {
    return this.router.resolve(target);
  }

  @Get('capability-catalog')
  @ApiBearerAuth()
  capabilityCatalog() {
    return this.router.catalog();
  }

  // ---- BOSQICH 2/3: companion (juftlash + buyruq-navbati) ----

  /** Dashboard: yangi companion yaratadi, juftlash-kodini qaytaradi. */
  @Post('companion/register')
  @ApiBearerAuth()
  registerCompanion(@CurrentUser() user: User, @Body() dto: CompanionRegisterDto) {
    return this.companion.register(user, dto.kind, dto.name);
  }

  @Get('companions')
  @ApiBearerAuth()
  listCompanions(@CurrentUser() user: User) {
    return this.companion.listCompanions(user);
  }

  /** Dashboard: buyruqni navbatga qo'yadi (ruxsat tekshiriladi). */
  @Post('command')
  @ApiBearerAuth()
  enqueue(@CurrentUser() user: User, @Body() dto: CommandDto) {
    return this.companion.enqueue(user, dto.kind, dto.payload);
  }

  // --- Companion ilovasi (ClerkGuard YO'Q — juftlash-kodi / token bilan auth) ---

  /**
   * SEC-01: 12-belgili base32 maydoni (32^12) o'zi brute-force'ni amaliy
   * jihatdan imkonsiz qiladi; `@Throttle` shu ustiga IP darajasida qattiq
   * chegara qo'yadi (bir daqiqada 5tadan ortiq urinish 429 bilan rad
   * etiladi) — ikkalasi birga "muvaffaqiyatsiz urinishlar hisoblanadi,
   * 5tadan keyin bloklanadi" talabini qamraydi (device-companion.service.ts
   * pair()dagi izohga qarang — nega alohida DB-hisoblagich yo'q).
   */
  @Post('companion/pair')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Public()
  pair(@Body() dto: PairDto) {
    return this.companion.pair(dto.pairingCode);
  }

  /** SEC-01 AC#6: 30-kunlik rotatsiya — companion o'zi muddat yaqinlashganda chaqiradi. */
  @Post('companion/refresh')
  @Public()
  async refreshCompanion(@Headers('x-companion-token') token: string) {
    const c = await this.companion.authCompanion(token);
    if (!c) throw new UnauthorizedException('Companion tokeni yaroqsiz');
    return this.companion.refreshToken(c);
  }

  @Post('companion/poll')
  @Public()
  async poll(@Headers('x-companion-token') token: string) {
    const c = await this.companion.authCompanion(token);
    if (!c) throw new UnauthorizedException('Companion tokeni yaroqsiz');
    return this.companion.poll(c);
  }

  @Post('companion/result')
  @Public()
  async companionResult(@Headers('x-companion-token') token: string, @Body() dto: CompanionResultDto) {
    const c = await this.companion.authCompanion(token);
    if (!c) throw new UnauthorizedException('Companion tokeni yaroqsiz');
    return this.companion.result(c, dto.commandId, dto.status, dto.result);
  }

  /** B2 computer-use: companion skrinshot yuboradi -> keyingi harakat qaytadi. */
  @Post('companion/computer-use/plan')
  @Public()
  async companionComputerUse(@Headers('x-companion-token') token: string, @Body() dto: ComputerUsePlanDto) {
    const c = await this.companion.authCompanion(token);
    if (!c) throw new UnauthorizedException('Companion tokeni yaroqsiz');
    return this.companion.computerUsePlan(c, dto);
  }

  // ---- BOSQICH 1: ruxsatlar + xavfsizlik-log ----

  /** Qurilmalar, toifalar va joriy ruxsat-holati. */
  @Get('status')
  @ApiBearerAuth()
  status(@CurrentUser() user: User) {
    return this.device.getStatus(user);
  }

  /** Qurilmani ulaydi (ruxsat-oqimini boshlaydi — barcha toifalar o'chiq holatda). */
  @Post('connect')
  @ApiBearerAuth()
  connect(@CurrentUser() user: User, @Body() dto: ConnectDto) {
    return this.device.connect(user, dto.deviceType);
  }

  /** Bitta toifa ruxsatini yoqadi/o'chiradi. */
  @Patch('permission')
  @ApiBearerAuth()
  setPermission(@CurrentUser() user: User, @Body() dto: PermissionDto) {
    return this.device.setPermission(user, dto.deviceType, dto.category, dto.enabled);
  }

  /** Xavfsizlik-log — agent nima qildi tarixi. */
  @Get('actions')
  @ApiBearerAuth()
  actions(@CurrentUser() user: User) {
    return this.device.listActions(user);
  }

  /**
   * BOSQICH 4 — barge-in: joriy brauzer-agent yurgizishini DARHOL to'xtatadi
   * (navbat emas, interrupt signali). Foydalanuvchi "to'xta!" deganda chaqiriladi.
   */
  @Post('interrupt')
  @ApiBearerAuth()
  interrupt(@CurrentUser() user: User) {
    return this.automation.requestInterrupt(user.id);
  }

  @Post('browser/stream')
  @ApiBearerAuth()
  @UseGuards(LlmQuotaGuard)
  async browserStream(
    @CurrentUser() user: User,
    @Body() dto: BrowserRunDto,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    // Object-holder: closure ichida yozamiz, keyin finally'da o'qiymiz (TS
    // closure-mutatsiyani `let`da `never`ga toraytiradi — property read'i esa yo'q).
    const cap: { done?: Record<string, unknown> } = {};
    const emit = (event: Record<string, unknown>) => {
      if (event.type === 'done') cap.done = event;
      if (res.writableEnded) return;
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    try {
      await this.automation.runStreaming(user, dto.goal, dto.startUrl, user.preferredLanguage ?? undefined, emit);
    } catch (e: any) {
      emit({ type: 'error', message: String(e?.message ?? e).slice(0, 200) });
    } finally {
      // Xavfsizlik-log: brauzer-agent yurgizishi "agent nima qildi" tarixiga tushadi.
      const status = cap.done?.status;
      void this.device.logAction(user.id, {
        deviceType: 'browser',
        category: 'browser',
        action: `Brauzer-buyruq: ${dto.goal.slice(0, 120)}`,
        detail: cap.done ? String(cap.done.summary ?? '').slice(0, 500) : undefined,
        status: status === 'completed' ? 'ok' : status === 'blocked' ? 'blocked' : 'failed',
      });
      res.end();
    }
  }
}
