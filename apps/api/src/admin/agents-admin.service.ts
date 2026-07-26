import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateAgentAdminDto } from './dto/update-agent-admin.dto';

@Injectable()
export class AgentsAdminService {
  constructor(private readonly prisma: PrismaService) {}

  list(params: { search?: string; categoryId?: string; publishedOnly?: boolean; limit?: number }) {
    return this.prisma.agent.findMany({
      where: {
        name: params.search ? { contains: params.search, mode: 'insensitive' } : undefined,
        categoryId: params.categoryId,
        isPublished: params.publishedOnly ? true : undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(params.limit ?? 100, 1), 500),
      select: {
        id: true, name: true, description: true, vertical: true,
        isPublished: true, verified: true, frozen: true, halalFilterEnabled: true,
        marketplacePrice: true, installCount: true, usageCount: true, ratingAvg: true,
        categoryId: true, category: { select: { id: true, name: true } },
        user: { select: { id: true, email: true, name: true } },
        createdAt: true, updatedAt: true,
      },
    });
  }

  async update(id: string, dto: UpdateAgentAdminDto) {
    await this.assertExists(id);
    return this.prisma.agent.update({
      where: { id },
      data: dto,
      select: {
        id: true, name: true, isPublished: true, verified: true, frozen: true,
        halalFilterEnabled: true, marketplacePrice: true, categoryId: true,
      },
    });
  }

  async remove(id: string) {
    await this.assertExists(id);
    await this.prisma.agent.delete({ where: { id } });
    return { id, deleted: true };
  }

  private async assertExists(id: string) {
    const exists = await this.prisma.agent.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Agent topilmadi');
  }
}
