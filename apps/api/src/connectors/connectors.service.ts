import { Inject, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../auth/auth.service';
import { CryptoService } from '../crypto/crypto.service';
import { PolicyEngine } from '../policy/policy-engine.service';
import { ApprovalService } from '../policy/approval.service';
import { CONNECTORS, connectorById } from './connectors.registry';
import { missingFields, ConnectorResult, type ConnectorDefinition } from './connector.types';
import type { User } from '@prisma/client';

/**
 * Amal turini `actionId` dan aniqlaydi (P0-6 o'lchov 6).
 *
 * Nomlash konvensiyasi registrda barqaror: `send_*`, `create_*`, `get_*`…
 * Noma'lum naqsh → `write` (o'qish DEB TAXMIN QILINMAYDI: noma'lum amal
 * xavfsiz deb hisoblanmaydi, SAFETY §2.1.1 ruhi).
 */
function inferActionKind(actionId: string): 'read' | 'write' | 'send' | 'delete' | 'pay' | 'submit' {
  const a = actionId.toLowerCase();
  if (/^(get|list|read|fetch|track|check|search|status)/.test(a)) return 'read';
  if (/^(send|notify|message|post_message|sms|email)/.test(a) || a.includes('send')) return 'send';
  if (/(pay|invoice|charge|refund|transfer)/.test(a)) return 'pay';
  if (/(submit|declare|file_report|register)/.test(a)) return 'submit';
  if (/^(delete|remove|clear|drop)/.test(a)) return 'delete';
  return 'write';
}

/** Konnektor tashqi tomonga ta'sir qiladimi (P0-6 o'lchov 4). */
function inferTargetKind(def: ConnectorDefinition, actionId: string): 'self' | 'internal' | 'external' {
  if (inferActionKind(actionId) === 'read') return 'self';
  // Xabar/to'lov/davlat konnektorlari ta'rifi bo'yicha tashqi tomonga chiqadi.
  return ['messaging', 'payments', 'government', 'accounting'].includes(def.category)
    ? 'external'
    : 'internal';
}

/** Qabul qiluvchilar ro'yxati — blast radius (P0-6 o'lchov 8). */
function recipientsOf(params: Record<string, unknown>): string[] {
  for (const key of ['to', 'recipients', 'chat_ids', 'phones', 'emails']) {
    const v = params[key];
    if (Array.isArray(v)) return v.map(String);
    if (typeof v === 'string' && v) return v.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

/**
 * Parametrlarda shaxsiy ma'lumot belgisi bormi (P0-6 o'lchov 5).
 *
 * Bu — EVRISTIKA, kafolat emas: telefon/email/pasport naqshlari. Noto'g'ri
 * "yo'q" javobi tierni PASAYTIRMAYDI (boshqa o'lchamlar baribir ishlaydi),
 * noto'g'ri "ha" esa xavfsizroq tomonga xato qiladi.
 */
function hasPersonalData(params: Record<string, unknown>): boolean {
  const text = JSON.stringify(params ?? {});
  return (
    /\+998\d{9}|\b\d{9,12}\b/.test(text) || // telefon / hisob raqami
    /[\w.+-]+@[\w-]+\.[\w.]+/.test(text) || // email
    /\b[A-Z]{2}\d{7}\b/.test(text) // pasport seriyasi
  );
}

/** Agentga biriktirilgan yozuvning `label` prefiksi (unique kaliti o'zgarmadi). */
const AGENT_LABEL_PREFIX = 'agent:';

/** Engine ToolSpec `tool_id` prefiksi — `agent_tools.py` shu bilan tanidi. */
export const CONNECTOR_TOOL_PREFIX = 'connector.';

@Injectable()
export class ConnectorsService {
  private readonly logger = new Logger(ConnectorsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly crypto: CryptoService,
    /**
     * P0-6 policy darvozasi.
     *
     * `@Optional()` ATAYLAB: `ConnectorsService` ni 20+ joyda mock bilan
     * qurilgan testlar bor va ularning hammasiga policy mockini qo'shish
     * bu taskning qamrovidan tashqarida. Prod'da `PolicyModule` import
     * qilingan, ya'ni u HAR DOIM mavjud (`app.module.spec` buni tekshiradi).
     */
    @Optional() @Inject(PolicyEngine) private readonly policy?: PolicyEngine,
    /** Tasdiq so'rovlarini yozadi — `@Optional()` sababi yuqoridagi bilan bir xil. */
    @Optional() @Inject(ApprovalService) private readonly approvals?: ApprovalService,
  ) {}

  /** Katalog + foydalanuvchining ulanish holati (sirlar qaytarilmaydi). */
  async catalog(user: User | null) {
    const configs = user
      ? await this.prisma.connectorConfig.findMany({ where: { userId: user.id } })
      : [];
    // Katalog — foydalanuvchi darajasidagi ko'rinish, shuning uchun holat
    // UMUMIY (agentId=null) yozuvdan olinadi; agentga biriktirilganlari
    // alohida `attachedAgentIds` bo'lib chiqadi (sahifa ularni ko'rsatmasa
    // ham, javob haqiqatni yashirmaydi).
    const byConnector = new Map(configs.filter((c) => !c.agentId).map((c) => [c.connectorId, c]));
    const agentsByConnector = new Map<string, string[]>();
    for (const c of configs) {
      if (!c.agentId) continue;
      agentsByConnector.set(c.connectorId, [...(agentsByConnector.get(c.connectorId) ?? []), c.agentId]);
    }

    // Agent NOMLARI shu yerda qo'shiladi (UI-3). Ilgari faqat `attachedAgentIds`
    // qaytardi va UI nomlarni topish uchun agentlar ro'yxatini alohida
    // so'rab, klient tomonda JOIN qilishi kerak bo'lardi — u ro'yxat esa
    // kursorli sahifalangan (A18), ya'ni ko'p agentli hisobda nom TOPILMAY
    // qolardi. Bitta so'rov — bitta haqiqat.
    const attachedIds = [...new Set([...agentsByConnector.values()].flat())];
    // `user` bu shoxda har doim mavjud (biriktirma faqat konfiguratsiyadan
    // keladi, u esa autentifikatsiyani talab qiladi) — lekin shart ANIQ
    // yozilgan: `!` bilan bostirilgan taxmin keyinchalik jimgina yiqiladi.
    const agentNames =
      user && attachedIds.length
        ? new Map(
            (
              await this.prisma.agent.findMany({
                where: { id: { in: attachedIds }, userId: user.id },
                select: { id: true, name: true },
              })
            ).map((a) => [a.id, a.name]),
          )
        : new Map<string, string>();

    return CONNECTORS.map((def) => {
      const cfg = byConnector.get(def.id);
      const ids = agentsByConnector.get(def.id) ?? [];
      return {
        attachedAgentIds: ids,
        attachedAgents: ids.map((id) => ({ id, name: agentNames.get(id) ?? id })),
        id: def.id,
        name: def.name,
        category: def.category,
        region: def.region,
        description: def.description,
        docsUrl: def.docsUrl,
        availability: def.availability,
        auth: {
          type: def.auth.type,
          // sirlar hech qachon qaytmaydi — faqat maydon sxemasi
          fields: def.auth.fields.map(({ key, label, required, secret, placeholder, help }) => ({
            key, label, required, secret, placeholder, help,
          })),
        },
        actions: def.actions,
        connected: !!cfg && cfg.status === 'connected',
        status: cfg?.status ?? 'not_configured',
        lastUsedAt: cfg?.lastUsedAt ?? null,
        lastError: cfg?.lastError ?? null,
      };
    });
  }

  /**
   * Configni saqlaydi; majburiy maydonlar yetishmasa halol holat qo'yadi.
   *
   * `agentId` berilsa — konnektor FAQAT o'sha agentga biriktiriladi;
   * berilmasa — foydalanuvchining barcha agentlari uchun (bugungi xulq).
   * Unique kaliti `[userId, connectorId, label]` o'zgarmagani uchun
   * biriktirilgan yozuv o'z `label`ida yashaydi (`agent:<id>`) — shu tufayli
   * bitta konnektorning umumiy va agentga-xos sozlamasi yonma-yon tura oladi
   * (masalan do'kon boti va shaxsiy bot alohida tokenlar bilan).
   */
  async configure(
    user: User,
    connectorId: string,
    config: Record<string, any>,
    agentId?: string,
  ) {
    const def = connectorById.get(connectorId);
    if (!def) throw new NotFoundException(`Connector topilmadi: ${connectorId}`);

    if (agentId) await this.assertOwnsAgent(user, agentId);

    const miss = missingFields(def, config ?? {});
    const status = miss.length ? 'needs_credentials' : 'connected';
    const label = agentId ? `${AGENT_LABEL_PREFIX}${agentId}` : 'default';

    // Sirlar (tokenlar, parollar) DB'da SHIFRLANGAN saqlanadi (at-rest).
    const encrypted = this.crypto.encryptJson(config ?? {});
    const saved = await this.prisma.connectorConfig.upsert({
      where: { userId_connectorId_label: { userId: user.id, connectorId, label } },
      create: { userId: user.id, connectorId, label, agentId: agentId ?? null, config: encrypted, status },
      update: { config: encrypted, status, lastError: null, agentId: agentId ?? null },
    });

    await this.audit.record({
      actorId: user.id, action: 'connector.configure', resourceType: 'connector_config',
      resourceId: saved.id, metadata: { connectorId, status, agentId: agentId ?? null },
    });
    return { id: saved.id, connectorId, status, missing: miss, agentId: saved.agentId };
  }

  /**
   * Agentga ochiq bo'lgan konnektorlar — engine'ga uzatiladigan ToolSpec
   * ro'yxati. Agent LLM'iga aynan shu ro'yxatdan tool-schema quriladi
   * (`agent_tools.build_tools`), shuning uchun bu yerga tushmagan konnektor
   * model uchun MAVJUD EMAS.
   *
   * Ko'rinish qoidasi: `agentId IS NULL` (umumiy) YOKI aynan shu agent.
   * Sirlar chiqmaydi — faqat nom, tavsif va amal sxemasi.
   */
  async toolSpecsForAgent(user: User, agentId?: string) {
    const configs = await this.prisma.connectorConfig.findMany({
      where: {
        userId: user.id,
        status: 'connected',
        OR: [{ agentId: null }, ...(agentId ? [{ agentId }] : [])],
      },
    });

    // Bitta konnektor ham umumiy, ham agentga-xos bo'lishi mumkin — agentga
    // xosi ustun (aniqroq niyat).
    const byConnector = new Map<string, (typeof configs)[number]>();
    for (const cfg of configs) {
      const current = byConnector.get(cfg.connectorId);
      if (!current || (!current.agentId && cfg.agentId)) byConnector.set(cfg.connectorId, cfg);
    }

    return [...byConnector.values()].flatMap((cfg) => {
      const def = connectorById.get(cfg.connectorId);
      if (!def) return []; // registrdan olib tashlangan konnektor — jim o'tkazamiz
      return [
        {
          tool_id: `${CONNECTOR_TOOL_PREFIX}${def.id}`,
          config: {
            connector_id: def.id,
            name: def.name,
            description: def.description,
            actions: def.actions.map((a) => ({
              id: a.id,
              description: a.description,
              params: a.params.map((p) => ({
                key: p.key,
                label: p.label,
                type: p.type,
                required: p.required,
                example: p.example ?? null,
              })),
            })),
          },
        },
      ];
    });
  }

  /**
   * TASDIQLANGAN amalni bajaradi (P0-6 → "tasdiqlab davom etish").
   *
   * Policy darvozasi bu yerda QAYTA ishlamaydi — aks holda tasdiqlangan
   * amal yana tasdiq so'rab cheksiz halqa hosil qilardi. Qaror allaqachon
   * qabul qilingan va `ApprovalEvent` da yozilgan.
   *
   * ⚠️ LEKIN KILL SWITCH BARIBIR TEKSHIRILADI: tasdiq berilgandan keyin
   * agent to'xtatilgan bo'lishi mumkin (masalan foydalanuvchi STOP bosdi
   * yoki admin global kill qildi). "Tasdiq bor edi" bu holatda amalni
   * bajarish uchun asos EMAS — SAFETY §4 bo'yicha kill switch hamma
   * narsadan ustun.
   */
  async invokeApproved(
    user: User,
    input: { connectorId: string; actionId: string; params: Record<string, any>; agentId?: string },
  ): Promise<ConnectorResult> {
    const def = connectorById.get(input.connectorId);
    if (!def) throw new NotFoundException(`Connector topilmadi: ${input.connectorId}`);

    if (input.agentId) {
      const agent = await this.prisma.agent.findFirst({
        where: { id: input.agentId, userId: user.id },
        select: { killedAt: true },
      });
      if (!agent) throw new NotFoundException('Agent topilmadi');
      if (agent.killedAt) {
        return { ok: false, error: 'Agent to‘xtatilgan — tasdiqlangan amal ham bajarilmaydi' };
      }
    }

    const candidates = await this.prisma.connectorConfig.findMany({
      where: {
        userId: user.id,
        connectorId: input.connectorId,
        OR: [{ agentId: null }, ...(input.agentId ? [{ agentId: input.agentId }] : [])],
      },
    });
    const cfg =
      candidates.find((c) => c.agentId === input.agentId) ?? candidates.find((c) => !c.agentId);

    const result = await def.execute(input.actionId, input.params ?? {}, {
      config: this.crypto.decryptJson(cfg?.config),
      userId: user.id,
    });

    if (cfg) {
      await this.prisma.connectorConfig.update({
        where: { id: cfg.id },
        data: {
          lastUsedAt: new Date(),
          lastError: result.ok ? null : (result.error ?? null),
          ...(result.needs === 'credentials' ? { status: 'needs_credentials' } : {}),
        },
      });
    }

    await this.audit.record({
      actorId: user.id,
      action: 'connector.invoke_approved',
      resourceType: 'connector_config',
      resourceId: cfg?.id ?? input.connectorId,
      metadata: {
        connectorId: input.connectorId,
        actionId: input.actionId,
        ok: result.ok,
        agentId: input.agentId ?? null,
      },
    });
    return result;
  }

  /**
   * P0-6 policy darvozasi — amal bajarilishidan OLDIN.
   *
   * P0 DAGI XULQ (ochiq cheklov): `LOW` amal bajariladi; qolganlari
   * **BLOKLANADI** va `ApprovalEvent` yoziladi. "Tasdiqlab davom etish"
   * uchun ijroni to'xtatib keyin tiklash kerak — u esa **P0-8 checkpoint**
   * ishi. Shu sababli hozircha foydalanuvchi tasdiqlagach amalni QAYTA
   * boshlaydi.
   *
   * Bu G0.5 ni ("0 ta chetlab o'tish") TO'LIQ qondiradi: xavfli amal
   * tasdiqsiz HECH QACHON bajarilmaydi. Yetishmayotgani — qulaylik, xavfsizlik emas.
   */
  private async policyGate(
    user: User,
    def: ConnectorDefinition,
    actionId: string,
    params: Record<string, unknown>,
    agentId?: string,
    runId?: string,
  ): Promise<{ allowed: true } | { allowed: false; result: ConnectorResult }> {
    // Policy qatlami ulanmagan bo'lsa (masalan test mocki) — FAIL-CLOSED
      // emas, chunki bu konfiguratsiya xatosi bo'lardi va butun konnektor
    // yuzasini o'chirardi. O'rniga aniq log va o'tkazish: `invoke` ning
    // o'zi allaqachon auth ortida.
    if (!this.policy) return { allowed: true };

    const agent = agentId
      ? await this.prisma.agent.findFirst({
          where: { id: agentId, userId: user.id },
          select: { id: true, vertical: true, killedAt: true },
        })
      : null;

    const decision = this.policy.evaluate({
      actor: 'agent',
      agent: agent ?? { id: agentId ?? 'unknown', killedAt: null },
      tool: { connectorId: def.id, actionId },
      target: { kind: inferTargetKind(def, actionId), identifiers: recipientsOf(params) },
      data: {
        containsPersonal: hasPersonalData(params),
        fromUntrustedSource: false, // P0-10/P0-7 taint tracking bilan aniqlanadi
      },
      action: inferActionKind(actionId),
      context: { stepIndex: 0, untrustedContentSeen: false },
      scope: { size: Math.max(1, recipientsOf(params).length) },
    });

    if (decision.allow && !decision.requiresApproval) return { allowed: true };

    await this.audit.record({
      actorId: user.id,
      action: decision.allow ? 'policy.approval_required' : 'policy.blocked',
      resourceType: 'connector_config',
      resourceId: def.id,
      metadata: {
        connectorId: def.id,
        actionId,
        tier: decision.tier,
        reasons: decision.reasons,
        appliedRules: decision.appliedRules,
      },
    });

    if (!decision.allow) {
      return {
        allowed: false,
        result: {
          ok: false,
          error: `Amal policy tomonidan bloklandi (${decision.tier}): ${decision.reasons.join(', ')}`,
        },
      };
    }

    // Tasdiq talab qilinadi — amal BAJARILMAYDI, so'rov YOZILADI.
    //
    // ⚠️ Yozuvsiz bu shox foydalanuvchi uchun "amal ishlamadi" dan farq
    // qilmasdi: chatda tasdiqlash kartasi CHIQMASDI va HITL qatlami
    // amalda mavjud bo'lmasdi.
    const effectiveRunId = runId ?? (await this.resolveActiveRunId(user.id, agentId));
    if (this.approvals && effectiveRunId && agentId) {
      await this.approvals
        .request({
          runId: effectiveRunId,
          actionId: `${def.id}.${actionId}`,
          agentId,
          userId: user.id,
          riskTier: decision.tier,
          proposedAction: { connector: def.id, action: actionId, params },
        })
        .catch((e: unknown) =>
          // Yozuv yiqilsa ham amal BAJARILMAYDI — xavfsizlik saqlanadi,
          // faqat foydalanuvchi kartani ko'rmaydi.
          this.logger.warn(`Tasdiq so'rovi yozilmadi: ${(e as Error)?.message}`),
        );
    }

    return {
      allowed: false,
      result: {
        ok: false,
        error:
          `Bu amal inson tasdig'ini talab qiladi (${decision.tier}). ` +
          'Tasdiqlangandan keyin qayta urinib ko\'ring.',
        note: decision.reasons.join(', '),
      },
    };
  }

  /**
   * Faol ijroni aniqlaydi — `runId` uzatilmagan holat uchun.
   *
   * ⚠️ QAT'IY: faqat AYNAN BITTA `RUNNING` ijro bo'lsa qaytaradi. Nol yoki
   * bir nechta bo'lsa `null` — chunki "taxminan to'g'ri" run tanlash tasdiq
   * so'rovini BOSHQA ijroga bog'lab qo'yardi va foydalanuvchi noto'g'ri
   * kontekstda "ha" bosardi.
   *
   * Bu — vaqtinchalik ko'prik. To'g'ri yechim: engine `/internal/invoke`
   * chaqiruvida `runId` ni uzatishi (engine tomonidagi o'zgarish).
   */
  private async resolveActiveRunId(userId: string, agentId?: string): Promise<string | null> {
    if (!agentId) return null;
    try {
      const running = await this.prisma.executionRun.findMany({
        where: { userId, agentId, status: 'RUNNING' },
        select: { id: true },
        take: 2,
      });
      return running.length === 1 ? running[0].id : null;
    } catch (e: unknown) {
      // Bu — ENG YAXSHI HARAKAT korrelyatsiyasi, xavfsizlik qadami emas:
      // amal shu paytda ALLAQACHON bloklangan. DB nosozligi tushunarli
      // "tasdiq kerak" javobini 500 ga aylantirmasligi kerak.
      this.logger.warn(`Faol ijroni aniqlab bo'lmadi: ${(e as Error)?.message}`);
      return null;
    }
  }

  /** Begona agentga konnektor biriktirib bo'lmaydi (IDOR himoyasi). */
  private async assertOwnsAgent(user: User, agentId: string) {
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, userId: user.id },
      select: { id: true },
    });
    if (!agent) throw new NotFoundException(`Agent topilmadi: ${agentId}`);
  }

  /**
   * Konnektor biriktirmasini olib tashlaydi.
   *
   * ⚠️ QAMROV ANIQ VA TOR (UI-3 da tuzatildi):
   *   `agentId` berilgan  → FAQAT o'sha agentning biriktirmasi o'chadi
   *   `agentId` berilmagan → FAQAT umumiy (`agentId: null`) yozuv o'chadi
   *
   * ILGARI (buzuq edi): `deleteMany({ userId, connectorId })` — ya'ni
   * umumiy yozuvni o'chirish BARCHA agentga-xos sozlamalarni ham jimgina
   * o'chirib yuborardi. Foydalanuvchi "do'kon boti"ni uzganda "shaxsiy bot"
   * ham yo'qolardi — va bu hech qayerda ko'rinmasdi. Endi o'chirish
   * foydalanuvchi UI'da KO'RIB TURGAN narsaga aynan mos keladi.
   */
  async remove(user: User, connectorId: string, agentId?: string) {
    if (agentId) await this.assertOwnsAgent(user, agentId);

    const { count } = await this.prisma.connectorConfig.deleteMany({
      where: { userId: user.id, connectorId, agentId: agentId ?? null },
    });

    // Ilgari bu yo'lda audit yozuvi UMUMAN yo'q edi (`configure` da bor edi) —
    // sir olib tashlanishi konfiguratsiya qilinishidan kam ahamiyatli emas.
    await this.audit.record({
      actorId: user.id,
      action: 'connector.remove',
      resourceType: 'connector_config',
      resourceId: connectorId,
      metadata: { connectorId, agentId: agentId ?? null, removed: count },
    });

    return { removed: count > 0, count, agentId: agentId ?? null };
  }

  /**
   * Amalni bajaradi — SDKning yagona ijro nuqtasi (UI, agentlar, boshqa servislar).
   *
   * `agentId` (agent chaqirganda) — konfiguratsiya tanlashda AGENTGA XOS
   * yozuv ustun, bo'lmasa umumiy (`agentId=null`) yozuv ishlatiladi. FAQAT
   * boshqa agentga biriktirilgan konnektor topilmaydi va konnektor
   * "credentials yetishmayapti" deb halol rad javob beradi (fail-closed).
   */
  async invoke(
    user: User,
    connectorId: string,
    actionId: string,
    params: Record<string, any>,
    agentId?: string,
    /**
     * Qaysi ijro doirasida (P0-7). Berilsa tasdiq so'rovi shu runga
     * bog'lanadi va foydalanuvchi uni chatda KO'RADI. Berilmasa —
     * `policyGate` uni o'zi aniqlashga urinadi (izohga qarang).
     */
    runId?: string,
  ): Promise<ConnectorResult> {
    const def = connectorById.get(connectorId);
    if (!def) throw new NotFoundException(`Connector topilmadi: ${connectorId}`);

    const candidates = await this.prisma.connectorConfig.findMany({
      where: {
        userId: user.id,
        connectorId,
        OR: [{ agentId: null }, ...(agentId ? [{ agentId }] : [])],
      },
    });
    const cfg = candidates.find((c) => c.agentId === agentId) ?? candidates.find((c) => !c.agentId);

    // ================================================================
    // P0-6 — POLICY DARVOZASI (G0.5: "HIGH-risk amal tasdiqsiz
    // bajarilmaydi — 0 ta chetlab o'tish").
    //
    // ⚠️ BU YAGONA IJRO NUQTASI. Konnektor amallari FAQAT shu metod
    // orqali bajariladi (UI, agent, engine — hammasi shu yerga keladi),
    // shuning uchun darvoza shu yerda. Boshqa joyga qo'yilsa chetlab
    // o'tish yo'li paydo bo'lardi.
    // ================================================================
    const gate = await this.policyGate(user, def, actionId, params ?? {}, agentId, runId);
    if (!gate.allowed) return gate.result;

    // Yagona deshifrlash nuqtasi — barcha 15+ konnektor shu ctx.config'ni oladi
    // (decryptJson eski plaintext yozuvlarni ham qo'llab-quvvatlaydi).
    const result = await def.execute(actionId, params ?? {}, {
      config: this.crypto.decryptJson(cfg?.config),
      userId: user.id,
    });

    if (cfg) {
      await this.prisma.connectorConfig.update({
        where: { id: cfg.id },
        data: {
          lastUsedAt: new Date(),
          lastError: result.ok ? null : (result.error ?? null),
          ...(result.needs === 'credentials' ? { status: 'needs_credentials' } : {}),
        },
      });
    }

    await this.audit.record({
      actorId: user.id, action: 'connector.invoke', resourceType: 'connector_config',
      resourceId: cfg?.id ?? connectorId,
      metadata: { connectorId, actionId, ok: result.ok, needs: result.needs, agentId: agentId ?? null },
    });
    return result;
  }

  /**
   * Kanal bo'yicha xabar yuborish — Retail/Operations agentlari uchun yagona
   * yo'l ("bu tovar tugadi" xabari shu yerdan chiqadi).
   */
  async sendViaChannel(
    user: User,
    channel: string,
    target: string,
    text: string,
    subject?: string,
  ): Promise<ConnectorResult> {
    switch (channel) {
      case 'telegram':
        return this.invoke(user, 'telegram-bot', 'send_message', { chat_id: target, text });
      case 'whatsapp':
        return this.invoke(user, 'whatsapp-business', 'send_message', { to: target, text });
      case 'sms':
        return this.invoke(user, 'eskiz-sms', 'send_sms', { phone: target, text });
      case 'email':
        return this.invoke(user, 'smtp-email', 'send_email', { to: target, subject: subject ?? 'AgentNet', body: text });
      default:
        return { ok: false, error: `Noma'lum kanal: ${channel}` };
    }
  }
}
