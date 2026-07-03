import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../auth/auth.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import type { User } from '@prisma/client';

@Injectable()
export class AgentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    private readonly audit: AuditLogService,
  ) {}

  async create(user: User, dto: CreateAgentDto) {
    const agent = await this.prisma.agent.create({
      data: {
        name: dto.name,
        systemPrompt: dto.systemPrompt,
        model: dto.model ?? 'claude-sonnet-4-6',
        halalFilterEnabled: dto.halalFilterEnabled ?? true,
        memoryEnabled: dto.memoryEnabled ?? true,
        toolsConfig: (dto.toolsConfig ?? []) as object,
        vertical: dto.vertical ?? null,
        description: dto.description ?? null,
        userId: user.id,
      },
    });
    await this.audit.record({ actorId: user.id, action: 'agent.create', resourceType: 'agent', resourceId: agent.id });
    return agent;
  }

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

  async run(id: string, user: User, message: string, conversationId?: string) {
    const agent = await this.findOne(id, user);
    const engineUrl = process.env.AGENT_ENGINE_URL ?? 'http://localhost:8000';

    const { data } = await firstValueFrom(
      this.http.post(`${engineUrl}/agents/run`, {
        agent_definition: {
          agent_id: agent.id,
          name: agent.name,
          system_prompt: agent.systemPrompt,
          model: agent.model,
          tools: agent.toolsConfig,
          halal_filter_enabled: agent.halalFilterEnabled,
          memory_enabled: agent.memoryEnabled,
        },
        user_id: user.id,
        message,
      }),
    );

    // Conversation ga yozish
    const convId = conversationId ?? (await this.prisma.conversation.create({
      data: { userId: user.id, agentId: agent.id, messages: [] },
    })).id;

    const existing = await this.prisma.conversation.findUnique({ where: { id: convId } });
    const messages = (existing?.messages as any[]) ?? [];
    messages.push(
      { role: 'user', content: message, timestamp: new Date().toISOString() },
      { role: 'assistant', content: data.messages?.at(-1)?.content ?? '', halalFlag: data.halal_flag, timestamp: new Date().toISOString() },
    );
    await this.prisma.conversation.update({ where: { id: convId }, data: { messages } });

    return { ...data, conversationId: convId };
  }
}
