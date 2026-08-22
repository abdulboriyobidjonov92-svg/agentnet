import { BadRequestException, Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { ApprovalDecision, EventActor, ExecutionEventType, RiskTier } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ExecutionEventBus } from '../events/execution-event-bus.service';
import { paginate, type PageQuery } from '../common/pagination/paginate';
import { scrubValue } from '../observability/redaction';
import { ConnectorsService } from '../connectors/connectors.service';
import { resolveApprovedAction } from './approved-action';
import type { User } from '@prisma/client';

/**
 * V3-P0 · P0-6 — INSON TASDIG'INI YOZISH (SAFETY_POLICY_LAYER §8).
 *
 * Bu servis **ma'lumot aktivi** yaratadi, UI holatini emas. `ApprovalEvent`
 * korpusi — MASTER_ROADMAP §2 M3 dagi eng nodir moat: u retroaktiv
 * yig'ilmaydi.
 *
 * ⚠️ `modified` ALOHIDA holat. "Rad etdi" va "tuzatib tasdiqladi" bir xil
 * emas: birinchisi "bu amal xato", ikkinchisi "amal to'g'ri, lekin
 * tafsiloti xato" degani. Ikkinchisi agentni yaxshilash uchun BEQIYOS
 * qimmatliroq — shuning uchun `modifiedAction` alohida ustunda.
 */
@Injectable()
export class ApprovalService {
  private readonly logger = new Logger(ApprovalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: ExecutionEventBus,
    /**
     * `forwardRef` — bog'liqlik HAQIQATAN ikki tomonlama: policy
     * konnektorlarni darvozadan o'tkazadi, tasdiqlangan amal esa qaytib
     * konnektorga boradi. NestJS'ning shu holat uchun rasmiy mexanizmi.
     */
    @Inject(forwardRef(() => ConnectorsService))
    private readonly connectors: ConnectorsService,
  ) {}

  /**
   * Tasdiq so'rovini yozadi va trace'ga `APPROVAL_REQUIRED` qo'yadi.
   *
   * Chaqiruvchi (tool executor) shundan keyin ijroni TO'XTATADI va
   * foydalanuvchi qarorini kutadi.
   */
  async request(input: {
    runId: string;
    stepId?: string | null;
    actionId: string;
    agentId: string;
    userId: string;
    riskTier: RiskTier;
    proposedAction: unknown;
  }) {
    // Redaksiya: taklif ichida qabul qiluvchi raqami, matn, token bo'lishi
    // mumkin. `ApprovalEvent` uzoq (365 kun) saqlanadi — xom sir bu yerga
    // tushsa eng uzoq yashaydigan sizish bo'lardi.
    const proposedAction = (scrubValue(input.proposedAction) ?? {}) as object;

    const row = await this.prisma.approvalEvent.create({
      data: {
        runId: input.runId,
        stepId: input.stepId ?? null,
        actionId: input.actionId,
        agentId: input.agentId,
        userId: input.userId,
        riskTier: input.riskTier,
        proposedAction,
        // Boshlang'ich holat: hali qaror yo'q. Sxemada `decision` majburiy
        // bo'lgani uchun "kutilmoqda" ni ALOHIDA enum qiymati bilan emas,
        // `latencyMs = -1` bilan belgilaymiz — qaror kelganda yangilanadi.
        decision: ApprovalDecision.REJECTED,
        latencyMs: PENDING_LATENCY,
      },
    });

    void this.bus.emit({
      runId: input.runId,
      stepId: input.stepId ?? null,
      agentId: input.agentId,
      tenantId: input.userId,
      type: ExecutionEventType.APPROVAL_REQUIRED,
      actor: EventActor.agent,
      payload: { approvalId: row.id, riskTier: input.riskTier, proposedAction },
    });

    return { id: row.id, riskTier: row.riskTier, createdAt: row.createdAt };
  }

  /** Kutilayotgan tasdiqlar (UI-4 uchun). */
  async listPending(user: User, page: PageQuery) {
    return paginate(
      this.prisma.approvalEvent,
      {
        where: { userId: user.id, latencyMs: PENDING_LATENCY },
        orderBy: [{ createdAt: 'desc' }],
      },
      page,
    );
  }

