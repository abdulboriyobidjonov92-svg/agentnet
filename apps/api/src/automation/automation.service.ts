import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../auth/auth.service';
import { CryptoService } from '../crypto/crypto.service';
import {
  BrowserBridge,
  BridgeAction,
  DomainBlockEvent,
  PageState,
  StorageState,
  mergeStorageStates,
} from './browser-bridge';
import { isEnforcementEnabled, resolveAllowlist } from './domain-allowlist';
import type { BrowserSession, User } from '@prisma/client';

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
  /**
   * BOSQICH 4 — barge-in: to'xtatish so'ralgan foydalanuvchilar. Bu NAVBAT EMAS,
   * darhol ta'sir qiluvchi "interrupt" signali — runStreaming har qadam boshida
   * tekshiradi va joriy yurgizishni to'xtatadi (foydalanuvchi "to'xta!" desa).
   */
  private readonly interrupts = new Set<string>();

  /** Foydalanuvchining joriy brauzer-agent yurgizishini to'xtatishni so'raydi. */
  requestInterrupt(userId: string) {
    this.interrupts.add(userId);
    return { ok: true };
  }

  /**
   * SEC-07 — shu run uchun ruxsat etilgan domenlar (P0-3).
   *
   * Manba: deploy env (`AGENT_DOMAIN_ALLOWLIST`). Agent-darajasidagi ro'yxat
   * (`Agent.toolsConfig.browser.allowedDomains`) `resolveAllowlist` da
   * qo'llab-quvvatlanadi, lekin brauzer-avtomatlashtirish yo'li hozir
   * agentga bog'lanmagan (`run()` da `agentId` yo'q) — u agent-scoped
   * brauzer oqimi qo'shilganda ulanadi.
   *
   * Majburlash o'chirilgan bo'lsa (`AGENT_DOMAIN_ALLOWLIST_ENFORCE=false`,
   * faqat lokal debug) — cheklovsiz ishlashi uchun `null` qaytariladi va
   * chaqiruvchi allowlist'ni umuman qo'llamaydi.
   */
  private resolveRunAllowlist(): { domains: string[]; enforced: boolean } {
    if (!isEnforcementEnabled()) {
      this.logger.warn(
        'SEC-07 majburlash O‘CHIRILGAN (AGENT_DOMAIN_ALLOWLIST_ENFORCE=false) — bu faqat lokal debug uchun',
      );
      return { domains: [], enforced: false };
    }

    const { domains, invalid, truncated } = resolveAllowlist({
      env: process.env.AGENT_DOMAIN_ALLOWLIST,
    });
    if (invalid.length) {
      this.logger.warn(`SEC-07: yaroqsiz domen yozuvi e'tiborsiz qoldirildi: ${invalid.join(', ')}`);
    }
    if (truncated) {
      this.logger.warn(`SEC-07: allowlist 5 tagacha kesildi (ruxsat etilgan: ${domains.join(', ')})`);
    }
    if (!domains.length) {
      // Fail-closed. Bu XATO EMAS — sozlanmagan holat "hammasiga ruxsat"
      // degani BO'LMASLIGI kerak. Operator uchun aniq harakat ko'rsatiladi.
      this.logger.warn(
        'SEC-07: AGENT_DOMAIN_ALLOWLIST bo‘sh — brauzer navigatsiyasi BLOKLANADI (fail-closed). ' +
          'Ruxsat berish uchun AGENT_DOMAIN_ALLOWLIST ni sozlang.',
      );
    }
    return { domains, enforced: true };
  }

  /**
   * SEC-07 blok hodisasini `DeviceActionLog`ga yozadi (Contract SEC-07 AC:
   * "Blok hodisasi DeviceActionLog'ga status: blocked bilan yoziladi").
   *
   * Fire-and-forget: audit yozuvining xatosi brauzer ijrosini yiqitmaydi.
   */
  private recordDomainBlock(userId: string, event: DomainBlockEvent) {
    void this.prisma.deviceActionLog
      .create({
        data: {
          userId,
          deviceType: 'browser',
          category: 'browser',
          action: `sec07.domain_blocked.${event.source}`,
          // Faqat HOST — to'liq URL emas (query'da token bo'lishi mumkin).
          detail: `${event.host}: ${event.reason}`.slice(0, 500),
          status: 'blocked',
        },
      })
      .catch((e: any) => this.logger.warn(`SEC-07 blok logi yozilmadi: ${e?.message}`));
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    private readonly audit: AuditLogService,
    private readonly crypto: CryptoService,
  ) {}

  async run(user: User, goal: string, startUrl?: string, language?: string) {
    const lang = language ?? user.preferredLanguage ?? 'en';
    const record = await this.prisma.automationRun.create({
      data: { userId: user.id, goal, startUrl: startUrl ?? null, status: 'running' },
    });

    const allowlist = this.resolveRunAllowlist();
    const bridge = new BrowserBridge({
      allowedDomains: allowlist.domains,
      enforceDomainAllowlist: allowlist.enforced,
      onBlocked: (event) => this.recordDomainBlock(user.id, event),
    });
    const steps: StepRecord[] = [];
    let state: PageState | null = null;
    let finalStatus = 'failed';
    let method = 'scripted';
    let summary = '';
    let extracted = '';

    try {
      const session = await this.loadSession(user.id);
      await bridge.open(session.state);
      if (session.ids.length) void this.markSessionsUsed(session.ids);

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

  /**
   * `run()` bilan AYNAN bir xil loop, lekin har qadamni `emit` callback orqali
   * JONLI chiqaradi — Device Control brauzer-agenti UI'da "1. YouTube ochilmoqda
   * ... 2. Qidiruv..." jonli logini ko'rsatishi uchun. Yakunda run baribir
   * AutomationRun sifatida saqlanadi (run() bilan bir xil persist + audit).
   * `emit` hech qachon oqimni yiqitmasligi kerak (best-effort).
   */
  async runStreaming(
    user: User,
    goal: string,
    startUrl: string | undefined,
    language: string | undefined,
    emit: (event: Record<string, unknown>) => void,
  ) {
    const lang = language ?? user.preferredLanguage ?? 'en';
    this.interrupts.delete(user.id); // eski to'xtatish-signalini tozalash (barge-in)
    const record = await this.prisma.automationRun.create({
      data: { userId: user.id, goal, startUrl: startUrl ?? null, status: 'running' },
    });
    emit({ type: 'start', runId: record.id, goal });

    const allowlist = this.resolveRunAllowlist();
    const bridge = new BrowserBridge({
      allowedDomains: allowlist.domains,
      enforceDomainAllowlist: allowlist.enforced,
      onBlocked: (event) => this.recordDomainBlock(user.id, event),
    });
    const steps: StepRecord[] = [];
    let state: PageState | null = null;
    let finalStatus = 'failed';
    let method = 'scripted';
    let summary = '';
    let extracted = '';

    const pushStep = (rec: StepRecord) => {
      steps.push(rec);
      emit({
        type: 'step',
        step: rec.step,
        action: rec.action,
        target: rec.target ?? null,
        value: rec.value ?? null,
        observation: rec.observation,
        url: state?.url ?? null,
        title: state?.title ?? null,
      });
    };

    try {
      const session = await this.loadSession(user.id);
      await bridge.open(session.state);
      if (session.ids.length) {
        void this.markSessionsUsed(session.ids);
        emit({ type: 'sessions', domains: session.domains });
      }
      emit({ type: 'browser_ready' });

      if (startUrl) {
        const obs = await bridge.execute({ action: 'navigate', url: startUrl });
        state = await bridge.getState();
        pushStep(this.step(steps.length + 1, 'navigate', startUrl, undefined, obs));
      }

      for (let i = 0; i < MAX_STEPS; i++) {
        // BOSQICH 4 — barge-in: har qadam boshida to'xtatish so'rovini tekshiramiz.
        if (this.interrupts.delete(user.id)) {
          finalStatus = 'interrupted';
          summary = "Foydalanuvchi to'xtatdi (barge-in).";
          emit({ type: 'interrupted' });
          break;
        }

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
        pushStep(
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

      if (!summary && finalStatus === 'failed' && steps.length >= MAX_STEPS) {
        summary = `Step budget (${MAX_STEPS}) exhausted.`;
      }
      if (finalStatus === 'completed' && !summary) {
        summary = await this.summarize(goal, steps, lang);
      }

      // Vizual tasdiq — yakuniy sahifa skrinshoti (best-effort, yengil JPEG).
      const shot = await bridge.screenshot();
      if (shot) emit({ type: 'screenshot', image: shot });
    } catch (e: any) {
      if (e instanceof UnprocessableEntityException) {
        finalStatus = 'blocked';
        summary = (e.getResponse() as any)?.reason ?? 'Blocked by Halal Filter';
      } else {
        this.logger.error(`Automation stream failed: ${e.message}`);
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
      action: 'device.browser_run',
      resourceType: 'automation_run',
      resourceId: record.id,
      metadata: { status: finalStatus, steps: steps.length, method },
    });

    emit({
      type: 'done',
      status: finalStatus,
      summary,
      extracted: extracted.slice(0, 4000),
      finalUrl: state?.url ?? null,
      finalTitle: state?.title ?? null,
      steps: steps.length,
      method,
      runId: record.id,
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

  // ---- BOSQICH 0: brauzer sessiyalari (saqlash/ko'rish/o'chirish) ----
  // Sessiya QO'LGA KIRITISH yo'li (login-capture) ADR-010 bo'yicha rad etilgan
  // (hosted muhitda displey yo'q — ishlamas edi). Bu yerda faqat allaqachon
  // saqlangan (kelajakda boshqa, kontrakt-mos yo'l bilan — masalan brauzer-
  // kengaytma orqali eksport) sessiyalarni ko'rish/o'chirish/run'da ishlatish
  // qoladi. `BrowserSession` jadvali va shifrlash o'zi rad etilgan emas —
  // faqat serverda ko'rinadigan brauzer ochadigan usul rad etilgan.

  async listSessions(user: User) {
    const rows = await this.prisma.browserSession.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((r) => this.publicSession(r));
  }

  async deleteSession(user: User, id: string) {
    const row = await this.prisma.browserSession.findFirst({ where: { id, userId: user.id } });
    if (!row) throw new NotFoundException('Sessiya topilmadi');
    await this.prisma.browserSession.delete({ where: { id } });
    await this.audit.record({
      actorId: user.id,
      action: 'browser_session.delete',
      resourceType: 'browser_session',
      resourceId: id,
      metadata: { domain: row.domain },
    });
    return { ok: true };
  }

  /** Foydalanuvchining BARCHA sessiyalarini bitta storageState'ga birlashtiradi. */
  private async loadSession(
    userId: string,
  ): Promise<{ state?: StorageState; ids: string[]; domains: string[] }> {
    const rows = await this.prisma.browserSession.findMany({ where: { userId } });
    if (!rows.length) return { ids: [], domains: [] };
    const states: StorageState[] = [];
    for (const r of rows) {
      try {
        states.push(this.crypto.decryptJson<StorageState>(r.state));
      } catch (e: any) {
        this.logger.warn(`Sessiya deshifrlab bo'lmadi (${r.domain}): ${e.message}`);
      }
    }
    return {
      state: mergeStorageStates(states),
      ids: rows.map((r) => r.id),
      domains: rows.map((r) => r.domain),
    };
  }

  private async markSessionsUsed(ids: string[]) {
    await this.prisma.browserSession
      .updateMany({ where: { id: { in: ids } }, data: { lastUsedAt: new Date() } })
      .catch(() => null);
  }

  /** `state` (shifrlangan cookie/token) HECH QACHON tashqariga chiqmaydi. */
  private publicSession(r: BrowserSession) {
    return {
      id: r.id,
      domain: r.domain,
      label: r.label,
      cookieCount: r.cookieCount,
      lastUsedAt: r.lastUsedAt,
      updatedAt: r.updatedAt,
    };
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
