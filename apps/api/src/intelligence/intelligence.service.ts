import { Injectable, Logger, BadGatewayException, UnprocessableEntityException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../auth/auth.service';
import { TwinService } from '../twin/twin.service';
import type { User } from '@prisma/client';

/**
 * Intelligence — Fusion, Ethics, Knowledge Sync va Super Mode uchun API qatlami.
 * Vazifasi: foydalanuvchi kontekstini (Life Twin faktlari, maqsadlar,
 * qadriyatlar) yig'ib, engine'ning aqlli endpointlariga uzatish.
 */
@Injectable()
export class IntelligenceService {
  private readonly logger = new Logger(IntelligenceService.name);
  private readonly engineUrl = process.env.AGENT_ENGINE_URL ?? 'http://localhost:8000';

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    private readonly audit: AuditLogService,
    private readonly twin: TwinService,
  ) {}

  // ---- Cross-Profession Agent Fusion ----

  async fusion(user: User, problem: string, roles: string[] = []) {
    const facts = await this.twin.factsForEngine(user.id);
    const data = await this.callEngine('/fusion/run', {
      problem,
      roles,
      facts,
      profession: user.professionTitle ?? '',
      language: user.preferredLanguage ?? 'en',
    });
    await this.audit.record({ actorId: user.id, action: 'fusion.run', resourceType: 'user', resourceId: user.id, metadata: { roles: data.roles, method: data.method } });
    return data;
  }

  async fusionRoles(user: User) {
    const { data } = await firstValueFrom(
      this.http.get(`${this.engineUrl}/fusion/roles`, { params: { language: user.preferredLanguage ?? 'en' } }),
    );
    return data;
  }

  // ---- Ethical Decision Engine ----

  async ethicsEvaluate(user: User, action: string) {
    const data = await this.callEngine('/ethics/evaluate', {
      action,
      values: user.valuesProfile ?? { tradition: 'islamic', statements: [] },
      profession: user.professionTitle ?? '',
      language: user.preferredLanguage ?? 'en',
    });
    await this.audit.record({ actorId: user.id, action: 'ethics.evaluate', resourceType: 'user', resourceId: user.id, metadata: { verdict: data.verdict, method: data.method } });
    return data;
  }

  // ---- Real-time Global Knowledge Sync ----

  async knowledgeSearch(user: User, query: string) {
    return this.callEngine('/knowledge/search', {
      query,
      language: user.preferredLanguage ?? 'en',
      city: user.city ?? 'Tashkent',
    });
  }

  // ---- "One Command" Super Mode ----

  async superMode(user: User, command: string) {
    const [facts, goals] = await Promise.all([
      this.twin.factsForEngine(user.id),
      this.prisma.goal.findMany({
        where: { userId: user.id, status: 'active' },
        select: { title: true, progress: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);
    const data = await this.callEngine('/supermode/run', {
      command,
      facts,
      goals,
      values: user.valuesProfile ?? { tradition: 'islamic', statements: [] },
      profession: user.professionTitle ?? '',
      city: user.city ?? 'Tashkent',
      language: user.preferredLanguage ?? 'en',
    });
    await this.audit.record({ actorId: user.id, action: 'supermode.run', resourceType: 'user', resourceId: user.id, metadata: { stages: data.stages?.length, method: data.method } });
    return data;
  }

  // ---- Umumiy engine chaqiruv (xato/blok qayta ishlash bilan) ----

  private async callEngine(path: string, body: unknown): Promise<any> {
    try {
      const { data } = await firstValueFrom(
        this.http.post(`${this.engineUrl}${path}`, body, { timeout: 90_000 }),
      );
      return data;
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      if (e?.response?.status === 422 && detail?.blocked) {
        throw new UnprocessableEntityException({ blocked: true, reason: detail.reason });
      }
      this.logger.error(`Engine xatosi (${path}): ${e.message}`);
      throw new BadGatewayException("Agent engine bilan aloqa yo'q");
    }
  }
}
