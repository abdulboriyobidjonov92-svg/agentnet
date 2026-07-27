import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import axios from 'axios';
import { AuditLogService, ClerkSyncService } from './auth.service';

/**
 * Google bilan kirish (Google Identity Services).
 *
 * Frontend GIS tugmasidan `credential` (ID token, JWT) oladi va shu yerga
 * yuboradi. Biz tokenni Google'ning RASMIY `tokeninfo` endpointida
 * tekshiramiz — imzo, muddat va formatni Google'ning o'zi tasdiqlaydi
 * (mahalliy JWKS-tekshiruv uchun qo'shimcha kutubxona kerak bo'lardi).
 *
 * MUHIM xavfsizlik shartlari (tokeninfo o'zi tekshirmaydi, biz tekshiramiz):
 *   • `aud` — token AYNAN bizning client ID uchun berilganmi. Busiz istalgan
 *     odam boshqa saytdan olingan Google tokeni bilan kira olardi.
 *   • `iss` — chindan Google bergani.
 *   • `email_verified` — email Google tomonidan tasdiqlangani (aks holda
 *     birov tasdiqlanmagan email bilan begona hisobni egallashi mumkin).
 *
 * GOOGLE_CLIENT_ID sozlanmagan bo'lsa — funksiya butunlay o'chiq
 * (fail-closed), frontend tugmani ko'rsatmaydi.
 */
@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);

  constructor(
    private readonly clerkSync: ClerkSyncService,
    private readonly auditLog: AuditLogService,
  ) {}

  async loginWithIdToken(credential: string) {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    if (!clientId) {
      throw new BadRequestException(
        "Google orqali kirish hozircha sozlanmagan — email yoki telefon bilan kiring",
      );
    }
    if (!credential?.trim()) {
      throw new BadRequestException('Google tokeni yuborilmadi');
    }

    let payload: {
      aud?: string;
      iss?: string;
      email?: string;
      email_verified?: string | boolean;
      name?: string;
    };

    try {
      const res = await axios.get('https://oauth2.googleapis.com/tokeninfo', {
        params: { id_token: credential },
        timeout: 10_000,
      });
      payload = res.data;
    } catch {
      // Google tokenni rad etdi (imzo yaroqsiz, muddati o'tgan yoki soxta).
      throw new UnauthorizedException('Google tokeni yaroqsiz yoki muddati tugagan');
    }

    // --- Xavfsizlik tekshiruvlari ---
    if (payload.aud !== clientId) {
      this.logger.warn(`Google login rad etildi: aud mos emas (${payload.aud})`);
      throw new UnauthorizedException('Google tokeni bu ilova uchun berilmagan');
    }

    const iss = payload.iss || '';
    if (iss !== 'accounts.google.com' && iss !== 'https://accounts.google.com') {
      throw new UnauthorizedException('Google tokeni ishonchsiz manbadan');
    }

    // tokeninfo `email_verified` ni "true" satri sifatida qaytaradi.
    const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
    if (!emailVerified) {
      throw new UnauthorizedException('Google hisobingizdagi email tasdiqlanmagan');
    }

    const email = (payload.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      throw new UnauthorizedException('Google hisobidan email olinmadi');
    }

    // Email tasdiqlangan — OTP bilan bir xil yo'ldan foydalanuvchini
    // topamiz/yaratamiz (bir xil email = bir xil hisob).
    const { user, isNewUser } = await this.clerkSync.findOrCreateUser(
      { email, name: payload.name },
      { action: 'auth.google_login' },
    );

    // 2FA yoqilgan hisob — Google ham uni chetlab o'ta olmaydi (OTP oqimi bilan bir xil siyosat).
    if (user.twoFactorEnabled) {
      return { needsTwoFactor: true as const, userId: user.id };
    }

    await this.auditLog.record({
      actorId: user.id,
      action: 'auth.google_login',
      resourceType: 'user',
      resourceId: user.id,
      metadata: { method: 'google', isNewUser },
    });

    return { needsTwoFactor: false as const, ...this.clerkSync.issueSession(user, isNewUser) };
  }
}
