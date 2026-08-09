/**
 * AgentNet — Auth Service (NestJS)
 * Lokal OTP/dev-login orqali foydalanuvchini yaratadi/topadi,
 * biznes hisoblar uchun 2FA (TOTP) ni MAJBURIY qiladi,
 * RBAC guard va hash-chained audit-log ta'minlaydi.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { signToken } from './token.util';
import { AUDIT_GENESIS, computeEntryHash } from './audit-hash';

// SQLite enum'ni qo'llab-quvvatlamaydi — role String sifatida saqlanadi.
export type Role = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

// ----------------------------------------------------------------
// Turlar
// ----------------------------------------------------------------

export interface AuthenticatedUser {
  id: string;
  clerkId: string;
  email: string;
  orgId: string | null;
  role: Role;
  twoFactorEnabled: boolean;
  isBusinessAccount: boolean;
}

// ----------------------------------------------------------------
// Audit Log — hash-chained, o'zgartirib bo'lmas jurnal
// ----------------------------------------------------------------

// Audit-zanjir advisory-lock'ining NOMMAYDONI (A17/ADR-008).
// Ikki argumentli shakl ishlatiladi: `(4771, hashtext(actorId))` — ya'ni
// seriyalash HAR AKTOR uchun alohida. Ilgari bu bitta global kalit edi va
// platformadagi har audit yozuvi bitta navbatda turardi.
// Nommaydon boshqa lock'lar bilan to'qnashmasligi uchun ajratilgan
// (4772 — agent yaratish, 4779 — suhbatga xabar qo'shish).
const AUDIT_CHAIN_LOCK = 4771;

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(params: {
    actorId: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
    /**
     * SEC-12 (ADR-008) — impersonation orqali bajarilgan amalda KO'RILGAN
     * foydalanuvchi. `actorId` DOIM haqiqiy operator bo'lib qoladi.
     *
     * IKKI JOYGA yoziladi (ataylab):
     *   • `metadata.impersonatedUserId` — kanonik hash ICHIDA, ya'ni
     *     buzilmas dalil (mavjud hash formati O'ZGARMAYDI, chunki metadata
     *     allaqachon hashlanadi);
     *   • `AuditLog.impersonatedUserId` ustuni — indekslanadigan ko'chirma
     *     (admin jurnalida "impersonatedBy?" ustuni va nishon bo'yicha
     *     filtr shundan ishlaydi).
     * Ustunni o'zgartirish metadata bilan solishtirilganda darhol ko'rinadi.
     */
    impersonatedUserId?: string;
  }): Promise<void> {
    // Audit-log hech qachon asosiy oqimni bloklamasligi kerak.
    try {
      // Hash-zanjir ketma-ket bo'lishi SHART: "oxirgi hash'ni o'qi → yangi yozuv"
      // atomik bo'lmasa, ikki parallel yozuv bir xil prevHash oladi va zanjir
      // ikkiga bo'linadi (buzilish-sezish kafolati yo'qoladi).
      //
      // A17/ADR-008: lock endi GLOBAL emas, PER-ACTOR
      // (`pg_advisory_xact_lock(namespace, hashtext(actorId))`). Ilgari
      // platformadagi HAR audit yozuvi bitta navbatda turardi — yozuv hajmi
      // oshganda bu birinchi DB bottleneck bo'lardi. Per-actor zanjir bir xil
      // isbot-kuchini beradi: yozuvni o'zgartirish/o'chirish shu aktor
      // zanjirini baribir uzadi.
      await this.prisma.$transaction(async (tx) => {
        // `::int` cast MAJBURIY: Postgres'da faqat `pg_advisory_xact_lock(bigint)`
        // va `(int, int)` shakllari bor. Prisma raqamli parametrni bigint deb
        // yuboradi, natijada `(bigint, integer)` — mavjud bo'lmagan imzo.
        // Usiz har audit yozuvi jimgina yiqilardi (xato `catch` bilan yutiladi).
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${AUDIT_CHAIN_LOCK}::int, hashtext(${params.actorId}))`;

        const last = await tx.auditLog.findFirst({
          where: { actorId: params.actorId },
          orderBy: { seq: 'desc' }, // monotonik — millisekund-teng holatida ham aniq
        });
        const prevHash = last?.entryHash ?? AUDIT_GENESIS;

        // `createdAt` ANIQ o'rnatiladi (DB default'iga tashlanmaydi): u hash
        // ichiga kiradi, ya'ni keyin vaqt belgisini o'zgartirish zanjirni buzadi.
        // SEC-12: impersonation belgisi metadata ICHIGA ham kiritiladi —
        // hash aynan shu obyektni qamraydi (ustun esa qamramaydi).
        const metadata = params.impersonatedUserId
          ? { ...(params.metadata ?? {}), impersonatedUserId: params.impersonatedUserId }
          : (params.metadata ?? {});

        const created = await tx.auditLog.create({
          data: {
            actorId: params.actorId,
            action: params.action,
            resourceType: params.resourceType,
            resourceId: params.resourceId ?? null,
            metadata: metadata as object,
            impersonatedUserId: params.impersonatedUserId ?? null,
            createdAt: new Date(),
            prevHash,
            entryHash: '', // quyida SAQLANGAN qiymatlardan hisoblanadi
          },
        });

        // MUHIM: hash `created` (ya'ni RETURNING bilan DB'DAN QAYTGAN) qiymatlardan
        // hisoblanadi — kiritilgan obyektdan EMAS. Sabab: `metadata` `jsonb`
        // sifatida normallashadi (kalit tartibi, son formati). Shu tartibda
        // hash keyinchalik saqlangan qatordan AYNAN qayta hisoblanadi.
        const entryHash = computeEntryHash(prevHash, created);

        await tx.auditLog.update({ where: { id: created.id }, data: { entryHash } });
      });
      this.logger.log(`AUDIT: ${params.actorId} -> ${params.action}`);
    } catch (e) {
      this.logger.warn(`Audit-log yozib bo'lmadi: ${(e as Error).message}`);
    }
  }

  /**
   * A17/ADR-008 — bitta aktorning zanjirini tekshiradi: har yozuvning hash'i
   * SAQLANGAN qiymatlardan qayta hisoblanadi va bog'lanish uzilmaganini
   * tasdiqlaydi.
   *
   * Buzilish topilsa qaysi yozuvda ekani qaytariladi (`brokenAt`) — audit
   * ko'ruvchisi (P4) shuni ko'rsatadi.
   */
  async verifyChain(actorId: string): Promise<{
    ok: boolean;
    checked: number;
    brokenAt?: { id: string; seq: number; reason: 'prev_mismatch' | 'hash_mismatch' };
  }> {
    const rows = await this.prisma.auditLog.findMany({
      where: { actorId },
      orderBy: { seq: 'asc' },
    });

    let prevHash = AUDIT_GENESIS;
    for (const row of rows) {
      if (row.prevHash !== prevHash) {
        return { ok: false, checked: rows.length, brokenAt: { id: row.id, seq: row.seq, reason: 'prev_mismatch' } };
      }
      if (computeEntryHash(prevHash, row) !== row.entryHash) {
        return { ok: false, checked: rows.length, brokenAt: { id: row.id, seq: row.seq, reason: 'hash_mismatch' } };
      }
      prevHash = row.entryHash;
    }

    return { ok: true, checked: rows.length };
  }
}

