import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../auth/auth.service';
import { CryptoService } from '../crypto/crypto.service';
import { CONNECTORS, connectorById } from './connectors.registry';
import { missingFields, ConnectorResult } from './connector.types';
import type { User } from '@prisma/client';

/** Agentga biriktirilgan yozuvning `label` prefiksi (unique kaliti o'zgarmadi). */
const AGENT_LABEL_PREFIX = 'agent:';

/** Engine ToolSpec `tool_id` prefiksi — `agent_tools.py` shu bilan tanidi. */
export const CONNECTOR_TOOL_PREFIX = 'connector.';

@Injectable()
export class ConnectorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly crypto: CryptoService,
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

    return CONNECTORS.map((def) => {
      const cfg = byConnector.get(def.id);
      return {
        attachedAgentIds: agentsByConnector.get(def.id) ?? [],
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

  /** Begona agentga konnektor biriktirib bo'lmaydi (IDOR himoyasi). */
  private async assertOwnsAgent(user: User, agentId: string) {
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, userId: user.id },
      select: { id: true },
    });
    if (!agent) throw new NotFoundException(`Agent topilmadi: ${agentId}`);
  }

  async remove(user: User, connectorId: string) {
    await this.prisma.connectorConfig.deleteMany({ where: { userId: user.id, connectorId } });
    return { removed: true };
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
