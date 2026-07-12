import { PrismaService } from '../prisma/prisma.service';
import type { User } from '@prisma/client';

/** Alertlar tarixi va bildirishnoma sozlamalari (kanal, manzil, avto-yuborish). */
export class RetailAlertsSettings {
  constructor(private readonly prisma: PrismaService) {}

  async listAlerts(user: User) {
    return this.prisma.retailAlert.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  async getSettings(user: User) {
    return (
      (await this.prisma.retailSettings.findUnique({ where: { userId: user.id } })) ?? {
        channel: 'telegram', target: null, autoNotify: true,
      }
    );
  }

  async saveSettings(user: User, dto: { channel?: string; target?: string; autoNotify?: boolean }) {
    return this.prisma.retailSettings.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        channel: dto.channel ?? 'telegram',
        target: dto.target ?? null,
        autoNotify: dto.autoNotify ?? true,
      },
      update: {
        ...(dto.channel !== undefined && { channel: dto.channel }),
        ...(dto.target !== undefined && { target: dto.target }),
        ...(dto.autoNotify !== undefined && { autoNotify: dto.autoNotify }),
      },
    });
  }
}
