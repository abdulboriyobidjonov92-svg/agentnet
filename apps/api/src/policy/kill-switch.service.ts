import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventActor, ExecutionEventType, RunStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../auth/auth.service';
import { ExecutionEventBus } from '../events/execution-event-bus.service';
import type { User } from '@prisma/client';

/**
 * V3-P0 · P0-6 — KILL SWITCH (SAFETY_POLICY_LAYER §4).
 *
 * TALABLAR (§4 jadvali) va ular qanday bajarilgani:
 *   Qamrov   — har agentda. `Agent.killedAt` ustuni, sozlama emas.
 *   Ta'sir   — faol ijrolar CANCELLED, yangi ijro boshlanmaydi.
 *   Kimga    — egasi (o'z agenti) yoki OWNER/ADMIN (har qanday agent).
 *   Tezlik   — maqsad < 5 s. Bu yerda DB yozuvi darhol; ijro tekshiruvi
 *              policy engine orqali (har tool chaqiruvida).
 *   Audit    — har ishlatilish `AuditLog`ga (ADR-008).
 *   Tiklash  — AVTOMATIK EMAS, faqat qo'lda `resume`.
 *
 * ⚠️ `Agent.frozen` DAN ALOHIDA: u billing muzlatishi va to'lov bilan
 * avtomatik yechiladi. Kill switch — xavfsizlik qarori; pul bilan
 * yechilmaydi.
 */
@Injectable()
export class KillSwitchService {
  private readonly logger = new Logger(KillSwitchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly bus: ExecutionEventBus,
  ) {}

  /** Agentni to'xtatadi. Idempotent: allaqachon to'xtatilgan bo'lsa no-op. */
  async kill(user: User, agentId: string, reason?: string) {
    const agent = await this.assertCanControl(user, agentId);

    if (agent.killedAt) {
      // Idempotent — ikki marta bosish xato emas.
      return { killed: true, at: agent.killedAt, cancelledRuns: 0, alreadyKilled: true };
    }

    const killedAt = new Date();
    await this.prisma.agent.update({
      where: { id: agentId },
      data: { killedAt, killedById: user.id, killReason: reason?.slice(0, 500) ?? null },
    });

    // Faol ijrolarni bekor qilamiz. `updateMany` — atomik va bitta so'rov.
    // @upstream-scope: `assertCanControl` YUQORIDA agent egaligini (yoki
    // OWNER/ADMIN rolini) tekshirdi. Bu so'rov allaqachon tasdiqlangan
    // `agentId`ga tayanadi — kill switch aynan shu agentning BARCHA faol
    // ijrolarini to'xtatishi SHART (egasi kim bo'lishidan qat'i nazar).
    const running = await this.prisma.executionRun.findMany({
      where: { agentId, status: RunStatus.RUNNING },
      select: { id: true, userId: true },
    });
    if (running.length) {
      await this.prisma.executionRun.updateMany({
        where: { agentId, status: RunStatus.RUNNING },
        data: { status: RunStatus.CANCELLED, endedAt: killedAt },
      });
      // Har bekor qilingan ijro trace'da IZ QOLDIRADI — foydalanuvchi
      // "nega to'xtadi?" savoliga javob ko'radi (UI-4).
      for (const run of running) {
        void this.bus.emit({
          runId: run.id,
          agentId,
          tenantId: run.userId,
          type: ExecutionEventType.RUN_CANCELLED,
          actor: user.role === UserRole.MEMBER ? EventActor.user : EventActor.admin,
          payload: { reason: 'kill_switch', killReason: reason ?? null },
        });
      }
    }

    await this.audit.record({
      actorId: user.id,
      action: 'agent.kill',
      resourceType: 'agent',
      resourceId: agentId,
      metadata: { reason: reason ?? null, cancelledRuns: running.length },
    });
    this.logger.warn(`Kill switch: agent ${agentId} to'xtatildi (${running.length} ijro bekor)`);

    return { killed: true, at: killedAt, cancelledRuns: running.length, alreadyKilled: false };
  }