// ----------------------------------------------------------------
// 2FA (TOTP) xizmati
// ----------------------------------------------------------------

@Injectable()
export class TwoFactorService {
  constructor(
    private readonly auditLog: AuditLogService,
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async generateSecret(userId: string, email: string) {
    const secret = authenticator.generateSecret();
    const otpUrl = authenticator.keyuri(email, 'AgentNet (Baraka AI)', secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpUrl);

    // TOTP siri DB'da SHIFRLANGAN saqlanadi (at-rest). QR/secret foydalanuvchiga
    // faqat shu javobda ochiq ko'rsatiladi (bir martalik sozlash uchun).
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecretPending: this.crypto.encrypt(secret) },
    });

    return { secret, qrCodeDataUrl };
  }

  async verifyAndEnable(userId: string, token: string): Promise<boolean> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.twoFactorSecretPending) {
      throw new ForbiddenException('2FA sozlash boshlanmagan');
    }

    const isValid = authenticator.verify({
      token,
      // Saqlangan pending SHIFRLANGAN — tekshirish uchun deshifrlaymiz
      // (decryptString eski plaintext'ni ham qo'llab-quvvatlaydi).
      secret: this.crypto.decryptString(user.twoFactorSecretPending) ?? '',
    });

    if (!isValid) return false;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        // pending allaqachon shifrlangan — shifrlangan holicha secret'ga ko'chiramiz
        twoFactorSecret: user.twoFactorSecretPending,
        twoFactorSecretPending: null,
        twoFactorEnabled: true,
        // SEC-03: 2FA yoqilishi — barcha mavjud tokenlarni bekor qiladi
        // (AuthGuard payload.tv'ni User.tokenVersion bilan solishtiradi).
        tokenVersion: { increment: 1 },
      },
    });

    await this.auditLog.record({
      actorId: userId,
      action: '2fa.enable',
      resourceType: 'user',
      resourceId: userId,
    });

    return true;
  }

  async verifyLogin(userId: string, token: string): Promise<boolean> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.twoFactorEnabled || !user.twoFactorSecret) return true;
    // Saqlangan secret SHIFRLANGAN — tekshirish uchun deshifrlaymiz.
    return authenticator.verify({
      token,
      secret: this.crypto.decryptString(user.twoFactorSecret) ?? '',
    });
  }
}

