import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../auth/auth.service';
import { ConnectorsService } from '../connectors/connectors.service';
import { OperationsEngineClient } from './engine-client';
import type { User } from '@prisma/client';

/** Tashqi kommunikatsiya: qoralama (agent) -> tasdiq (ega) -> yuborish (Connector SDK). */
export class OperationsOutbound {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly connectors: ConnectorsService,
    private readonly engine: OperationsEngineClient,
  ) {}

  async draftOutbound(
    user: User,
    dto: { purpose: string; audience?: string; recipientName?: string; recipientContact: string; channel?: string; context?: string },
  ) {
    const org = user.orgId ? await this.prisma.org.findUnique({ where: { id: user.orgId } }) : null;
    const draft = await this.engine.call('/ops/outbound-draft', {
      purpose: dto.purpose,
      audience: dto.audience ?? 'client',
      recipient_name: dto.recipientName ?? '',
      channel: dto.channel ?? 'telegram',
      org_name: org?.name ?? '',
      context: dto.context ?? '',
      language: user.preferredLanguage ?? 'en',
    });

    const msg = await this.prisma.outboundMessage.create({
      data: {
        userId: user.id, orgId: user.orgId ?? null,
        audience: dto.audience ?? 'client',
        recipientName: dto.recipientName ?? null,
        recipientContact: dto.recipientContact,
        channel: dto.channel ?? 'telegram',
        subject: draft.subject || null,
        body: draft.body,
        meta: { purpose: dto.purpose, method: draft.method },
      },
    });
    return msg;
  }

  /** Yuborish — faqat egasi tasdiqlagandan keyin (approve → send bitta qadamda). */
  async approveAndSend(user: User, id: string) {
    const msg = await this.prisma.outboundMessage.findFirst({ where: { id, userId: user.id } });
    if (!msg) throw new NotFoundException('Xabar topilmadi');

    const res = await this.connectors.sendViaChannel(
      user, msg.channel, msg.recipientContact, msg.body, msg.subject ?? undefined,
    );

    const updated = await this.prisma.outboundMessage.update({
      where: { id },
      data: {
        status: res.ok ? 'sent' : 'failed',
        sentAt: res.ok ? new Date() : null,
        meta: { ...((msg.meta as object) ?? {}), deliveryResult: res.ok ? 'ok' : res.error },
      },
    });

    await this.audit.record({
      actorId: user.id, action: 'ops.outbound_send', resourceType: 'outbound_message', resourceId: id,
      metadata: { channel: msg.channel, ok: res.ok, needs: res.needs },
    });
    return { message: updated, delivery: res };
  }

  async updateOutbound(user: User, id: string, dto: { body?: string; subject?: string }) {
    const msg = await this.prisma.outboundMessage.findFirst({ where: { id, userId: user.id } });
    if (!msg) throw new NotFoundException('Xabar topilmadi');
    return this.prisma.outboundMessage.update({
      where: { id },
      data: { ...(dto.body && { body: dto.body }), ...(dto.subject !== undefined && { subject: dto.subject }) },
    });
  }

  async listOutbound(user: User) {
    return this.prisma.outboundMessage.findMany({
      where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 50,
    });
  }
}
