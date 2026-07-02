import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
type Role = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async syncFromClerk(clerkId: string, email: string) {
    return this.prisma.user.upsert({
      where: { clerkId },
      update: { email },
      create: { clerkId, email, role: 'MEMBER', twoFactorEnabled: false, isBusinessAccount: false },
    });
  }

  async findByClerkId(clerkId: string) {
    return this.prisma.user.findUnique({ where: { clerkId } });
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { org: { select: { name: true, slug: true } } },
    });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    const { twoFactorSecret, twoFactorSecretPending, ...safe } = user;
    return safe;
  }

  async updateProfile(userId: string, dto: { isBusinessAccount?: boolean; role?: Role }) {
    return this.prisma.user.update({ where: { id: userId }, data: dto });
  }

  async updateValues(userId: string, dto: { tradition?: string; statements?: string[] }) {
    const tradition = ['islamic', 'secular', 'mixed'].includes(dto.tradition ?? '')
      ? dto.tradition
      : 'islamic';
    const statements = (dto.statements ?? [])
      .map((s) => String(s).trim())
      .filter(Boolean)
      .slice(0, 10);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { valuesProfile: { tradition, statements } },
    });
    return user.valuesProfile;
  }

  async getStats(userId: string) {
    const [agentCount, conversationCount] = await Promise.all([
      this.prisma.agent.count({ where: { userId } }),
      this.prisma.conversation.count({ where: { userId } }),
    ]);
    return { agentCount, conversationCount };
  }
}
