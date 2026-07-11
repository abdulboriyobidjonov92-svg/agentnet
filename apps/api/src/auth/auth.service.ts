/**
 * AgentNet — Auth Service (NestJS + Clerk)
 * Clerk webhook orqali foydalanuvchini sinxronlashtiradi,
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

interface ClerkWebhookEvent {
  type: 'user.created' | 'user.updated' | 'user.deleted';
  data: {
    id: string;
    email_addresses: { email_address: string }[];
    public_metadata?: Record<string, unknown>;
  };
}

// ----------------------------------------------------------------
// Audit Log — hash-chained, o'zgartirib bo'lmas jurnal
// ----------------------------------------------------------------

// Butun audit-zanjiri uchun yagona advisory-lock kaliti (ixtiyoriy bigint).
// Barcha audit yozuvlari shu kalit ustida seriyalashadi — zanjir chiziqli qoladi.
const AUDIT_CHAIN_LOCK = 4771n;

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
  }): Promise<void> {
    // Audit-log hech qachon asosiy oqimni bloklamasligi kerak.
    try {
      // Hash-zanjir ketma-ket bo'lishi SHART: "oxirgi hash'ni o'qi → yangi yozuv"
      // atomik bo'lmasa, ikki parallel yozuv bir xil prevHash oladi va zanjir
      // ikkiga bo'linadi (buzilish-sezish kafolati yo'qoladi). Butun zanjir uchun
      // bitta transaksiya-doirasidagi advisory lock — audit yozuvlari o'zaro
      // seriyalashadi, boshqa jadvallarga esa ta'sir qilmaydi.
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${AUDIT_CHAIN_LOCK})`;

        const last = await tx.auditLog.findFirst({
          orderBy: { seq: 'desc' }, // monotonik — millisekund-teng holatida ham aniq
        });
        const prevHash = last?.entryHash ?? 'GENESIS';
        const entryHash = this.computeHash(prevHash, params);

        await tx.auditLog.create({
          data: {
            actorId: params.actorId,
            action: params.action,
            resourceType: params.resourceType,
            resourceId: params.resourceId ?? null,
            metadata: (params.metadata ?? {}) as object,
            prevHash,
            entryHash,
          },
        });
      });
      this.logger.log(`AUDIT: ${params.actorId} -> ${params.action}`);
    } catch (e) {
      this.logger.warn(`Audit-log yozib bo'lmadi: ${(e as Error).message}`);
    }
  }

  private computeHash(prevHash: string, payload: unknown): string {
    return crypto
      .createHash('sha256')
      .update(prevHash + JSON.stringify(payload))
      .digest('hex');
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
// Clerk Webhook handler
// ----------------------------------------------------------------

@Injectable()
export class ClerkSyncService {
  constructor(
    private readonly auditLog: AuditLogService,
    private readonly prisma: PrismaService,
  ) {}

  async handleWebhook(event: ClerkWebhookEvent): Promise<void> {
    switch (event.type) {
      case 'user.created': {
        const email = event.data.email_addresses[0]?.email_address ?? '';
        const user = await this.prisma.user.create({
          data: {
            clerkId: event.data.id,
            email,
            role: 'MEMBER',
            twoFactorEnabled: false,
            isBusinessAccount: false,
          },
        });
        await this.auditLog.record({
          actorId: user.id,
          action: 'auth.user_created',
          resourceType: 'user',
          resourceId: user.id,
        });
        break;
      }
      case 'user.deleted': {
        await this.prisma.user.updateMany({
          where: { clerkId: event.data.id },
          data: { deletedAt: new Date() },
        });
        break;
      }
      default:
        break;
    }
  }

  /**
   * Lokal dev auth — Clerk'siz. Email YOKI telefon raqami bo'yicha
   * foydalanuvchini topadi/yaratadi. FAQAT NODE_ENV!==production'da chaqiriladi
   * (controller darajasida cheklangan) — real login endi OtpService orqali.
   */
  async devLogin(input: { email?: string; phone?: string; name?: string }) {
    const { user, isNewUser } = await this.findOrCreateUser(input, {
      action: 'auth.dev_login',
    });
    return this.issueSession(user, isNewUser);
  }

  /** Har bir muvaffaqiyatli login imzolangan token bilan qaytadi. */
  issueSession(
    u: { id: string; email: string; phone: string | null; role: string; name: string | null },
    isNewUser: boolean,
  ) {
    return {
      userId: u.id,
      email: u.email,
      phone: u.phone,
      name: u.name,
      role: u.role,
      isNewUser,
      token: signToken({ sub: u.id, email: u.email }),
    };
  }

  /**
   * Email YOKI telefon bo'yicha foydalanuvchini topadi, topilmasa yaratadi.
   * OTP-login va dev-login ikkalasi ham shu yagona yo'ldan foydalanadi.
   */
  async findOrCreateUser(
    input: { email?: string; phone?: string; name?: string },
    opts: { action: string },
  ): Promise<{
    user: { id: string; email: string; phone: string | null; role: string; name: string | null; twoFactorEnabled: boolean };
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
