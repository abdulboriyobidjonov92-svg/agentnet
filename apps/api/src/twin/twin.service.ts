import { Injectable, Logger, NotFoundException, ForbiddenException, BadGatewayException, UnprocessableEntityException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../auth/auth.service';
import type { User } from '@prisma/client';

/**
 * Life Twin — foydalanuvchining raqamli egizagi (ma'lumot umurtqasi).
 * Faktlar CRUD + what-if prognoz + matndan avtomatik fakt ajratish.
 * Boshqa aqlli modullar (goals, supermode) twin faktlarini shu servisdan oladi.
 */
@Injectable()
export class TwinService {
  private readonly logger = new Logger(TwinService.name);
  private readonly engineUrl = process.env.AGENT_ENGINE_URL ?? 'http://localhost:8000';

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    private readonly audit: AuditLogService,
  ) {}

  async listFacts(userId: string) {
    return this.prisma.twinFact.findMany({
      where: { userId },
      orderBy: [{ category: 'asc' }, { updatedAt: 'desc' }],
    });
  }

  /** Engine chaqiruvlari uchun soddalashtirilgan fakt ro'yxati. */
  async factsForEngine(userId: string) {
    const facts = await this.listFacts(userId);
    return facts.map((f) => ({ category: f.category, label: f.label, value: f.value }));
  }

  async addFact(user: User, dto: { category: string; label: string; value: string; source?: string; confidence?: number }) {
    // Bir xil label bo'lsa yangilaymiz — egizak eskirmasin
    const existing = await this.prisma.twinFact.findFirst({
      where: { userId: user.id, category: dto.category, label: dto.label },
    });
    if (existing) {
      return this.prisma.twinFact.update({
        where: { id: existing.id },
        data: { value: dto.value, source: dto.source ?? existing.source, confidence: dto.confidence ?? existing.confidence },
      });
    }
    const fact = await this.prisma.twinFact.create({
      data: {
        userId: user.id,
        category: dto.category,
        label: dto.label,
        value: dto.value,
        source: dto.source ?? 'manual',
        confidence: dto.confidence ?? 1.0,
      },
    });
    await this.audit.record({ actorId: user.id, action: 'twin.fact_add', resourceType: 'twin_fact', resourceId: fact.id, metadata: { category: dto.category, source: fact.source } });
    return fact;
  }

  async removeFact(user: User, id: string) {
    const fact = await this.prisma.twinFact.findUnique({ where: { id } });
    if (!fact) throw new NotFoundException('Fakt topilmadi');
    if (fact.userId !== user.id) throw new ForbiddenException();
    await this.prisma.twinFact.delete({ where: { id } });
  }

  async summary(user: User) {
    const facts = await this.listFacts(user.id);
    const byCategory: Record<string, typeof facts> = {};
    for (const f of facts) (byCategory[f.category] ??= []).push(f);
    return {
      totalFacts: facts.length,
      byCategory,
      profession: user.professionTitle,
      domain: user.domain,
      goals: user.goals ?? [],
      onboardingCompleted: user.onboardingCompleted,
    };
  }

  async whatIf(user: User, question: string) {
    const facts = await this.factsForEngine(user.id);
    try {
      const { data } = await firstValueFrom(
        this.http.post(`${this.engineUrl}/twin/whatif`, {
          question,
          facts,
          goals: (user.goals as string[]) ?? [],
          profession: user.professionTitle ?? '',
          language: user.preferredLanguage ?? 'en',
        }),
      );
      await this.audit.record({ actorId: user.id, action: 'twin.whatif', resourceType: 'user', resourceId: user.id, metadata: { method: data.method } });
      return data;
    } catch (e: any) {
      this.rethrowEngine(e);
    }
  }

  /**
   * Matndan faktlarni ajratib saqlaydi (suhbatlar hook'i shu orqali ishlaydi).
   * Xato hech qachon chaqiruvchini yiqitmaydi — fire-and-forget uchun xavfsiz.
   */
  async extractAndStore(user: User, text: string, source: 'conversation' | 'manual' = 'conversation') {
    try {
      const { data } = await firstValueFrom(
        this.http.post(`${this.engineUrl}/twin/extract`, {
          text,
          language: user.preferredLanguage ?? 'en',
        }),
      );
      const facts: any[] = data.facts ?? [];
      for (const f of facts) {
        await this.addFact(user, { ...f, source });
      }
      return { added: facts.length, method: data.method };
    } catch (e: any) {
      if (source === 'conversation') {
        this.logger.debug(`Twin extraction o'tkazib yuborildi: ${e.message}`);
        return { added: 0 };
      }
      this.rethrowEngine(e);
    }
  }

  private rethrowEngine(e: any): never {
    const detail = e?.response?.data?.detail;
    if (e?.response?.status === 422 && detail?.blocked) {
      throw new UnprocessableEntityException({ blocked: true, reason: detail.reason });
    }
    this.logger.error(`Engine xatosi: ${e.message}`);
    throw new BadGatewayException({ message: "Agent engine bilan aloqa yo'q", reason: 'engine_unavailable' });
  }
}
