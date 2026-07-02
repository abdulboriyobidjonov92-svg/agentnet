import { Injectable, Logger, UnprocessableEntityException, BadGatewayException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../auth/auth.service';
import { TwinService } from '../twin/twin.service';
import type { User } from '@prisma/client';
import { OnboardingDto, InstallRecommendationsDto } from './dto/onboarding.dto';

/**
 * Adaptiv yadro (API tomoni).
 * Onboarding matnini agent-engine'ning /role/detect endpointiga yuboradi,
 * aniqlangan kasb-profilni foydalanuvchiga saqlaydi va shu profil asosida
 * tavsiya agentlar/dashboard konfiguratsiyasini beradi.
 */
@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);
  private readonly engineUrl = process.env.AGENT_ENGINE_URL ?? 'http://localhost:8000';

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    private readonly audit: AuditLogService,
    private readonly twin: TwinService,
  ) {}

  async completeOnboarding(user: User, dto: OnboardingDto) {
    let profile: any;
    try {
      const { data } = await firstValueFrom(
        this.http.post(`${this.engineUrl}/role/detect`, {
          text: dto.text,
          language: dto.language ?? 'en',
        }),
      );
      profile = data;
    } catch (e: any) {
      // Engine 422 → halal filter bloklagan
      const detail = e?.response?.data?.detail;
      if (e?.response?.status === 422 && detail?.blocked) {
        await this.audit.record({
          actorId: user.id,
          action: 'onboarding.halal_block',
          resourceType: 'user',
          resourceId: user.id,
          metadata: { reason: detail.reason },
        });
        throw new UnprocessableEntityException({ blocked: true, reason: detail.reason });
      }
      this.logger.error(`Role detection engine xatosi: ${e.message}`);
      throw new BadGatewayException("Agent engine bilan aloqa yo'q");
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        professionTitle: profile.profession_title,
        domain: profile.domain,
        domainConfidence: profile.confidence,
        onboardingText: dto.text,
        goals: profile.goals ?? [],
        profileData: {
          domain_label: profile.domain_label,
          reasoning: profile.reasoning,
          method: profile.method,
          widgets: profile.dashboard?.widgets ?? [],
          quick_actions: profile.dashboard?.quick_actions ?? [],
        },
        onboardingCompleted: true,
        preferredLanguage: dto.language ?? 'en',
        ...(dto.city ? { city: dto.city } : {}),
      },
    });

    await this.audit.record({
      actorId: user.id,
      action: 'onboarding.complete',
      resourceType: 'user',
      resourceId: user.id,
      metadata: { domain: profile.domain, confidence: profile.confidence, method: profile.method },
    });

    // Life Twin urug'lanadi: kasb + shahar + onboarding matnidan faktlar.
    // Xato onboarding'ni to'xtatmasligi kerak — twin keyin ham to'ladi.
    try {
      const unknownTitles = ['—', 'Not specified', 'Не указано', "Ko'rsatilmagan"];
      if (profile.profession_title && !unknownTitles.includes(profile.profession_title)) {
        await this.twin.addFact(updated, {
          category: 'work',
          label: 'Kasb',
          value: profile.profession_title,
          source: 'onboarding',
          confidence: profile.confidence ?? 0.8,
        });
      }
      if (dto.city) {
        await this.twin.addFact(updated, {
          category: 'other',
          label: 'Shahar',
          value: dto.city,
          source: 'onboarding',
        });
      }
      await this.twin.extractAndStore(updated, dto.text, 'conversation');
    } catch (e: any) {
      this.logger.debug(`Twin seeding o'tkazib yuborildi: ${e.message}`);
    }

    const { twoFactorSecret, twoFactorSecretPending, ...safeUser } = updated;
    return { profile, user: safeUser };
  }

  /** Saqlangan domain bo'yicha tavsiyalarni (agentlar, vidjetlar) qaytaradi. */
  async getRecommendations(user: User) {
    const domain = user.domain ?? 'general';
    const language = user.preferredLanguage ?? 'en';
    try {
      const { data } = await firstValueFrom(
        this.http.get(`${this.engineUrl}/role/domains/${domain}`, { params: { language } }),
      );
      // Sotib olingan nomlar bilan to'qnashmaslik uchun mavjud agentlarni belgilaymiz
      const existing = await this.prisma.agent.findMany({
        where: { userId: user.id },
        select: { name: true },
      });
      const existingNames = new Set(existing.map((a) => a.name));
      const agents = (data.recommended_agents ?? []).map((a: any) => ({
        ...a,
        installed: Object.values(a.name as Record<string, string>).some((n) => existingNames.has(n)),
      }));
      return { ...data, recommended_agents: agents };
    } catch (e: any) {
      this.logger.error(`Recommendations engine xatosi: ${e.message}`);
      throw new BadGatewayException("Agent engine bilan aloqa yo'q");
    }
  }

  /** Tanlangan tavsiya agentlarni bir bosishda yaratadi. */
  async installRecommendations(user: User, dto: InstallRecommendationsDto) {
    const created = [];
    for (const tpl of dto.agents) {
      const exists = await this.prisma.agent.findFirst({
        where: { userId: user.id, name: tpl.name },
      });
      if (exists) {
        created.push({ id: exists.id, name: exists.name, alreadyExisted: true });
        continue;
      }
      const agent = await this.prisma.agent.create({
        data: {
          name: tpl.name,
          systemPrompt: tpl.systemPrompt,
          model: 'claude-sonnet-4-6',
          halalFilterEnabled: true, // har doim yoqiq
          memoryEnabled: true,
          toolsConfig: (tpl.toolsConfig ?? []) as object,
          userId: user.id,
        },
      });
      await this.audit.record({
        actorId: user.id,
        action: 'agent.install_recommended',
        resourceType: 'agent',
        resourceId: agent.id,
        metadata: { domain: user.domain ?? 'general' },
      });
      created.push({ id: agent.id, name: agent.name, alreadyExisted: false });
    }
    return { agents: created };
  }
}
