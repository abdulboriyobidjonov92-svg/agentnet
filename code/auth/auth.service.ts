/**
 * AgentNet — Auth Service (NestJS + Clerk)
 * ------------------------------------------------------------
 * Vazifasi:
 *  - Clerk orqali autentifikatsiyani sinxronlashtirish (webhook)
 *  - Biznes/admin hisoblar uchun 2FA (TOTP) ni MAJBURIY qilish
 *  - RBAC guard (owner/admin/member/viewer)
 *  - Har bir muhim amalni audit-log'ga yozish
 *
 * Talab qilinadigan paketlar:
 *   npm i @nestjs/common @nestjs/core @clerk/clerk-sdk-node
 *   npm i otplib qrcode prisma @prisma/client
 *
 * Eslatma: bu skeleton — production'ga chiqishdan oldin xato
 * ishlov berish, rate-limit va testlarni to'liqlashtirish kerak.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

// ----------------------------------------------------------------
// Turlar
// ----------------------------------------------------------------

export interface AuthenticatedUser {
  id: string;
  clerkId: string;
  email: string;
  orgId: string | null;
  role: Role; // OWNER | ADMIN | MEMBER | VIEWER
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
// Audit Log — har bir muhim amalni o'zgartirib bo'lmas tarzda yozadi
// ----------------------------------------------------------------

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  async record(params: {
    actorId: string;
    action: string; // masalan: "auth.login", "agent.create", "2fa.enable"
    resourceType: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    // Hash-chain: har bir yozuv oldingi yozuv hash'iga bog'lanadi,
    // shu orqali tarixni o'zgartirish imkonsiz bo'ladi.
    const last = await prisma.auditLog.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    const prevHash = last?.entryHash ?? 'GENESIS';
    const entryHash = AuditLogService.computeHash(prevHash, params);

    await prisma.auditLog.create({
      data: {
        actorId: params.actorId,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId ?? null,
        metadata: params.metadata ?? {},
        prevHash,
        entryHash,
      },
    });

    this.logger.log(`AUDIT: ${params.actorId} -> ${params.action}`);
  }

  private static computeHash(prevHash: string, payload: unknown): string {
    const crypto = require('crypto');
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
  constructor(private readonly auditLog: AuditLogService) {}

  /** Foydalanuvchi uchun yangi TOTP sirini yaratadi va QR-kod qaytaradi */
  async generateSecret(userId: string, email: string) {
    const secret = authenticator.generateSecret();
    const otpUrl = authenticator.keyuri(email, 'AgentNet (Baraka AI)', secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpUrl);

    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecretPending: secret }, // hali tasdiqlanmagan
    });

    return { secret, qrCodeDataUrl };
  }

  /** Foydalanuvchi kiritgan 6-xonali kodni tasdiqlaydi va 2FA'ni yoqadi */
  async verifyAndEnable(userId: string, token: string): Promise<boolean> {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.twoFactorSecretPending) {
      throw new ForbiddenException('2FA sozlash boshlanmagan');
    }

    const isValid = authenticator.verify({
      token,
      secret: user.twoFactorSecretPending,
    });

    if (!isValid) return false;

    await prisma.user.update({
      where: { id: userId },
      data: {
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

  /** Login vaqtida 2FA kodini tekshiradi */
  async verifyLogin(userId: string, token: string): Promise<boolean> {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.twoFactorEnabled || !user.twoFactorSecret) return true; // 2FA yoqilmagan

    return authenticator.verify({ token, secret: user.twoFactorSecret });
  }
}

// ----------------------------------------------------------------
// Clerk Webhook handler — foydalanuvchini lokal bazaga sinxronlaydi
// ----------------------------------------------------------------

@Injectable()
export class ClerkSyncService {
  constructor(private readonly auditLog: AuditLogService) {}

  async handleWebhook(event: ClerkWebhookEvent): Promise<void> {
    switch (event.type) {
      case 'user.created': {
        const email = event.data.email_addresses[0]?.email_address ?? '';
        const user = await prisma.user.create({
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
        await prisma.user.updateMany({
          where: { clerkId: event.data.id },
          data: { deletedAt: new Date() }, // soft-delete — audit uchun saqlanadi
        });
        break;
      }
      default:
        break;
    }
  }
}

// ----------------------------------------------------------------
// RBAC Guard — biznes hisoblar uchun 2FA'ni MAJBURIY qiladi
// ----------------------------------------------------------------

@Injectable()
export class TwoFactorEnforcementGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;

    if (!user) throw new UnauthorizedException('Autentifikatsiya talab qilinadi');

    // Biznes hisoblar (do'kon, tashkilot) uchun 2FA shart.
    if (user.isBusinessAccount && !user.twoFactorEnabled) {
      throw new ForbiddenException(
        'Biznes hisob uchun 2FA yoqilishi shart. /auth/2fa/setup ga murojaat qiling.',
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
