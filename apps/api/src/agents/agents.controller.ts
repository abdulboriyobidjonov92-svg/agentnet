import {
  Controller, Get, Post, Patch, Delete, Body, Param, HttpCode,
  Res, UseGuards, ServiceUnavailableException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { Response } from 'express';
import type { Readable } from 'node:stream';
import { CurrentUser } from '../auth/current-user.decorator';
import { InternalTokenGuard } from '../auth/internal-token.guard';
import { AgentsService } from './agents.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { ComposeAgentDto } from './dto/compose-agent.dto';
import { ChatStreamDto } from './dto/chat-stream.dto';
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

  /**
   * SEC-10 — chat SSE proxy: BFF -> API -> engine.
   *
   * NEGA MAVJUD: engine Render'da private service (ADR-004) va frontend
   * Vercel'da (ADR-021) — BFF engine'ga to'g'ridan-to'g'ri yeta olmaydi.
   *
   * AUTH — ikki qulf (billing.refund bilan AYNAN bir xil naqsh):
   *   1) `InternalTokenGuard` — chaqiruvchi platformaning o'z BFF'i ekanini
   *      isbotlaydi. Bu SHART: BFF bu endpointga kelishdan OLDIN pulni
   *      yechadi (`/billing/charge-message`). Bu qulfsiz istalgan
   *      autentifikatsiyalangan foydalanuvchi shu yo'lni to'g'ridan-to'g'ri
   *      chaqirib BEPUL LLM olardi (pul va kvota chetlab o'tilardi).
   *   2) Global `AuthGuard` — qaysi foydalanuvchi ekanini (BFF uzatgan bearer
   *      token orqali) aniqlaydi; `user_id` engine'ga SHU YERDAN ketadi.
   * Shuning uchun `@Public()` QO'YILMAYDI (aks holda `@CurrentUser()` bo'sh
   * bo'lardi) — bu CLAUDE.md guard-matritsasidagi "BFF->API" qatorining
   * foydalanuvchi-kontekstli varianti.
   *
   * Kvota (`LlmQuotaGuard`) ATAYLAB yo'q: BFF bu chaqiruvdan oldin
   * `/usage/consume-chat` ni alohida chaqiradi (mavjud, o'zgarmagan tartib) —
   * bu yerga guard qo'shilsa bitta xabar IKKI marta hisoblanardi.
   */
  @Post('stream')
  @UseGuards(InternalTokenGuard)
  async stream(
    @CurrentUser() user: User,
    @Body() dto: ChatStreamDto,
    @Res() res: Response,
  ) {
    // Engine oqimi AVVAL ochiladi: agar engine javob bermasa, hali hech qanday
    // sarlavha yuborilmagan bo'ladi va Nest istisnoni to'g'ri 5xx'ga aylantira
    // oladi — BFF esa `!upstream.ok` ko'rib pulni qaytaradi. Sarlavhalarni
    // oldin yuborsak, xatoni 200-oqim ichida yashirgan bo'lardik.
    let upstream: Readable;
    try {
      upstream = await this.agents.openChatStream(user, dto);
    } catch {
      throw new ServiceUnavailableException({
        message: "Agent engine bilan aloqa yo'q",
        reason: 'engine_unavailable',
      });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    // Mijoz uzilsa (tab yopildi, tarmoq ketdi) — engine ulanishini ham yopamiz,
    // aks holda engine tomonda LLM oqimi va soket ochiq qolib ketardi.
    res.on('close', () => upstream.destroy());
    upstream.on('error', () => res.end());

    upstream.pipe(res);
  }
}