// ----------------------------------------------------------------
// Autentifikatsiya — lokal login (dev-login, OTP)
// ----------------------------------------------------------------

@Injectable()
export class AuthService {
  constructor(
    private readonly auditLog: AuditLogService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Lokal dev auth — tashqi provayder ishlatilmaydi. Email YOKI telefon raqami
   * bo'yicha foydalanuvchini topadi/yaratadi. FAQAT NODE_ENV!==production'da
   * chaqiriladi (controller darajasida cheklangan) — real login endi
   * OtpService orqali.
   */
  async devLogin(input: { email?: string; phone?: string; name?: string }) {
    const { user, isNewUser } = await this.findOrCreateUser(input, {
      action: 'auth.dev_login',
    });
    return this.issueSession(user, isNewUser);
  }

  /** Har bir muvaffaqiyatli login imzolangan token bilan qaytadi. */
  issueSession(
    u: {
      id: string;
      email: string;
      phone: string | null;
      role: string;
      name: string | null;
      tokenVersion: number;
      blockedAt?: Date | null;
    },
    isNewUser: boolean,
  ) {
    // SEC-12 §24 — bloklangan hisobga sessiya BERILMAYDI.
    //
    // Bu yerda, chunki `issueSession` login tokenining YAGONA chiqish
    // nuqtasi (dev-login ham, OTP ham shundan o'tadi). `AuthGuard` baribir
    // har so'rovda blokni tekshiradi, ya'ni bu qatlam qo'shimcha to'siq
    // emas — u login oqimida ANIQ sabab beradi ("bloklangan"), aks holda
    // foydalanuvchi kirgandek bo'lib, keyin har so'rovda 403 olardi.
    if (u.blockedAt) {
      throw new ForbiddenException({
        message: 'Hisobingiz bloklangan. Qo\'llab-quvvatlash xizmatiga murojaat qiling.',
        reason: 'account_blocked',
      });
    }

    return {
      userId: u.id,
      email: u.email,
      phone: u.phone,
      name: u.name,
      role: u.role,
      isNewUser,
      token: signToken({ sub: u.id, email: u.email, tv: u.tokenVersion }),
    };
  }

  /**
   * SEC-03 AC#5 — joriy sessiyani yangi 7-kunlik token bilan almashtiradi
   * ("jimgina yangilanish"). tokenVersion o'ZGARMAYDI (refresh — bekor qilish
   * emas, faqat muddatni uzaytirish); chaqiruvchi controller AuthGuard bilan
   * himoyalangan, shuning uchun bu yerga faqat joriy `tv` allaqachon mos
   * kelgan (ya'ni bekor qilinmagan) foydalanuvchi yetib keladi.
   */
  refreshSession(u: { id: string; email: string; tokenVersion: number }) {
    return { token: signToken({ sub: u.id, email: u.email, tv: u.tokenVersion }) };
  }

  /**
   * Email YOKI telefon bo'yicha foydalanuvchini topadi, topilmasa yaratadi.
   * OTP-login va dev-login ikkalasi ham shu yagona yo'ldan foydalanadi.
   */
  async findOrCreateUser(
    input: { email?: string; phone?: string; name?: string },
    opts: { action: string },
  ): Promise<{
    user: {
      id: string;
      email: string;
      phone: string | null;
      role: string;
      name: string | null;
      twoFactorEnabled: boolean;
      tokenVersion: number;
    };
    isNewUser: boolean;
  }> {
    const name = input.name?.trim() || undefined;

    // --- Telefon bilan kirish ---
    if (input.phone) {
      const phone = this.normalizePhone(input.phone);
      if (!phone) {
        throw new BadRequestException('Yaroqli telefon raqamini kiriting');
      }
      const existing = await this.prisma.user.findUnique({ where: { phone } });
      if (existing) {
        return { user: existing, isNewUser: false };
      }
      const user = await this.prisma.user.create({
        data: {
          clerkId: this.devClerkId(),
          // email majburiy/unique — telefondan barqaror sintetik qiymat.
          email: `${phone.replace('+', '')}@phone.agentnet`,
          phone,
          name,
          role: 'MEMBER',
        },
      });
      await this.auditLog.record({
        actorId: user.id,
        action: opts.action,
        resourceType: 'user',
        resourceId: user.id,
        metadata: { name, method: 'phone' },
      });
      return { user, isNewUser: true };
    }

    // --- Email bilan kirish ---
    const clean = (input.email || '').trim().toLowerCase();
    if (!clean || !clean.includes('@')) {
      throw new BadRequestException('Yaroqli email kiriting');
    }
    const existing = await this.prisma.user.findUnique({ where: { email: clean } });
    if (existing) {
      return { user: existing, isNewUser: false };
    }
    const user = await this.prisma.user.create({
      data: {
        clerkId: this.devClerkId(),
        email: clean,
        name,
        role: 'MEMBER',
      },
    });
    await this.auditLog.record({
      actorId: user.id,
      action: opts.action,
      resourceType: 'user',
      resourceId: user.id,
      metadata: { name, method: 'email' },
    });
    return { user, isNewUser: true };
  }

  private devClerkId(): string {
    return `dev_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }

  /**
   * Telefon raqamini E.164'ga normallashtiradi. Faqat raqam/ "+" saqlanadi.
   * "+" bo'lmasa qo'shiladi. Yaroqsiz bo'lsa null qaytaradi (7–15 raqam).
   */
  normalizePhone(raw: string): string | null {
    const digits = (raw || '').replace(/[^\d+]/g, '');
    const e164 = digits.startsWith('+') ? `+${digits.slice(1).replace(/\+/g, '')}` : `+${digits}`;
    const bare = e164.slice(1);
    if (!/^\d{7,15}$/.test(bare)) return null;
    return e164;
  }
}

// ----------------------------------------------------------------
// RBAC Guards
// ----------------------------------------------------------------

@Injectable()
export class TwoFactorEnforcementGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;

    if (!user) throw new UnauthorizedException('Autentifikatsiya talab qilinadi');

    if (user.isBusinessAccount && !user.twoFactorEnabled) {
      throw new ForbiddenException(
        'Biznes hisob uchun 2FA yoqilishi shart. /api/auth/2fa/setup ga murojaat qiling.',
      );
    }

    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly allowedRoles: Role[]) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;
    if (!user) throw new UnauthorizedException();
    if (!this.allowedRoles.includes(user.role)) {
      throw new ForbiddenException(`Ruxsat yo'q: ${this.allowedRoles.join(',')} talab qilinadi`);
    }
    return true;
  }
}
