import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../auth/auth.service';
import { BrowserBridge, BridgeAction, PageState } from './browser-bridge';
import type { User } from '@prisma/client';

/**
 * S1: Universal App Control (Tier 1) — brauzer-avtomatlashtirish yurgizuvchisi.
 * Loop shu yerda (brauzer shu jarayonda yashaydi), har qadam QARORI esa
 * engine'da: LLM sahifa holatiga qarab mulohaza yuritadi (kalitsiz —
 * skriptli retseptlar). Har yurgizish AutomationRun sifatida saqlanadi.
 */

const MAX_STEPS = 12;

interface StepRecord {
  step: number;
  action: string;
  target?: string;
  value?: string;
  observation: string;
  at: string;
}

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);
  private readonly engineUrl = process.env.AGENT_ENGINE_URL ?? 'http://localhost:8000';

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    private readonly audit: AuditLogService,
  ) {}

  async run(user: User, goal: string, startUrl?: string, language?: string) {
    const lang = language ?? user.preferredLanguage ?? 'en';
    const record = await this.prisma.automationRun.create({
      data: { userId: user.id, goal, startUrl: startUrl ?? null, status: 'running' },
    });

    const bridge = new BrowserBridge();
    const steps: StepRecord[] = [];
    let state: PageState | null = null;
    let finalStatus = 'failed';
    let method = 'scripted';
    let summary = '';
    let extracted = '';

    try {
      await bridge.open();

      if (startUrl) {
        const obs = await bridge.execute({ action: 'navigate', url: startUrl });
        state = await bridge.getState();
        steps.push(this.step(steps.length + 1, 'navigate', startUrl, undefined, obs));
      }

      for (let i = 0; i < MAX_STEPS; i++) {
        const plan = await this.planStep(goal, state, steps, lang);
        if (plan.method === 'llm') method = 'llm';

        if (plan.action === 'done') {
          finalStatus = 'completed';
          summary = plan.summary ?? '';
          extracted = plan.extracted ?? '';
          break;
        }
        if (plan.action === 'fail') {
          finalStatus = 'failed';
          summary = plan.reason ?? 'Planner reported failure';
          break;
        }

        const obs = await bridge.execute(plan as BridgeAction);
        steps.push(
          this.step(
            steps.length + 1,
            plan.action,
            plan.url ?? (plan.element_index !== undefined ? `#${plan.element_index}` : plan.what),
            plan.value,
            obs,
          ),
        );
        state = await bridge.getState();
      }

      if (finalStatus === 'running' || (!summary && finalStatus === 'failed' && steps.length >= MAX_STEPS)) {
        finalStatus = 'failed';
        summary = `Step budget (${MAX_STEPS}) exhausted.`;
      }

      // Yakuniy xulosa (LLM bo'lsa boyroq)
      if (finalStatus === 'completed' && !summary) {
        summary = await this.summarize(goal, steps, lang);
      }
    } catch (e: any) {
      if (e instanceof UnprocessableEntityException) {
        finalStatus = 'blocked';
        summary = (e.getResponse() as any)?.reason ?? 'Blocked by Halal Filter';
      } else {
        this.logger.error(`Automation run failed: ${e.message}`);
        summary = summary || `Runner error: ${String(e.message).slice(0, 200)}`;
      }
    } finally {
      await bridge.close();
    }

    const updated = await this.prisma.automationRun.update({
      where: { id: record.id },
      data: {
        status: finalStatus,
        steps: steps as unknown as object,
        method,
        result: {
          summary,
          extracted: extracted.slice(0, 4000),
          finalUrl: state?.url ?? null,
          finalTitle: state?.title ?? null,
        },
      },
    });

    await this.audit.record({
      actorId: user.id,
      action: 'automation.run',
      resourceType: 'automation_run',
      resourceId: record.id,
      metadata: { status: finalStatus, steps: steps.length, method },
    });

    return updated;
  }

  async listRuns(user: User) {
    return this.prisma.automationRun.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async capabilities() {
    try {
      const { data } = await firstValueFrom(this.http.get(`${this.engineUrl}/automation/capabilities`));
      return data;
    } catch {
      return { tier: 1, scope: 'browser automation', note: 'engine offline' };
    }
  }

  // ---- ichki yordamchilar ----

  private async planStep(goal: string, state: PageState | null, steps: StepRecord[], language: string) {
    try {
      const { data } = await firstValueFrom(
        this.http.post(
          `${this.engineUrl}/automation/plan`,
          { goal, page_state: state, history: steps, language },
          { timeout: 60_000 },
        ),
      );
      return data as BridgeAction & { method?: string; reason?: string };
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      if (e?.response?.status === 422 && detail?.blocked) {
        throw new UnprocessableEntityException({ blocked: true, reason: detail.reason });
      }
      return { action: 'fail', reason: `Planner unreachable: ${e.message}` } as BridgeAction & { reason: string };
    }
  }

  private async summarize(goal: string, steps: StepRecord[], language: string): Promise<string> {
    try {
      const { data } = await firstValueFrom(
        this.http.post(`${this.engineUrl}/automation/summarize`, { goal, steps, language }, { timeout: 30_000 }),
      );
      return data.summary ?? '';
    } catch {
      return `Ran ${steps.length} browser steps toward: ${goal.slice(0, 100)}`;
    }
  }

  private step(n: number, action: string, target?: string, value?: string, observation = ''): StepRecord {
    return { step: n, action, target, value, observation, at: new Date().toISOString() };
  }
}
