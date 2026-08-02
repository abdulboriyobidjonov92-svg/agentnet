import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { User } from '@prisma/client';

/**
 * BOSQICH 1 — Qurilma Boshqaruvi: ruxsatlar + xavfsizlik-log.
 *
 * Ikki mustaqil qurilma-turi (computer, phone). Har biri uchun toifalar bo'yicha
 * ALOHIDA ruxsat. Sukut bo'yicha HAMMASI o'chiq — agent faqat foydalanuvchi ochiq
 * yoqqan toifada ish qila oladi (fail-closed). Har harakat audit-logga yoziladi.
 */

export const DEVICE_CATEGORIES: Record<string, string[]> = {
  computer: ['browser', 'files', 'apps', 'screen'],
  phone: ['apps', 'calls', 'sms', 'screen'],
};

export interface DeviceActionInput {
  deviceType: string;
  category: string;
  action: string;
  detail?: string;
  status?: 'ok' | 'blocked' | 'failed';
}

@Injectable()
export class DeviceControlService {
  constructor(private readonly prisma: PrismaService) {}

  /** Har qurilma-turi uchun toifalar + joriy yoqilgan/o'chirilgan holati. */
  async getStatus(user: User) {
    const rows = await this.prisma.devicePermission.findMany({ where: { userId: user.id } });
    const enabledMap = new Map(rows.map((r) => [`${r.deviceType}:${r.category}`, r.enabled]));

    const devices = Object.entries(DEVICE_CATEGORIES).map(([deviceType, categories]) => ({
      deviceType,
      // "connected" = foydalanuvchi shu qurilma uchun ruxsat-oqimidan o'tган
      // (kamida bitta toifa yozuvi bor).
      connected: rows.some((r) => r.deviceType === deviceType),
      categories: categories.map((category) => ({
        category,
        enabled: enabledMap.get(`${deviceType}:${category}`) ?? false,
      })),
    }));
    return { devices };
  }

  /** Bitta toifa ruxsatini yoqadi/o'chiradi (upsert). */
  async setPermission(user: User, deviceType: string, category: string, enabled: boolean) {
    this.assertValid(deviceType, category);
    await this.prisma.devicePermission.upsert({
      where: { userId_deviceType_category: { userId: user.id, deviceType, category } },
      create: { userId: user.id, deviceType, category, enabled },
      update: { enabled },
    });
    await this.logAction(user.id, {
      deviceType,
      category,
      action: enabled ? `Ruxsat yoqildi: ${category}` : `Ruxsat o'chirildi: ${category}`,
      status: 'ok',
    });
    return this.getStatus(user);
  }

  /**
   * Qurilmani "ulash" — ruxsat-oqimini boshlaydi: barcha toifalar uchun yozuv
   * yaratadi (o'chiq holatda), shunda UI ularni ko'rsatadi va foydalanuvchi
   * kerakligini yoqadi.
   */
  async connect(user: User, deviceType: string) {
    const categories = DEVICE_CATEGORIES[deviceType];
    if (!categories) throw new BadRequestException(`Noma'lum qurilma-turi: ${deviceType}`);
    await this.prisma.$transaction(
      categories.map((category) =>
        this.prisma.devicePermission.upsert({
          where: { userId_deviceType_category: { userId: user.id, deviceType, category } },
          create: { userId: user.id, deviceType, category, enabled: false },
          update: {},
        }),
      ),
    );
    await this.logAction(user.id, {
      deviceType,
      category: 'connect',
      action: `Qurilma ulandi: ${deviceType}`,
      status: 'ok',
    });
    return this.getStatus(user);
  }

  /** Ruxsatni tekshiradi — kelajakdagi agentlar (B2/B3) shu orqali fail-closed. */
  async isAllowed(userId: string, deviceType: string, category: string): Promise<boolean> {
    const row = await this.prisma.devicePermission.findUnique({
      where: { userId_deviceType_category: { userId: userId, deviceType, category } },
    });
    return !!row?.enabled;
  }

  /** Xavfsizlik-logga yozadi (best-effort — asosiy oqimni yiqitmasligi kerak). */
  async logAction(userId: string, input: DeviceActionInput) {
    return this.prisma.deviceActionLog
      .create({
        data: {
          userId,
          deviceType: input.deviceType,
          category: input.category,
          action: input.action.slice(0, 300),
          detail: input.detail?.slice(0, 1000) ?? null,
          status: input.status ?? 'ok',
        },
      })
      .catch(() => null);
  }

  async listActions(user: User, limit = 50) {
    return this.prisma.deviceActionLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });
  }

  private assertValid(deviceType: string, category: string) {
    const categories = DEVICE_CATEGORIES[deviceType];
    if (!categories) throw new BadRequestException(`Noma'lum qurilma-turi: ${deviceType}`);
    if (!categories.includes(category)) {
      throw new BadRequestException(`'${deviceType}' uchun noma'lum toifa: ${category}`);
    }
  }
}
