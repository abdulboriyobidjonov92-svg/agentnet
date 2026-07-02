import { Injectable, NotFoundException, ForbiddenException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TwinService } from '../twin/twin.service';
import type { User } from '@prisma/client';

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  halalFlag?: string;
  timestamp: string;
}

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly twin?: TwinService,
  ) {}

  async create(user: User, agentId: string) {
    // Agent mavjudligini tekshirish
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Agent topilmadi');

    return this.prisma.conversation.create({
      data: { userId: user.id, agentId, messages: [] },
      include: { agent: { select: { name: true, model: true } } },
    });
  }

  async findAll(user: User, agentId?: string) {
    return this.prisma.conversation.findMany({
      where: { userId: user.id, ...(agentId && { agentId }) },
      orderBy: { updatedAt: 'desc' },
      include: { agent: { select: { name: true } } },
    });
  }

  async findOne(id: string, user: User) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id },
      include: { agent: { select: { name: true, model: true, systemPrompt: true } } },
    });
    if (!conv) throw new NotFoundException('Suhbat topilmadi');
    if (conv.userId !== user.id) throw new ForbiddenException();
    return conv;
  }

  async addMessage(id: string, user: User, message: ConversationMessage) {
    const conv = await this.findOne(id, user);
    const messages = ((conv.messages as unknown) as ConversationMessage[]) ?? [];
    messages.push(message);
    return this.prisma.conversation.update({
      where: { id },
      data: { messages: messages as unknown as object },
    });
  }

  async addMessages(id: string, user: User, newMessages: ConversationMessage[]) {
    const conv = await this.findOne(id, user);
    const messages = ((conv.messages as unknown) as ConversationMessage[]) ?? [];
    messages.push(...newMessages);
    const updated = await this.prisma.conversation.update({
      where: { id },
      data: { messages: messages as unknown as object },
    });

    // Life Twin: foydalanuvchi xabarlaridan faktlar fon rejimida ajratiladi.
    // Fire-and-forget — suhbat oqimini hech qachon sekinlashtirmaydi.
    const userText = newMessages
      .filter((m) => m.role === 'user')
      .map((m) => m.content)
      .join('\n');
    if (userText && this.twin) {
      void this.twin.extractAndStore(user, userText, 'conversation');
    }

    return updated;
  }

  async clear(id: string, user: User) {
    await this.findOne(id, user);
    return this.prisma.conversation.update({ where: { id }, data: { messages: [] } });
  }

  async remove(id: string, user: User) {
    await this.findOne(id, user);
    return this.prisma.conversation.delete({ where: { id } });
  }
}