  /**
   * Inson qarorini yozadi.
   *
   * `MODIFIED` bo'lsa `modifiedAction` MAJBURIY — busiz "nimani tuzatdi?"
   * savoli javobsiz qoladi va yozuvning butun qiymati yo'qoladi.
   */
  async decide(
    user: User,
    approvalId: string,
    input: { decision: ApprovalDecision; modifiedAction?: unknown; reason?: string },
  ) {
    if (input.decision === ApprovalDecision.MODIFIED && input.modifiedAction == null) {
      throw new BadRequestException(
        "`MODIFIED` qarori uchun `modifiedAction` majburiy — inson nimani tuzatgani yozilishi SHART",
      );
    }

    const existing = await this.prisma.approvalEvent.findFirst({
      where: { id: approvalId, userId: user.id },
    });
    if (!existing) throw new BadRequestException('Tasdiq so‘rovi topilmadi');
    if (existing.latencyMs !== PENDING_LATENCY) {
      throw new BadRequestException('Bu so‘rov bo‘yicha qaror allaqachon qabul qilingan');
    }

    const latencyMs = Math.max(0, Date.now() - existing.createdAt.getTime());

    const row = await this.prisma.approvalEvent.update({
      where: { id: approvalId },
      data: {
        decision: input.decision,
        // Prisma'da nullable Json uchun `null` YARAMAYDI — maydonni umuman
        // yubormaymiz (u allaqachon `null`). `DbNull` ishlatish ham mumkin,
        // lekin maydonni tashlab ketish niyatni aniqroq ko'rsatadi.
        ...(input.modifiedAction == null
          ? {}
          : { modifiedAction: (scrubValue(input.modifiedAction) ?? {}) as object }),
        latencyMs,
        reason: input.reason?.slice(0, 500) ?? null,
      },
    });

    void this.bus.emit({
      runId: row.runId,
      stepId: row.stepId,
      agentId: row.agentId,
      tenantId: row.userId,
      type:
        input.decision === ApprovalDecision.REJECTED
          ? ExecutionEventType.APPROVAL_DENIED
          : ExecutionEventType.APPROVAL_GRANTED,
      actor: EventActor.user,
      payload: { approvalId: row.id, decision: input.decision, latencyMs },
      latencyMs,
    });

    if (input.decision === ApprovalDecision.REJECTED) {
      return { id: row.id, decision: row.decision, latencyMs, executed: false };
    }

    // ============================================================
    // TASDIQLANGAN AMAL BAJARILADI.
    //
    // Busiz tasdiq tugmasi hech narsa qilmasdi: foydalanuvchi "ha" bosardi,
    // amal esa bloklangan holicha qolardi. Aynan shu bo'g'in P0-6 dagi
    // "tasdiqlab davom etish yo'q" cheklovini yopadi.
    // ============================================================
    const action = resolveApprovedAction(row.proposedAction, row.modifiedAction);
    return {
      id: row.id,
      decision: row.decision,
      latencyMs,
      ...(await this.executeApproved(user, row, action)),
    };
  }

  /**
   * Tasdiqlangan amalni bajaradi va natijani trace'ga yozadi.
   *
   * Xato ijroni YIQITMAYDI — qaror allaqachon yozilgan va u yo'qolmasligi
   * kerak. Foydalanuvchi natijani trace'da (`TOOL_FAILED`) ko'radi.
   */
  private async executeApproved(
    user: User,
    row: { id: string; runId: string; stepId: string | null; agentId: string; userId: string },
    action: { connector: string; action: string; params: Record<string, unknown> },
  ): Promise<{ executed: boolean; ok?: boolean; error?: string }> {
    const startedAt = Date.now();
    void this.bus.emit({
      runId: row.runId,
      stepId: row.stepId,
      agentId: row.agentId,
      tenantId: row.userId,
      type: ExecutionEventType.TOOL_STARTED,
      actor: EventActor.user,
      payload: { tool: `${action.connector}.${action.action}`, approvalId: row.id },
    });

    try {
      const result = await this.connectors.invokeApproved(user, {
        connectorId: action.connector,
        actionId: action.action,
        params: action.params,
        agentId: row.agentId,
      });

      void this.bus.emit({
        runId: row.runId,
        stepId: row.stepId,
        agentId: row.agentId,
        tenantId: row.userId,
        type: result.ok ? ExecutionEventType.TOOL_RESULT : ExecutionEventType.TOOL_FAILED,
        actor: EventActor.agent,
        // Xom natija YOZILMAYDI — bus redaksiya qiladi, lekin bu yerda ham
        // faqat metadata uzatamiz (§2.3.1: natija metadata + preview).
        payload: { tool: `${action.connector}.${action.action}`, ok: result.ok, error: result.error },
        latencyMs: Date.now() - startedAt,
      });

      return { executed: true, ok: result.ok, error: result.error };
    } catch (e: any) {
      this.logger.warn(`Tasdiqlangan amal bajarilmadi (${row.id}): ${e?.message}`);
      void this.bus.emit({
        runId: row.runId,
        stepId: row.stepId,
        agentId: row.agentId,
        tenantId: row.userId,
        type: ExecutionEventType.TOOL_FAILED,
        actor: EventActor.agent,
        payload: { tool: `${action.connector}.${action.action}`, error: String(e?.message) },
        latencyMs: Date.now() - startedAt,
      });
      return { executed: true, ok: false, error: String(e?.message) };
    }
  }
}

/**
 * "Qaror kutilmoqda" belgisi.
 *
 * NEGA ENUM QIYMATI EMAS: `ApprovalDecision` — INSON qarorining taksonomiyasi
 * (SAFETY §8). Unga `PENDING` qo'shish "kutish" ni ham qaror sifatida
 * modellashtirardi va `approval_rate = approved/(approved+rejected)`
 * formulasini (METRICS §2.2) buzardi. Shuning uchun kutish holati
 * `latencyMs` orqali: qaror hali qabul qilinmagan bo'lsa vaqt ham yo'q.
 */
export const PENDING_LATENCY = -1;
