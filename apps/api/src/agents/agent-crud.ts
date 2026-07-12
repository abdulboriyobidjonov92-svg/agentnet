import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../auth/auth.service';
import { UpdateAgentDto } from './dto/update-agent.dto';
import type { User } from '@prisma/client';

/** Agentlar ustidan oddiy CRUD — egalik tekshiruvi bilan. */
export class AgentCrud {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async findAll(user: User) {
    return this.prisma.agent.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, user: User) {
    const agent = await this.prisma.agent.findUnique({ where: { id } });
    if (!agent) throw new NotFoundException('Agent topilmadi');
    if (agent.userId !== user.id) throw new ForbiddenException();
    return agent;
  }

  /**
   * Ishonch-jurnali — shu agent bo'yicha AuditLog'dagi barcha yozuvlar.
   * Faqat egasi ko'ra oladi (findOne bilan bir xil tekshiruv). Xom xash-zanjir
   * ko'rsatilmaydi — faqat foydalanuvchiga tegishli harakat+kontekst.
   */
  async trustLog(id: string, user: User) {
    await this.findOne(id, user);
    const entries = await this.prisma.auditLog.findMany({
      where: { resourceType: 'agent', resourceId: id },
      orderBy: { createdAt: 'asc' },
      select: { action: true, metadata: true, createdAt: true },
    });
    return entries;
  }

  async update(id: string, user: User, dto: UpdateAgentDto) {
    await this.findOne(id, user);
    return this.prisma.agent.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.systemPrompt && { systemPrompt: dto.systemPrompt }),
        ...(dto.model && { model: dto.model }),
        ...(dto.halalFilterEnabled !== undefined && { halalFilterEnabled: dto.halalFilterEnabled }),
        ...(dto.memoryEnabled !== undefined && { memoryEnabled: dto.memoryEnabled }),
        ...(dto.toolsConfig && { toolsConfig: dto.toolsConfig as object }),
        ...(dto.vertical !== undefined && { vertical: dto.vertical }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isPublished !== undefined && { isPublished: dto.isPublished }),
        ...(dto.marketplacePrice !== undefined && { marketplacePrice: dto.marketplacePrice }),
      },
    });
  }

  async remove(id: string, user: User) {
    await this.findOne(id, user);
    await this.prisma.agent.delete({ where: { id } });
    await this.audit.record({ actorId: user.id, action: 'agent.delete', resourceType: 'agent', resourceId: id });
  }
}
