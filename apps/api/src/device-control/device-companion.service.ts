import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { randomBytes, createHash, randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { DeviceControlService } from './device-control.service';
import type { DeviceCompanion, User } from '@prisma/client';

/**
 * BOSQICH 2/3 — Companion protokoli. Real qurilma (desktop/telefon) serverga
 * juftlash-kodi orqali bog'lanadi, buyruqlarni POLL qiladi, bajaradi va natijani
 * qaytaradi. Har buyruq DevicePermission bilan cheklangan (fail-closed) va
 * DeviceActionLog'ga yoziladi. Companion auth: bir martalik juftlash-kodi ->
 * doimiy token (server faqat sha256 hash saqlaydi).
 */

// Buyruq turi -> ruxsat toifasi (DevicePermission.isAllowed uchun) + qurilma turi.
const COMMAND_RULES: Record<string, { kind: 'computer' | 'phone'; category: string }> = {
  send_sms: { kind: 'phone', category: 'sms' },
  call: { kind: 'phone', category: 'calls' },
  open_app: { kind: 'phone', category: 'apps' },
  computer_use: { kind: 'computer', category: 'screen' },
};

@Injectable()
export class DeviceCompanionService {
  private readonly engineUrl = process.env.AGENT_ENGINE_URL ?? 'http://localhost:8000';

  constructor(
    private readonly prisma: PrismaService,
    private readonly device: DeviceControlService,
    private readonly http: HttpService,
  ) {}

  // ---- Dashboard (foydalanuvchi) ----

  /** Yangi companion yaratadi va 6-xonali juftlash-kodini qaytaradi. */
  async register(user: User, kind: string, name?: string) {
    if (kind !== 'computer' && kind !== 'phone') throw new BadRequestException("Noma'lum companion turi");
    const pairingCode = String(randomInt(100000, 1000000)); // 6 xona
    const row = await this.prisma.deviceCompanion.create({
      data: { userId: user.id, kind, name: name ?? null, pairingCode, status: 'pending' },
    });
    await this.device.logAction(user.id, {
      deviceType: kind,
      category: 'connect',
      action: `Companion yaratildi (${kind}) — juftlash kutilmoqda`,
    });
    return { id: row.id, kind, pairingCode };
  }

  async listCompanions(user: User) {
    const rows = await this.prisma.deviceCompanion.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((r) => this.publicCompanion(r));
  }

  /** Buyruq navbatga qo'yadi (ruxsat tekshiriladi). */
  async enqueue(user: User, cmdKind: string, payload: Record<string, unknown>) {
    const rule = COMMAND_RULES[cmdKind];
    if (!rule) throw new BadRequestException(`Noma'lum buyruq: ${cmdKind}`);

    const allowed = await this.device.isAllowed(user.id, rule.kind, rule.category);
    if (!allowed) {
      await this.device.logAction(user.id, {
        deviceType: rule.kind,
        category: rule.category,
        action: `Rad etildi (ruxsat yo'q): ${cmdKind}`,
        status: 'blocked',
      });
      throw new ForbiddenException(`'${rule.category}' ruxsati yoqilmagan — Qurilma Boshqaruvida yoqing`);
    }

    const companion = await this.prisma.deviceCompanion.findFirst({
      where: { userId: user.id, kind: rule.kind, status: 'paired' },
      orderBy: { lastSeenAt: 'desc' },
    });
    if (!companion) throw new NotFoundException(`Ulangan ${rule.kind}-companion topilmadi — avval juftlang`);

    const cmd = await this.prisma.deviceCommand.create({
      data: { companionId: companion.id, userId: user.id, kind: cmdKind, payload: payload as object, status: 'queued' },
    });
    await this.device.logAction(user.id, {
      deviceType: rule.kind,
      category: rule.category,
      action: `Buyruq navbatga qo'yildi: ${cmdKind}`,
      detail: JSON.stringify(payload).slice(0, 400),
    });
    return { id: cmd.id, status: cmd.status };
  }

  // ---- Companion (yordamchi ilova) ----

  /** Juftlash-kodini doimiy tokenga almashtiradi. */
  async pair(pairingCode: string) {
    const companion = await this.prisma.deviceCompanion.findUnique({ where: { pairingCode } });
    if (!companion) throw new NotFoundException("Juftlash-kodi noto'g'ri yoki muddati tugagan");
    const token = randomBytes(32).toString('base64url');
    await this.prisma.deviceCompanion.update({
      where: { id: companion.id },
      data: { tokenHash: this.hash(token), pairingCode: null, status: 'paired', pairedAt: new Date(), lastSeenAt: new Date() },
    });
    await this.device.logAction(companion.userId, {
      deviceType: companion.kind,
      category: 'connect',
      action: `Companion juftlandi (${companion.kind})`,
    });
    return { companionId: companion.id, kind: companion.kind, token };
  }

  /** Token orqali companion'ni topadi (poll/result uchun). */
  async authCompanion(token: string | undefined): Promise<DeviceCompanion | null> {
    if (!token) return null;
    const row = await this.prisma.deviceCompanion.findFirst({ where: { tokenHash: this.hash(token) } });
    return row ?? null;
  }

  /** Keyingi navbatdagi buyruqni beradi (running'ga o'tkazadi). lastSeenAt yangilanadi. */
  async poll(companion: DeviceCompanion) {
    await this.prisma.deviceCompanion.update({
      where: { id: companion.id },
      data: { lastSeenAt: new Date(), status: 'paired' },
    });
    const next = await this.prisma.deviceCommand.findFirst({
      where: { companionId: companion.id, status: 'queued' },
      orderBy: { createdAt: 'asc' },
    });
    if (!next) return { command: null };
    await this.prisma.deviceCommand.update({ where: { id: next.id }, data: { status: 'running' } });
    return { command: { id: next.id, kind: next.kind, payload: next.payload } };
  }

  /** Companion buyruq natijasini qaytaradi. */
  async result(companion: DeviceCompanion, commandId: string, status: string, result?: unknown) {
    const cmd = await this.prisma.deviceCommand.findFirst({ where: { id: commandId, companionId: companion.id } });
    if (!cmd) throw new NotFoundException('Buyruq topilmadi');
    const final = ['done', 'failed', 'denied'].includes(status) ? status : 'done';
    await this.prisma.deviceCommand.update({
      where: { id: cmd.id },
      data: { status: final, result: (result ?? null) as object },
    });
    await this.device.logAction(companion.userId, {
      deviceType: companion.kind,
      category: COMMAND_RULES[cmd.kind]?.category ?? cmd.kind,
      action: `Buyruq bajarildi: ${cmd.kind} (${final})`,
      detail: typeof result === 'string' ? result.slice(0, 400) : JSON.stringify(result ?? '').slice(0, 400),
      status: final === 'done' ? 'ok' : 'failed',
    });
    return { ok: true };
  }

  /**
   * B2 computer-use: companion skrinshot yuboradi, biz engine vision-planner'ga
   * uzatib keyingi harakatni qaytaramiz. Ruxsat: computer:screen (fail-closed).
   */
  async computerUsePlan(
    companion: DeviceCompanion,
    body: { goal: string; screenshot?: string; screen?: { width: number; height: number }; history?: unknown[] },
  ) {
    if (companion.kind !== 'computer') throw new BadRequestException('Faqat computer-companion');
    const allowed = await this.device.isAllowed(companion.userId, 'computer', 'screen');
    if (!allowed) throw new ForbiddenException("'screen' ruxsati yoqilmagan");
    const { data } = await firstValueFrom(
      this.http.post(
        `${this.engineUrl}/computer-use/plan`,
        { goal: body.goal, screenshot: body.screenshot, screen: body.screen, history: body.history ?? [] },
        { timeout: 60_000 },
      ),
    );
    return data;
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private publicCompanion(r: DeviceCompanion) {
    // tokenHash HECH QACHON chiqmaydi.
    return {
      id: r.id,
      kind: r.kind,
      name: r.name,
      status: r.status,
      pairingCode: r.status === 'pending' ? r.pairingCode : null,
      pairedAt: r.pairedAt,
      lastSeenAt: r.lastSeenAt,
    };
  }
}