  /**
   * Agentni qayta faollashtiradi.
   *
   * ⚠️ Bu ATAYLAB alohida, aniq amal: kill switch o'zi o'chmaydi (§4).
   * "Vaqtincha to'xtatish" tushunchasi yo'q — to'xtatilgan agent inson
   * qarori bilan qaytariladi.
   */
  async resume(user: User, agentId: string) {
    const agent = await this.assertCanControl(user, agentId);
    if (!agent.killedAt) return { resumed: true, alreadyRunning: true };

    await this.prisma.agent.update({
      where: { id: agentId },
      data: { killedAt: null, killedById: null, killReason: null },
    });
    await this.audit.record({
      actorId: user.id,
      action: 'agent.resume',
      resourceType: 'agent',
      resourceId: agentId,
      metadata: { previousKillReason: agent.killReason },
    });
    return { resumed: true, alreadyRunning: false };
  }

  /**
   * GLOBAL kill — butun platforma bo'yicha (§4: faqat OWNER, dual
   * confirmation).
   *
   * ⚠️ QISMAN: Contract §6.5 dagi to'liq xavfli-amal oqimi (sabab matni →
   * TOTP qayta-auth → yozib tasdiqlash → ikkita audit yozuvi → 24 soatlik
   * bekor oynasi) HALI YOZILMAGAN (CLAUDE.md da ochiq qarz sifatida
   * belgilangan). Shu sababli bu yerda MINIMAL dual confirmation:
   * `confirm` maydoni aynan `KILL ALL AGENTS` bo'lishi shart + sabab
   * majburiy. §6.5 oqimi yozilganda BU yo'l o'shanga ko'chiriladi.
   */
  async globalKill(user: User, input: { confirm: string; reason: string }) {
    if (user.role !== UserRole.OWNER) {
      throw new ForbiddenException('Global kill switch faqat OWNER uchun');
    }
    if (input.confirm !== GLOBAL_KILL_PHRASE) {
      throw new ForbiddenException(
        `Tasdiqlash uchun "confirm" maydoniga aynan "${GLOBAL_KILL_PHRASE}" yozilishi shart`,
      );
    }
    if (!input.reason || input.reason.trim().length < 20) {
      // §6.5 ruhi: sabab matni kamida 20 belgi.
      throw new ForbiddenException("Sabab majburiy (kamida 20 belgi)");
    }

    const killedAt = new Date();
    const { count } = await this.prisma.agent.updateMany({
      // @admin-scope: global kill ATAYLAB cross-tenant — u butun platformani
      // to'xtatadi va faqat OWNER chaqira oladi (yuqorida tekshirilgan).
      where: { killedAt: null },
      data: { killedAt, killedById: user.id, killReason: `GLOBAL: ${input.reason.slice(0, 400)}` },
    });
    const runs = await this.prisma.executionRun.updateMany({
      // @admin-scope: ayni sabab.
      where: { status: RunStatus.RUNNING },
      data: { status: RunStatus.CANCELLED, endedAt: killedAt },
    });

    await this.audit.record({
      actorId: user.id,
      action: 'platform.global_kill',
      resourceType: 'platform',
      metadata: { reason: input.reason, agentsKilled: count, runsCancelled: runs.count },
    });
    this.logger.error(
      `GLOBAL KILL SWITCH: ${count} agent to'xtatildi, ${runs.count} ijro bekor qilindi. Sabab: ${input.reason}`,
    );

    return { agentsKilled: count, runsCancelled: runs.count, at: killedAt };
  }

  /**
   * Egalik yoki admin roli. Begona agent uchun `404` (403 EMAS) —
   * mavjudlik faktining o'zi ham ma'lumot.
   */
  private async assertCanControl(user: User, agentId: string) {
    const isAdmin = user.role === UserRole.OWNER || user.role === UserRole.ADMIN;
    // @admin-scope: OWNER/ADMIN har qanday agentni to'xtatishi SHART
    // (SAFETY_POLICY_LAYER §4 "Kimga" qatori) — aks holda muammoli agentni
    // to'xtatish uchun egasining javobini kutib turishga majbur bo'lardik.
    // Oddiy foydalanuvchi uchun so'rov `userId` bilan SCOPED (ternary).
    const agent = await this.prisma.agent.findFirst({
      where: isAdmin ? { id: agentId } : { id: agentId, userId: user.id },
      select: { id: true, userId: true, killedAt: true, killReason: true },
    });
    if (!agent) throw new NotFoundException('Agent topilmadi');
    return agent;
  }
}

/** Global kill uchun yozib tasdiqlash iborasi (§6.5 ruhida). */
export const GLOBAL_KILL_PHRASE = 'KILL ALL AGENTS';
