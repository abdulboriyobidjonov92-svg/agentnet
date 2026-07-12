import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../auth/auth.service';
import type { User } from '@prisma/client';

/** Nashr qilish / "shablonga aylantirish" va nashrdan olib tashlash. */
export class MarketplacePublishing {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  /**
   * Nashr qilish / "shablonga aylantirish" — is_marketplace_listed=true
   * (mavjud isPublished bayrog'i shu ma'noni bajaradi). `price`/`monthlyPrice`
   * berilmasa — agentning O'ZINING allaqachon to'langan narxi SAQLANIB
   * QOLADI (Y4, creationPriceTiyin/monthlyPriceTiyin — qayta kiritish shart
   * emas). originalCreatorId egasiga aniq belgilanadi (keyingi atributsiya uchun).
   */
  async publish(agentId: string, user: User, price?: number, description?: string, monthlyPrice?: number) {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Agent topilmadi');
    if (agent.userId !== user.id) throw new ForbiddenException();

    const creationPriceTiyin = price !== undefined ? Math.max(0, Math.round(price)) : agent.creationPriceTiyin;
    const monthlyPriceTiyin = monthlyPrice !== undefined ? Math.max(0, Math.round(monthlyPrice)) : agent.monthlyPriceTiyin;

    const updated = await this.prisma.agent.update({
      where: { id: agentId },
      data: {
        isPublished: true,
        marketplacePrice: creationPriceTiyin,
        creationPriceTiyin,
        monthlyPriceTiyin,
        originalCreatorId: agent.userId,
        ...(description !== undefined && { description }),
      },
    });
    await this.audit.record({ actorId: user.id, action: 'marketplace.publish', resourceType: 'agent', resourceId: agentId });
    return updated;
  }

  async unpublish(agentId: string, user: User) {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException();
    if (agent.userId !== user.id) throw new ForbiddenException();
    return this.prisma.agent.update({ where: { id: agentId }, data: { isPublished: false } });
  }
}
