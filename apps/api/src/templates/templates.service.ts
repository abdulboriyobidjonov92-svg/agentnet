import { Injectable, NotFoundException } from '@nestjs/common';
import { AgentsService } from '../agents/agents.service';
import { PrismaService } from '../prisma/prisma.service';
import { usdUzsRate } from '../agents/agent-pricing';
import { loc } from './types';
import {
  allTemplates,
  TEMPLATE_REGISTRY,
  assembleTools,
  buildSystemPrompt,
  templateDepth,
} from './registry';
import { getModules } from './modules';
import type { AgentTemplate } from './types';
import type { User } from '@prisma/client';

// match()'da 100% deb hisoblanadigan kalit-so'z-hit soni (pastga qarang)
const STRONG_MATCH_HITS = 2;

/**
 * Y3: Tayyor shablon galereyasi (marketplace-first). Foydalanuvchi kasbini
 * kiritsa/tanlasa mos shablon(lar) tavsiya qilinadi; tanlaganini bir bosishda
 * o'ziga real agent qilib o'rnatadi (mavjud AgentsService.create — limit/audit).
 */
@Injectable()
export class TemplatesService {
  constructor(
    private readonly agents: AgentsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Ijtimoiy dalil — HAQIQIY o'rnatishlar soni (Agent.templateId bo'yicha).
   * Soxta raqam YO'Q: hisob to'g'ridan-to'g'ri DB'dan. Xato bo'lsa bo'sh map
   * (galereya baribir ochiladi — count'siz).
   */
  private async installCounts(): Promise<Map<string, number>> {
    try {
      const rows = await this.prisma.agent.groupBy({
        by: ['templateId'],
        where: { templateId: { not: null } },
        _count: { _all: true },
      });
      return new Map(rows.map((r) => [r.templateId as string, r._count._all]));
    } catch {
      return new Map();
    }
  }

  private card(t: AgentTemplate, language: string) {
    const rate = usdUzsRate();
    return {
      id: t.id,
      profession: loc(t.profession, language),
      domain: t.domain,
      vertical: t.vertical ?? null,
      complexity: t.complexity,
      flagship: loc(t.flagship, language),
      price: {
        createUsd: t.createUsd,
        monthlyUsd: t.monthlyUsd,
        createSom: Math.round(t.createUsd * rate),
        monthlySom: Math.round(t.monthlyUsd * rate),
        fxRate: rate,
      },
      tools: assembleTools(t).map((x) => x.tool_id),
      modules: getModules(t.moduleIds).map((m) => loc(m.name, language)),
      depth: templateDepth(t), // { prediction, autonomous } — brief talabi
    };
  }

  async list(language = 'uz') {
    const counts = await this.installCounts();
    // "Top" belgisi — eng ko'p o'rnatilgan shablon(lar), faqat REAL count >= 3
    // bo'lsa (1-2 o'rnatish "top" deyishga halol asos emas).
    const maxCount = Math.max(0, ...counts.values());
    return allTemplates()
      .map((t) => {
        const installCount = counts.get(t.id) ?? 0;
        return {
          ...this.card(t, language),
          installCount,
          top: installCount >= 3 && installCount === maxCount,
        };
      })
      .sort((a, b) => b.installCount - a.installCount || b.complexity - a.complexity);
  }

  get(id: string, language = 'uz') {
    const t = TEMPLATE_REGISTRY[id];
    if (!t) throw new NotFoundException(`Shablon topilmadi: ${id}`);
    return {
      ...this.card(t, language),
      systemPrompt: buildSystemPrompt(t, language), // ko'rib chiqish uchun
    };
  }

  /**
   * Kasbni matn bilan moslash — oddiy keyword/kategoriya (ML shart emas, brief).
   * Mos shablon topilmasa bo'sh ro'yxat (chaqiruvchi Y9 custom-oqimга yo'naltiradi).
   *
   * matchPercent: 2+ ta kalit so'z mos kelsa 100% (kuchli signal — bitta
   * so'z tasodifiy bo'lishi mumkin, ikkitasi kasbni deyarli aniq ko'rsatadi).
   * Y9: composer 70%+ (>=2 hit) topilsa "tayyor agent bor" deb taklif qiladi.
   */
  match(query: string, language = 'uz') {
    const q = (query || '').toLowerCase();
    const scored = allTemplates()
      .map((t) => {
        const hits = t.keywords.filter((k) => q.includes(k.toLowerCase())).length;
        // domain nomi ham signal (masalan "savdo" -> retail)
        return { t, score: hits };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || b.t.complexity - a.t.complexity)
      .slice(0, 5);
    return scored.map((x) => ({
      ...this.card(x.t, language),
      matchScore: x.score,
      matchPercent: Math.min(100, Math.round((x.score / STRONG_MATCH_HITS) * 100)),
    }));
  }

  /** Shablonni foydalanuvchiga real agent qilib o'rnatadi (bir bosishda). */
  async install(user: User, id: string, language?: string) {
    const t = TEMPLATE_REGISTRY[id];
    if (!t) throw new NotFoundException(`Shablon topilmadi: ${id}`);
    const lang = language ?? user.preferredLanguage ?? 'uz';

    const tools = assembleTools(t);
    // Narx shablon katalogidan (t.createUsd/monthlyUsd) — generic complexity
    // kalkulyatoriga QOLDIRILMAYDI, aks holda vitrinada ko'rsatilgan narxdan
    // farq qilib qolardi.
    const agent = await this.agents.create(
      user,
      {
        name: loc(t.profession, lang),
        systemPrompt: buildSystemPrompt(t, lang),
        model: 'claude-sonnet-4-6',
        toolsConfig: tools,
        ...(t.vertical ? { vertical: t.vertical } : {}),
        description: loc(t.flagship, lang).slice(0, 300),
        halalFilterEnabled: true,
        memoryEnabled: true,
        templateId: id, // ijtimoiy dalil — REAL install-count shu orqali
      },
      { creationUsd: t.createUsd, monthlyUsd: t.monthlyUsd },
    );

    return { agent, template: this.card(t, lang) };
  }
}
