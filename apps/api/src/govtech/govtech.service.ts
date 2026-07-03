import { Injectable, Logger, NotFoundException, BadGatewayException, UnprocessableEntityException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../auth/auth.service';
import type { User } from '@prisma/client';

/**
 * S7: GovTech — mahalla/tuman raqamlashtirish.
 * Fuqaro murojaati: intake → engine tasnifi (LLM-first) → mas'ul xizmatga
 * marshrut → holat kuzatuvi (timeline). Jonli davlat tizimiga topshirish
 * data-sharing shartnomasini kutadi — har javobda routing.live=false halol belgisi.
 */
@Injectable()
export class GovtechService {
  private readonly logger = new Logger(GovtechService.name);
  private readonly engineUrl = process.env.AGENT_ENGINE_URL ?? 'http://localhost:8000';

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    private readonly audit: AuditLogService,
  ) {}

  async intake(user: User, dto: { text: string; fullName?: string; contact?: string }) {
    const routing = await this.callEngine('/govtech/classify', {
      text: dto.text,
      language: user.preferredLanguage ?? 'uz',
    });

    const now = new Date().toISOString();
    const request = await this.prisma.citizenRequest.create({
      data: {
        userId: user.id,
        fullName: dto.fullName ?? null,
        contact: dto.contact ?? null,
        text: dto.text,
        category: routing.category ?? 'other',
        service: routing.service ?? null,
        office: routing.office ?? null,
        priority: routing.priority ?? 'normal',
        routing,
        status: 'routed',
        timeline: [
          { at: now, status: 'received', note: 'Murojaat qabul qilindi' },
          { at: now, status: 'routed', note: `Yo'naltirildi: ${routing.office ?? routing.service ?? '—'}` },
        ],
      },
    });

    await this.audit.record({
      actorId: user.id, action: 'govtech.intake', resourceType: 'citizen_request', resourceId: request.id,
      metadata: { category: request.category, priority: request.priority, method: routing.method },
    });
    return request;
  }

  async list(user: User, status?: string) {
    return this.prisma.citizenRequest.findMany({
      where: { userId: user.id, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async advance(user: User, id: string, dto: { status: string; note?: string }) {
    const req = await this.prisma.citizenRequest.findFirst({ where: { id, userId: user.id } });
    if (!req) throw new NotFoundException('Murojaat topilmadi');

    const allowed = ['received', 'routed', 'in_progress', 'resolved', 'rejected'];
    if (!allowed.includes(dto.status)) return req;

    const timeline = [
      ...(((req.timeline as unknown) as any[]) ?? []),
      { at: new Date().toISOString(), status: dto.status, note: dto.note ?? '' },
    ];
    return this.prisma.citizenRequest.update({
      where: { id },
      data: { status: dto.status, timeline },
    });
  }

  /** Ko'p bosqichli jarayon navigatori (pasport, propiska, YaTT...). */
  async guide(user: User, query: string) {
    return this.callEngine('/govtech/guide', {
      query,
      language: user.preferredLanguage ?? 'uz',
    });
  }

  async catalog(user: User | null) {
    try {
      const { data } = await firstValueFrom(
        this.http.get(`${this.engineUrl}/govtech/catalog`, {
          params: { language: user?.preferredLanguage ?? 'uz' },
        }),
      );
      return data;
    } catch {
      return { services: [], guides: [] };
    }
  }

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
