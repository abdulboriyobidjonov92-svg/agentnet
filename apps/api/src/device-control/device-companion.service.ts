import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { DeviceControlService } from './device-control.service';
import { ConnectorsService } from '../connectors/connectors.service';
import { BillingService } from '../billing/billing.service';
import { UsageService } from '../usage/usage.service';
import type { DeviceCompanion, User, CommandKind, CommandStatus, DeviceCategory } from '@prisma/client';

/**
 * BOSQICH 2/3 — Companion protokoli. Real qurilma (desktop/telefon) serverga
 * juftlash-kodi orqali bog'lanadi, buyruqlarni POLL qiladi, bajaradi va natijani
 * qaytaradi. Har buyruq DevicePermission bilan cheklangan (fail-closed) va
 * DeviceActionLog'ga yoziladi. Companion auth: bir martalik juftlash-kodi ->
 * doimiy token (server faqat sha256 hash saqlaydi).
 *
 * SEC-01 (Engineering Contract, Phase 1): pairing endi (1) 10 daqiqada
 * muddati o'tadi, (2) 12-belgili base32 (6-xonali sondan ancha kattaroq
 * maydon), (3) muvaffaqiyatli juftlashda foydalanuvchiga bildirishnoma
 * yuboriladi, (4) token 30 kunda /companion/refresh orqali yangilanadi.
 *
 * SEC-02 (Phase 1): computerUsePlan() endi chargeForMessage + consumeChat
 * orqali o'tadi — xuddi agents.service.ts'dagi run() bilan bir xil prepaid
 * naqsh (bu yerda ham BFF emas, to'g'ridan-to'g'ri servis-ichi DI chaqiruvi).
 */

// Buyruq turi -> ruxsat toifasi (DevicePermission.isAllowed uchun) + qurilma turi.
const COMMAND_RULES: Record<CommandKind, { kind: 'computer' | 'phone'; category: DeviceCategory }> = {
  send_sms: { kind: 'phone', category: 'sms' },
  call: { kind: 'phone', category: 'calls' },
  open_app: { kind: 'phone', category: 'apps' },
  computer_use: { kind: 'computer', category: 'screen' },
};

// RFC4648 base32 alifbosi (32 belgi). 256 % 32 === 0, shuning uchun
// `byte % 32` bilan tekis (bias'siz) tanlov — bitta bayt bitta belgini beradi.
const PAIRING_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const PAIRING_CODE_LENGTH = 12; // 32^12 ≈ 1.15e18 — brute-force amaliy jihatdan imkonsiz
const PAIRING_CODE_TTL_MS = 10 * 60 * 1000; // 10 daqiqa

/** Kriptografik tasodifiy 12-belgili base32 juftlash-kodi. */
function generatePairingCode(): string {
  const bytes = randomBytes(PAIRING_CODE_LENGTH);
  let code = '';
  for (let i = 0; i < PAIRING_CODE_LENGTH; i++) {
    code += PAIRING_CODE_ALPHABET[bytes[i] % PAIRING_CODE_ALPHABET.length];
  }
  return code;
}

@Injectable()
export class DeviceCompanionService {
  private readonly engineUrl = process.env.AGENT_ENGINE_URL ?? 'http://localhost:8000';

  constructor(
    private readonly prisma: PrismaService,
    private readonly device: DeviceControlService,
    private readonly http: HttpService,
    private readonly connectors: ConnectorsService,
    private readonly billing: BillingService,
    private readonly usage: UsageService,
  ) {}

  // ---- Dashboard (foydalanuvchi) ----

  /** Yangi companion yaratadi va 12-belgili base32 juftlash-kodini qaytaradi (10 daq amal qiladi). */
  async register(user: User, kind: string, name?: string) {
    if (kind !== 'computer' && kind !== 'phone') throw new BadRequestException("Noma'lum companion turi");
    const pairingCode = generatePairingCode();
    const row = await this.prisma.deviceCompanion.create({
      data: {
        userId: user.id,
        kind,
        name: name ?? null,
        pairingCode,
        pairingExpiresAt: new Date(Date.now() + PAIRING_CODE_TTL_MS),
        status: 'pending',
      },
    });
    await this.device.logAction(user.id, {
      deviceType: kind,
      category: 'connect',
      action: `Companion yaratildi (${kind}) — juftlash kutilmoqda`,
    });
    return { id: row.id, kind, pairingCode, pairingExpiresAt: row.pairingExpiresAt };
  }

  async listCompanions(user: User) {
    const rows = await this.prisma.deviceCompanion.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((r) => this.publicCompanion(r));
  }

