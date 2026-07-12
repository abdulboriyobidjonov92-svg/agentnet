/**
 * 2FA (TOTP) xizmati.
 */
import { Injectable, ForbiddenException } from '@nestjs/common';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { AuditLogService } from './audit-log.service';

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
