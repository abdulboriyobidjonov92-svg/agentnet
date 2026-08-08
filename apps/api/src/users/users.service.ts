import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { org: { select: { name: true, slug: true } } },
    });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    const { twoFactorSecret, twoFactorSecretPending, ...safe } = user;
    return safe;
  }

  /**
   * SEC-05 prerequisite: `role` bu yerdan ATAYLAB olib tashlandi. Rol —
   * avtorizatsiya kaliti; uni foydalanuvchi o'z profil-yangilash yo'li orqali
   * o'zgartira olmasligi SHART. Rol tayinlash — kelajakdagi admin yo'lining
   * ishi (§6.1: faqat OWNER), bu endpointning emas.
   */
  async updateProfile(
    userId: string,
    dto: {
      isBusinessAccount?: boolean;
      name?: string;
      tourCompleted?: boolean;
      briefingOptIn?: boolean;
    },
  ) {
    const data = { ...dto, ...(dto.name !== undefined ? { name: dto.name.trim() || null } : {}) };
    return this.prisma.user.update({ where: { id: userId }, data });
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

  /**
   * GDPR — foydalanuvchining barcha ma'lumotlarini eksport qiladi (L13).
   * Sirlar (2FA sirlari, shifrlangan konnektor tokenlari) EKSPORT QILINMAYDI —
   * faqat metama'lumot. Foydalanuvchi o'z ma'lumotini olib chiqish huquqiga ega.
   */
  async exportData(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { twoFactorSecret, twoFactorSecretPending, ...safeUser } = user;

    const [agents, conversations, creditLedger, connectors, feedback, usage] = await Promise.all([
      this.prisma.agent.findMany({ where: { userId } }),
      // A15: xabarlar endi Message jadvalida — GDPR eksport ularni ham beradi
      // (legacy Json ustuni muzlatilgan, eksportga kirmaydi).
      this.prisma.conversation.findMany({
        where: { userId },
        select: {
          id: true, agentId: true, createdAt: true, updatedAt: true,
          messages: {
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            select: { role: true, content: true, halalFlag: true, demoMode: true, createdAt: true },
          },
        },
      }),
      this.prisma.creditLedger.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      // Konnektor SIRLARI (shifrlangan `config`) eksport qilinmaydi — faqat metama'lumot.
      this.prisma.connectorConfig.findMany({
        where: { userId },
        select: { connectorId: true, label: true, status: true, createdAt: true, lastUsedAt: true },
      }),
      this.prisma.feedback.findMany({ where: { userId } }),
      this.prisma.usageCounter.findMany({ where: { userId } }),
    ]);

    return { exportedAt: new Date().toISOString(), user: safeUser, agents, conversations, creditLedger, connectors, feedback, usage };
  }

  /**
   * GDPR — hisobni va unga bog'liq barcha ma'lumotlarni butunlay o'chiradi (L13).
   * Uch bog'lanish (Agent.user, Conversation.user, AuditLog.actor) onDelete:Cascade
   * EMAS (Restrict) — ular `user.delete`ni bloklaydi. Shuning uchun avval ularni
   * ochiq o'chiramiz, keyin `user.delete` qolgan ~25 Cascade bog'lanishni (kredit
   * daftari, konnektorlar, hisoblagichlar, to'lovlar...) avtomatik tozalaydi.
   * Hammasi bitta $transaction'da — yarim-o'chirilgan holat qolmaydi.
   */
  async deleteAccount(userId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.auditLog.deleteMany({ where: { actorId: userId } });
      await tx.conversation.deleteMany({ where: { userId } });
      await tx.agent.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
    });
    return { deleted: true };
  }
}
