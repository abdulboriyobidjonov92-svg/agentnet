import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../auth/auth.service';
import { CONNECTORS, connectorById } from './connectors.registry';
import { missingFields, ConnectorResult } from './connector.types';
import type { User } from '@prisma/client';

@Injectable()
export class ConnectorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  /** Katalog + foydalanuvchining ulanish holati (sirlar qaytarilmaydi). */
  async catalog(user: User | null) {
    const configs = user
      ? await this.prisma.connectorConfig.findMany({ where: { userId: user.id } })
      : [];
    const byConnector = new Map(configs.map((c) => [c.connectorId, c]));

    return CONNECTORS.map((def) => {
      const cfg = byConnector.get(def.id);
      return {
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

  /** Configni saqlaydi; majburiy maydonlar yetishmasa halol holat qo'yadi. */
  async configure(user: User, connectorId: string, config: Record<string, any>) {
    const def = connectorById.get(connectorId);
    if (!def) throw new NotFoundException(`Connector topilmadi: ${connectorId}`);

    const miss = missingFields(def, config ?? {});
    const status = miss.length ? 'needs_credentials' : 'connected';

    const saved = await this.prisma.connectorConfig.upsert({
      where: { userId_connectorId_label: { userId: user.id, connectorId, label: 'default' } },
      create: { userId: user.id, connectorId, label: 'default', config: config ?? {}, status },
      update: { config: config ?? {}, status, lastError: null },
    });

    await this.audit.record({
      actorId: user.id, action: 'connector.configure', resourceType: 'connector_config',
      resourceId: saved.id, metadata: { connectorId, status },
    });
    return { id: saved.id, connectorId, status, missing: miss };
  }

  async remove(user: User, connectorId: string) {
    await this.prisma.connectorConfig.deleteMany({ where: { userId: user.id, connectorId } });
    return { removed: true };
  }

  /** Amalni bajaradi — SDKning yagona ijro nuqtasi (UI, agentlar, boshqa servislar). */
  async invoke(
    user: User,
    connectorId: string,
    actionId: string,
    params: Record<string, any>,
  ): Promise<ConnectorResult> {
    const def = connectorById.get(connectorId);
    if (!def) throw new NotFoundException(`Connector topilmadi: ${connectorId}`);

    const cfg = await this.prisma.connectorConfig.findUnique({
      where: { userId_connectorId_label: { userId: user.id, connectorId, label: 'default' } },
    });

    const result = await def.execute(actionId, params ?? {}, {
      config: (cfg?.config as Record<string, any>) ?? {},
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
      resourceId: cfg?.id ?? connectorId, metadata: { connectorId, actionId, ok: result.ok, needs: result.needs },
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
