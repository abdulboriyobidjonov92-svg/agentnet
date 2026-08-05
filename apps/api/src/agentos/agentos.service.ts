import { Injectable, Logger, NotFoundException, ForbiddenException, BadGatewayException, UnprocessableEntityException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../auth/auth.service';
import type { User } from '@prisma/client';

/**
 * AgentOS — korxona ish maydoni (Part 1 Org/Agent modelining kengaytmasi).
 * Ish maydoni yaratilganda beshta C-suite agenti (Part 1 Agent modelida,
 * csuiteRole bilan) urug'lanadi. Rahbar buyrug'i engine orkestratoriga
 * yuboriladi va natija OrgCommand sifatida saqlanadi.
 */

// C-suite system-prompt shablonlari (Part 1 agent infratuzilmasi uchun)
const CSUITE_TEMPLATES: Record<string, { name: string; systemPrompt: string; tools: string[] }> = {
  ceo: {
    name: 'AI-CEO',
    systemPrompt:
      'You are the AI-CEO. Focus on strategy and prioritization: define the single measurable objective, sequence work across departments, and keep the team on the critical path. Reply in the language the user writes in.',
    tools: ['knowledge.search'],
  },
  cfo: {
    name: 'AI-CFO',
    systemPrompt:
      'You are the AI-CFO. Own budget, cash flow and financial reporting. Separate one-off vs recurring costs, flag interest-bearing items for Shariah-compliant alternatives, and tie spend to expected return. Information, not licensed financial advice. Reply in the language the user writes in.',
    tools: ['finance.get_transactions', 'finance.currency_rates'],
  },
  cmo: {
    name: 'AI-CMO',
    systemPrompt:
      'You are the AI-CMO. Own content, ads and SEO/SMM. Craft the core message, pick the best channel, draft honest campaigns (no exaggeration), and define measurable launch metrics. Reply in the language the user writes in.',
    tools: ['knowledge.search', 'messaging.telegram_send'],
  },
  clo: {
    name: 'AI-CLO',
    systemPrompt:
      'You are the AI-CLO. Own contracts, licensing and compliance. List required documents and the exact office/portal for each, keep everything in writing, and flag deadlines early. A drafting tool, not legal advice for laypeople. Reply in the language the user writes in.',
    tools: [],
  },
  cto: {
    name: 'AI-CTO',
    systemPrompt:
      'You are the AI-CTO. Own code generation, bug fixing and deployment. Ship the smallest working version first, prefer proven tools for critical paths, set up monitoring and cheap reversible deploys. Reply in the language the user writes in.',
    tools: [],
  },
};

@Injectable()
export class AgentOsService {
  private readonly logger = new Logger(AgentOsService.name);
  private readonly engineUrl = process.env.AGENT_ENGINE_URL ?? 'http://localhost:8000';

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    private readonly audit: AuditLogService,
  ) {}

  /** Foydalanuvchining AgentOS ish maydonini (bo'lsa) qaytaradi. */
  async getWorkspace(user: User) {
    if (!user.orgId) return null;
    const org = await this.prisma.org.findUnique({
      where: { id: user.orgId },
      include: {
        agents: { where: { csuiteRole: { not: null } }, orderBy: { createdAt: 'asc' } },
      },
    });
    return org;
  }

  /** Ish maydonini yaratadi va 5 ta C-suite agentini urug'lantiradi. */
  async createWorkspace(
    user: User,
    dto: { name: string; kind?: string; tier?: string; industry?: string },
  ) {
    const slug =
      dto.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) +
      '-' +
      Math.random().toString(36).slice(2, 6);

    const org = await this.prisma.org.create({
      data: {
        name: dto.name,
        slug,
        kind: dto.kind ?? 'company',
        tier: dto.tier ?? 'mid',
        industry: dto.industry ?? null,
        ownerId: user.id,
      },
    });

    // Foydalanuvchini org'ga bog'lash.
    // SEC-05 prerequisite: bu yerda ilgari `role: 'OWNER'` ham yozilardi —
    // "org egasi" tushunchasi PLATFORMA `OWNER` roli bilan aralashtirilgan edi.
    // Bu endpoint faqat `AuthGuard` bilan himoyalangan, ya'ni istalgan oddiy
    // foydalanuvchi uni chaqirib o'zini platforma OWNER'iga ko'tara olardi.
    // Org egaligi allaqachon `Org.ownerId` (yuqorida) bilan ifodalanadi —
    // `User.role` bunga umuman kerak emas.
    await this.prisma.user.update({
      where: { id: user.id },
      data: { orgId: org.id },
    });

    // C-suite agentlarini Part 1 Agent modelida yaratish
    for (const [role, tpl] of Object.entries(CSUITE_TEMPLATES)) {
      await this.prisma.agent.create({
        data: {
          name: tpl.name,
          systemPrompt: tpl.systemPrompt,
          model: 'claude-sonnet-5',
          halalFilterEnabled: true,
          memoryEnabled: true,
          toolsConfig: tpl.tools.map((tool_id) => ({ tool_id, config: {} })),
          csuiteRole: role,
          userId: user.id,
          orgId: org.id,
        },
      });
    }

    await this.audit.record({
      actorId: user.id,
      action: 'agentos.workspace_create',
      resourceType: 'org',
      resourceId: org.id,
      metadata: { kind: org.kind, tier: org.tier },
    });

    return this.getWorkspace({ ...user, orgId: org.id });
  }

  /** Rahbar buyrug'i: orkestrator → C-suite → hisobot. */
  async runCommand(user: User, command: string) {
    const org = await this.getWorkspace(user);
    if (!org) throw new NotFoundException('AgentOS ish maydoni topilmadi');

    const record = await this.prisma.orgCommand.create({
      data: { orgId: org.id, issuedBy: user.id, command, status: 'running' },
    });

    try {
      const { data } = await firstValueFrom(
        this.http.post(
          `${this.engineUrl}/agentos/run`,
          {
            command,
            org_name: org.name,
            org_kind: org.kind,
            industry: org.industry ?? '',
            values: (user.valuesProfile as object) ?? { tradition: 'islamic', statements: [] },
            language: user.preferredLanguage ?? 'en',
          },
          { timeout: 90_000 },
        ),
      );

      const updated = await this.prisma.orgCommand.update({
        where: { id: record.id },
        data: { status: 'completed', result: data },
      });

      await this.audit.record({
        actorId: user.id,
        action: 'agentos.command_run',
        resourceType: 'org_command',
        resourceId: record.id,
        metadata: { departments: data.departments?.length, method: data.method },
      });

      return updated;
    } catch (e: any) {
      await this.prisma.orgCommand.update({ where: { id: record.id }, data: { status: 'failed' } });
      const detail = e?.response?.data?.detail;
      if (e?.response?.status === 422 && detail?.blocked) {
        throw new UnprocessableEntityException({ blocked: true, reason: detail.reason });
      }
      this.logger.error(`AgentOS engine xatosi: ${e.message}`);
      throw new BadGatewayException({ message: "Agent engine bilan aloqa yo'q", reason: 'engine_unavailable' });
    }
  }

  async history(user: User) {
    if (!user.orgId) return [];
    // @org-scope: bu yerda tenant chegarasi individual foydalanuvchi emas,
    // TASHKILOT (orgId) — bir org ichidagi bir necha foydalanuvchi bir xil
    // buyruq-tarixini ko'radi (ko'p-foydalanuvchili tenant modeli).
    return this.prisma.orgCommand.findMany({
      where: { orgId: user.orgId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async csuiteCatalog(user: User) {
    const language = user.preferredLanguage ?? 'en';
    try {
      const { data } = await firstValueFrom(
        this.http.get(`${this.engineUrl}/agentos/csuite`, { params: { language } }),
      );
      return data;
    } catch {
      return { roles: [] };
    }
  }
}
