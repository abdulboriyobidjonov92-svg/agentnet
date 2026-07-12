/**
 * Clerk Webhook handler + lokal dev/OTP login uchun umumiy
 * find-or-create foydalanuvchi mantig'i.
 */
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from './audit-log.service';
import { signToken } from './token.util';

interface ClerkWebhookEvent {
  type: 'user.created' | 'user.updated' | 'user.deleted';
  data: {
    id: string;
    email_addresses: { email_address: string }[];
    public_metadata?: Record<string, unknown>;
  };
}

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