  /** Buyruq navbatga qo'yadi (ruxsat tekshiriladi). */
  async enqueue(user: User, cmdKindRaw: string, payload: Record<string, unknown>) {
    // HTTP'dan kelgan xom matn — registrda borligini tekshirib enum'ga toraytiramiz.
    const cmdKind = cmdKindRaw as CommandKind;
    const rule = COMMAND_RULES[cmdKind];
    if (!rule) throw new BadRequestException(`Noma'lum buyruq: ${cmdKindRaw}`);

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

  /**
   * Juftlash-kodini doimiy tokenga almashtiradi.
   * SEC-01: muddati o'tgan kod "topilmadi" bilan bir xil xabar bilan rad
   * etiladi (kod mavjud-u muddati o'tganini oshkor qilmaslik uchun).
   * Brute-force himoyasi ikki qatlamda: (1) 12-belgili base32 maydoni
   * (32^12 ≈ 1.15e18 — amaliy jihatdan taxmin qilib bo'lmaydi), (2) controller
   * darajasidagi `@Throttle(5, 60s)` — bu ikkalasi birga "muvaffaqiyatsiz
   * urinishlar hisoblanadi, 5tadan keyin bloklanadi" talabini qamraydi.
   * Alohida DB-darajasidagi urinish-hisoblagich QO'SHILMADI: `pair()` kodni
   * ANIQ moslik bo'yicha (`findUnique`) qidiradi — noto'g'ri taxmin HECH
   * QANDAY qatorga tegishli bo'lmaydi, shuning uchun "shu qatorga 5 marta
   * noto'g'ri urinildi" ma'nosida hisoblagichni bironta qatorga bog'lab
   * bo'lmaydi (aks holda yolg'on-manfiy: bitta foydalanuvchining noto'g'ri
   * urinishlari boshqa foydalanuvchining kutib turgan kodini bekor qilib
   * qo'yishi mumkin edi — bu haqiqiy DoS eshigi bo'lardi).
   */
  async pair(pairingCode: string) {
    const companion = await this.prisma.deviceCompanion.findUnique({ where: { pairingCode } });
    const expired = companion?.pairingExpiresAt && companion.pairingExpiresAt.getTime() < Date.now();
    if (!companion || expired) {
      throw new NotFoundException("Juftlash-kodi noto'g'ri yoki muddati tugagan");
    }
    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    await this.prisma.deviceCompanion.update({
      where: { id: companion.id },
      data: {
        tokenHash: this.hash(token),
        pairingCode: null,
        pairingExpiresAt: null,
        status: 'paired',
        pairedAt: now,
        lastSeenAt: now,
        tokenIssuedAt: now,
      },
    });
    await this.device.logAction(companion.userId, {
      deviceType: companion.kind,
      category: 'connect',
      action: `Companion juftlandi (${companion.kind})`,
    });
    await this.notifyPaired(companion.userId, companion.kind);
    return { companionId: companion.id, kind: companion.kind, token };
  }

  /**
   * Companion tokenini yangilaydi (SEC-01 AC#6 — 30 kunlik rotatsiya).
   * Eski token darhol ishlamay qoladi (tokenHash almashtiriladi). Yosh
   * bo'yicha majburiy rad etish YO'Q — companion o'zi muddat yaqinlashganda
   * chaqiradi (companion.mjs); serverda qattiq cheklov qo'yish companion
   * biroz vaqt oflayn bo'lsa uni butunlay qulflab qo'yishi mumkin edi.
   */
  async refreshToken(companion: DeviceCompanion) {
    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    await this.prisma.deviceCompanion.update({
      where: { id: companion.id },
      data: { tokenHash: this.hash(token), tokenIssuedAt: now, lastSeenAt: now },
    });
    await this.device.logAction(companion.userId, {
      deviceType: companion.kind,
      category: 'connect',
      action: `Companion tokeni yangilandi (${companion.kind})`,
    });
    return { token };
  }

  /**
   * SEC-01 AC#5 — muvaffaqiyatli juftlashda foydalanuvchiga bildirishnoma.
   * Best-effort: hozircha yagona umumiy kanal Telegram (EmailService faqat
   * OTP kodlari uchun, umumiy xabar yubormaydi). Bog'lanmagan bo'lsa yoki
   * yuborish xato bersa — jim o'tkazib yuboriladi, juftlashning o'zi
   * bloklanmaydi (allaqachon DeviceActionLog'ga yozilgan).
   */
  private async notifyPaired(userId: string, kind: string): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user?.telegramChatId) return;
      const label = kind === 'phone' ? 'Telefon' : 'Kompyuter';
      const text = `✅ Yangi qurilma ulandi: ${label} companion. Bu siz bo'lmasangiz, Sozlamalar → Qurilma Boshqaruvida uni darhol o'chiring.`;
      await this.connectors.sendViaChannel(user, 'telegram', user.telegramChatId, text);
    } catch {
      // best-effort — bildirishnoma xatosi juftlashni bekor qilmaydi
    }
  }

  /** Token orqali companion'ni topadi (poll/result uchun). */
  async authCompanion(token: string | undefined): Promise<DeviceCompanion | null> {
    if (!token) return null;
    // @preauth-scope: bu companion-autentifikatsiyaning O'ZI — qaysi
    // foydalanuvchiga tegishli ekani hali noma'lum, tokenHash bo'yicha
    // qidiruv shuni ANIQLAYDI.
    const row = await this.prisma.deviceCompanion.findFirst({ where: { tokenHash: this.hash(token) } });
    return row ?? null;
  }

  /** Keyingi navbatdagi buyruqni beradi (running'ga o'tkazadi). lastSeenAt yangilanadi. */
  async poll(companion: DeviceCompanion) {
    await this.prisma.deviceCompanion.update({
      where: { id: companion.id },
      data: { lastSeenAt: new Date(), status: 'paired' },
    });
    // @upstream-scope: `companion` parametri caller (authCompanion orqali
    // token bilan tasdiqlangan) tomonidan allaqachon berilgan — so'rov
    // `companionId`ga tayanadi, alohida userId tekshiruvi shart emas.
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
    // @upstream-scope: xuddi shu naqsh — `companion` token-orqali tasdiqlangan,
    // so'rov `companionId`ga tayanadi (boshqa companion'ning buyrug'iga
    // natija yozib bo'lmasligini shu maydon kafolatlaydi).
    const cmd = await this.prisma.deviceCommand.findFirst({ where: { id: commandId, companionId: companion.id } });
    if (!cmd) throw new NotFoundException('Buyruq topilmadi');
    const finalAllowed: CommandStatus[] = ['done', 'failed', 'denied'];
    const final: CommandStatus = finalAllowed.includes(status as CommandStatus)
      ? (status as CommandStatus)
      : 'done';
    await this.prisma.deviceCommand.update({
      where: { id: cmd.id },
      data: { status: final, result: (result ?? null) as object },
    });
    await this.device.logAction(companion.userId, {
      deviceType: companion.kind,
      // COMMAND_RULES — CommandKind bo'yicha TO'LIQ registr, shuning uchun
      // qiymat doim mavjud (ilgari `?? cmd.kind` fallback'i buyruq TURINI
      // toifa sifatida yozib yuborardi — endi bunday bo'lishi mumkin emas).
      category: COMMAND_RULES[cmd.kind].category,
      action: `Buyruq bajarildi: ${cmd.kind} (${final})`,
      detail: typeof result === 'string' ? result.slice(0, 400) : JSON.stringify(result ?? '').slice(0, 400),
      status: final === 'done' ? 'ok' : 'failed',
    });
    return { ok: true };
  }

  /**
   * B2 computer-use: companion skrinshot yuboradi, biz engine vision-planner'ga
   * uzatib keyingi harakatni qaytaramiz. Ruxsat: computer:screen (fail-closed).
   *
   * SEC-02: har chaqiruv (loop'ning bitta iteratsiyasi) alohida hisoblanadi —
   * companion.mjs har qadamda shu endpointni chaqiradi, shuning uchun bu
   * yerga charge/consume qo'yish avtomatik ravishda "har iteratsiya alohida
   * hisoblanadi" talabini bajaradi (butun sessiya uchun bitta yig'ma hisob
   * emas). Naqsh agents.service.ts'dagi run() bilan AYNAN bir xil (faqat u
   * yerda `user` allaqachon controller'dan keladi — bu yerda companion'dan
   * userId orqali topiladi, chunki bu yo'l AuthGuard emas, companion-token
   * bilan autentifikatsiya qilinadi):
   *   1) PUL — LLM/vision chaqiruvidan OLDIN (balans yetmasa 402, engine'ga
   *      so'rov umuman ketmaydi).
   *   2) KVOTA — pul allaqachon yechilgani uchun 429 bo'lsa qaytariladi.
   *   3) ENGINE — javob berilmasa (xato/aloqa yo'q) yechilgan pul qaytariladi.
   */
  async computerUsePlan(
    companion: DeviceCompanion,
    body: { goal: string; screenshot?: string; screen?: { width: number; height: number }; history?: unknown[] },
  ) {
    if (companion.kind !== 'computer') throw new BadRequestException('Faqat computer-companion');
    const allowed = await this.device.isAllowed(companion.userId, 'computer', 'screen');
    if (!allowed) throw new ForbiddenException("'screen' ruxsati yoqilmagan");

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: companion.userId } });

    await this.billing.chargeForMessage(user, { companionId: companion.id, via: 'computer_use' });

    try {
      await this.usage.consumeChat(user);
    } catch (e) {
      await this.billing.refund(user, 'rate_limited').catch(() => undefined);
      throw e;
    }

    try {
      const { data } = await firstValueFrom(
        this.http.post(
          `${this.engineUrl}/computer-use/plan`,
          { goal: body.goal, screenshot: body.screenshot, screen: body.screen, history: body.history ?? [] },
          { timeout: 60_000 },
        ),
      );
      return data;
    } catch (e) {
      await this.billing.refund(user, 'computer_use_failed').catch(() => undefined);
      throw e;
    }
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
