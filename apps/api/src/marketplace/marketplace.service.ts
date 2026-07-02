import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../auth/auth.service';
import type { User } from '@prisma/client';

@Injectable()
export class MarketplaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async listPublished(search?: string) {
    return this.prisma.agent.findMany({
      where: {
        isPublished: true,
        ...(search && { name: { contains: search } }),
      },
      select: {
        id: true, name: true, model: true, halalFilterEnabled: true,
        marketplacePrice: true, createdAt: true,
        user: { select: { email: true } },
        toolsConfig: true,
        _count: { select: { conversations: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async publish(agentId: string, user: User, price?: number) {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Agent topilmadi');
    if (agent.userId !== user.id) throw new ForbiddenException();

    const updated = await this.prisma.agent.update({
      where: { id: agentId },
      data: { isPublished: true, marketplacePrice: price ?? 0 },
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

  async install(publishedAgentId: string, user: User) {
    const source = await this.prisma.agent.findUnique({ where: { id: publishedAgentId } });
    if (!source || !source.isPublished) throw new NotFoundException('Marketplace agenti topilmadi');

    // Agent nusxasini yaratish
    const installed = await this.prisma.agent.create({
      data: {
        name: `${source.name} (o'rnatildi)`,
        systemPrompt: source.systemPrompt,
        model: source.model,
        halalFilterEnabled: source.halalFilterEnabled,
        memoryEnabled: source.memoryEnabled,
        toolsConfig: source.toolsConfig as any,
        userId: user.id,
        isPublished: false,
      },
    });
    await this.audit.record({ actorId: user.id, action: 'marketplace.install', resourceType: 'agent', resourceId: publishedAgentId, metadata: { installedId: installed.id } });
    return installed;
  }
}
