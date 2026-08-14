import { Injectable, Logger } from '@nestjs/common';

/**
 * Google OAuth — "Continue with Google" uchun authorization-code almashinuvi.
 *
 * Redirect URI'ni Google'ga to'g'ridan-to'g'ri BFF (`agentnet.site`) beradi,
 * shu yerga esa faqat `code` yetib keladi (server-server), so'ng shu kod
 * Google'ning token endpoint'iga almashtiriladi. Xuddi `SmsService`dagi kabi
 * — qo'shimcha SDK shart emas, oddiy `fetch` yetarli (bitta HTTP so'rov,
 * REST shartnoma barqaror).
 *
 * GOOGLE_CLIENT_ID/SECRET yo'q bo'lsa `isConfigured()` false — OtpService
 * naqshi bilan bir xil: jim yutqazib, "muvaffaqiyatli" deb yolg'on aytmaydi.
 */
@Injectable()
export class GoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name);

  isConfigured(): boolean {
    return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  }

  async exchangeCode(
    code: string,
    redirectUri: string,
  ): Promise<{ email: string; name?: string } | null> {
    if (!this.isConfigured()) return null;

    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID as string,
          client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });
      if (!tokenRes.ok) {
        // Xom javob TANASI loglanmaydi — kod/token PII-darajasidagi sir
        // bo'lishi mumkin (ADR-014 bilan bir xil intizom).
        this.logger.error(`Google token almashinuvi muvaffaqiyatsiz: HTTP ${tokenRes.status}`);
        return null;
      }
      const tokenJson = (await tokenRes.json()) as { access_token?: string };
      if (!tokenJson.access_token) {
        this.logger.error('Google token javobida access_token yo\'q');
        return null;
      }

      const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      });
      if (!profileRes.ok) {
        this.logger.error(`Google profil so'rovi muvaffaqiyatsiz: HTTP ${profileRes.status}`);
        return null;
      }
      const profile = (await profileRes.json()) as {
        email?: string;
        email_verified?: boolean;
        name?: string;
      };
      // `email_verified=false` bo'lsa hisob egaligi tasdiqlanmagan — bunday
      // email bilan avtomatik login/signup RUXSAT ETILMAYDI (hisob egallash xavfi).
      if (!profile.email || !profile.email_verified) {
        this.logger.warn('Google profilida email tasdiqlanmagan — login rad etildi');
        return null;
      }
      return { email: profile.email.toLowerCase(), name: profile.name };
    } catch (e) {
      this.logger.error(`Google OAuth xatosi: ${(e as Error).message}`);
      return null;
    }
  }
}
