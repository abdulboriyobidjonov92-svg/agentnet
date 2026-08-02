import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { DeviceControlService } from './device-control.service';
import type { CallRecording, User } from '@prisma/client';

/**
 * BOSQICH 5 — Qo'ng'iroqni yozib olish (huquqiy xavf yuqori — beta).
 *
 * MAJBURIY: yaratishdan oldin foydalanuvchi huquqiy ogohlantirishni TASDIQLAYDI
 * (consentAck=true) — ba'zi mamlakatlarda suhbatdosh roziligisiz yozib olish
 * NOQONUNIY, javobgarlik foydalanuvchida. Yozuv CryptoService bilan SHIFRLANADI.
 * Audio'ning o'zini server HECH QACHON list/metadata'da qaytarmaydi — faqat
 * aniq `get(id)` da deshifrlab beradi.
 */
@Injectable()
export class CallRecordingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly device: DeviceControlService,
  ) {}

  async create(
    user: User,
    dto: { data: string; mimeType?: string; durationSec?: number; label?: string; consentAck: boolean; partyNotified?: boolean },
  ) {
    if (dto.consentAck !== true) {
      throw new BadRequestException('Huquqiy ogohlantirish tasdiqlanishi shart (consentAck).');
    }
    if (!dto.data || typeof dto.data !== 'string') throw new BadRequestException("Audio ma'lumot yo'q");

    const row = await this.prisma.callRecording.create({
      data: {
        userId: user.id,
        label: dto.label ?? null,
        mimeType: dto.mimeType ?? 'audio/webm',
        durationSec: dto.durationSec ?? 0,
        data: this.crypto.encrypt(dto.data), // shifrlash
        consentAck: true,
        partyNotified: dto.partyNotified ?? false,
      },
    });
    await this.device.logAction(user.id, {
      deviceType: 'phone',
      category: 'calls',
      action: `Qo'ng'iroq yozildi (${row.durationSec}s)`,
      detail: row.label ?? undefined,
      status: 'ok',
    });
    return this.publicRec(row);
  }

  async list(user: User) {
    const rows = await this.prisma.callRecording.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.publicRec(r));
  }

  /** Deshifrlangan audio (playback/download uchun). */
  async get(user: User, id: string) {
    const row = await this.prisma.callRecording.findFirst({ where: { id, userId: user.id } });
    if (!row) throw new NotFoundException('Yozuv topilmadi');
    return { ...this.publicRec(row), data: this.crypto.decrypt(row.data) };
  }

  async remove(user: User, id: string) {
    const row = await this.prisma.callRecording.findFirst({ where: { id, userId: user.id } });
    if (!row) throw new NotFoundException('Yozuv topilmadi');
    await this.prisma.callRecording.delete({ where: { id } });
    await this.device.logAction(user.id, {
      deviceType: 'phone',
      category: 'calls',
      action: `Qo'ng'iroq yozuvi o'chirildi`,
      status: 'ok',
    });
    return { ok: true };
  }

  /** `data` (shifrlangan audio) list/metadata'da HECH QACHON chiqmaydi. */
  private publicRec(r: CallRecording) {
    return {
      id: r.id,
      label: r.label,
      mimeType: r.mimeType,
      durationSec: r.durationSec,
      consentAck: r.consentAck,
      partyNotified: r.partyNotified,
      createdAt: r.createdAt,
    };
  }
}
