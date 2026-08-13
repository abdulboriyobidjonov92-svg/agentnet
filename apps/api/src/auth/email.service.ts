import { Injectable, Logger, Optional, ServiceUnavailableException } from '@nestjs/common';
import { Resend } from 'resend';
import { createTransport, type Transporter } from 'nodemailer';

/**
 * Email OTP yetkazish — IKKI provayder: Resend yoki Gmail SMTP.
 *
 * NEGA IKKITA (2026-08-13): Resend ixtiyoriy foydalanuvchiga yuborish uchun
 * DOMEN TASDIQLASHNI talab qiladi (`validation_error`). Domen tasdiqlanmagan
 * ekan, ro'yxatdan o'tish HECH KIM uchun ishlamaydi. Gmail SMTP — vaqtinchalik
 * ko'prik: u istalgan manzilga yuboradi va domen talab qilmaydi.
 *
 * CHEKLOV (halol): Gmail SMTP kuniga ~500 xat bilan chegaralangan va
 * tranzaksion pochta uchun mo'ljallanmagan. Bu — VAQTINCHALIK yechim;
 * domen tasdiqlangach `EMAIL_PROVIDER=resend` ga qaytiladi.
 *
 * TANLASH TARTIBI:
 *   1. `EMAIL_PROVIDER` ANIQ berilgan bo'lsa — o'sha (va u sozlanmagan
 *      bo'lsa, jimgina boshqasiga o'tmaydi: aniq xato beradi);
 *   2. berilmagan bo'lsa — Gmail (agar sozlangan bo'lsa), aks holda Resend.
 *
 * Prod'da kamida BITTA kanal bo'lishi `validateEnv()` bilan kafolatlanadi.
 */
type Provider = 'resend' | 'gmail' | 'none';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null = null;
  private readonly smtp: Transporter | null = null;
  private readonly provider: Provider;
  private readonly from: string;

  // `@Optional()` — Nest `NodeJS.ProcessEnv` interfeysini hal qila olmaydi
  // (u ish vaqtida `Object`). Usiz butun DI grafigi yig'ilmasdi. Testlar
  // muhitni shu orqali beradi, prod'da esa `process.env` ishlatiladi.
  constructor(@Optional() envOverride?: NodeJS.ProcessEnv) {
    const env = envOverride ?? process.env;
    const resendKey = env.RESEND_API_KEY?.trim();
    const gmailUser = env.GMAIL_USER?.trim();
    const gmailPass = env.GMAIL_APP_PASSWORD?.trim();
    const requested = env.EMAIL_PROVIDER?.trim().toLowerCase();

    const gmailReady = Boolean(gmailUser && gmailPass);
    const resendReady = Boolean(resendKey);

    if (requested === 'resend') this.provider = resendReady ? 'resend' : 'none';
    else if (requested === 'gmail') this.provider = gmailReady ? 'gmail' : 'none';
    else if (gmailReady) this.provider = 'gmail';
    else if (resendReady) this.provider = 'resend';
    else this.provider = 'none';

    if (this.provider === 'resend') {
      this.resend = new Resend(resendKey as string);
      this.from = env.RESEND_FROM_EMAIL?.trim() || 'AgentNet <login@agentnet.app>';
    } else if (this.provider === 'gmail') {
      this.smtp = createTransport({
        service: 'gmail',
        auth: { user: gmailUser as string, pass: gmailPass as string },
      });
      // Gmail yuboruvchini O'ZGARTIRIB bo'lmaydi — u har doim hisob
      // manzilidan ketadi. Shuning uchun `RESEND_FROM_EMAIL` bu yerda
      // ISHLATILMAYDI (aks holda "yuborildi, lekin boshqa manzildan"
      // degan chalg'ituvchi holat bo'lardi).
      this.from = `AgentNet <${gmailUser}>`;
    } else {
      this.from = '';
    }

    const isProd = env.NODE_ENV === 'production';
    if (this.provider === 'none') {
      this.logger.warn(
        isProd
          ? "Email provayderi sozlanmagan — EMAIL orqali kirish o'chirilgan (telefon-login ishlashi mumkin)."
          : 'Email provayderi sozlanmagan — OTP kod serverga log qilinadi (dev).',
      );
    } else {
      this.logger.log(`Email provayderi: ${this.provider} (from: ${this.from})`);
    }
  }

  /** Diagnostika uchun (sog'liq/testlar) — sir oshkor qilmaydi. */
  activeProvider(): Provider {
    return this.provider;
  }

  /**
   * Phase 5 (P5.8) — email manzilini logga xavfsiz ko'rinishda yozadi.
   * ADR-014: PII hech qachon logga tushmaydi.
   */
  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    return `${local.slice(0, 1)}***@${domain}`;
  }

  /**
   * `example.com` — IANA tomonidan HUJJAT/TEST uchun ajratilgan domen
   * (RFC 2606). U yerga hech qachon haqiqiy pochta yetib bormaydi, lekin
   * provayder uni `validation_error` bilan RAD ETADI va bu sog'liq
   * tekshiruvini soxta "buzilgan" holatga tushirardi. Shuning uchun
   * yuborish O'TKAZIB YUBORILADI — jimgina emas, ochiq log bilan.
   */
  private isProbeAddress(email: string): boolean {
    return /@(example\.(com|net|org)|test|invalid|localhost)$/i.test(email.trim());
  }

  async sendOtpCode(email: string, code: string): Promise<void> {
    if (this.isProbeAddress(email)) {
      this.logger.log(`[PROBE] ${this.maskEmail(email)} — test manzili, email YUBORILMADI`);
      return;
    }

    if (this.provider === 'none') {
      /**
       * FAIL-CLOSED (P5.8): kod FAQAT aniq dev/test da loglanadi; qolgan
       * har qanday holatda — xato. Noaniqlik xavfsiz tomonga og'adi.
       */
      const env = process.env.NODE_ENV;
      const isExplicitDev = env === 'development' || env === 'test';
      if (!isExplicitDev) {
        this.logger.error(`Email-OTP so'raldi, lekin provayder sozlanmagan (${this.maskEmail(email)}).`);
        throw new ServiceUnavailableException({
          statusCode: 503,
          reason: 'email_provider_unconfigured',
          message: 'Email orqali kirish hozircha mavjud emas — iltimos telefon bilan kiring.',
        });
      }
      this.logger.warn(`[DEV OTP] ${this.maskEmail(email)} -> ${code} (provayder sozlanmagani uchun yuborilmadi)`);
      return;
    }

    const subject = `${code} — AgentNet kirish kodi`;
    const html =
      `<p>AgentNet'ga kirish kodingiz:</p>` +
      `<p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p>` +
      `<p>Kod 10 daqiqa amal qiladi. Agar bu so'rovni siz yubormagan bo'lsangiz, e'tiborsiz qoldiring.</p>`;

    if (this.provider === 'gmail') {
      try {
        const info = await (this.smtp as Transporter).sendMail({ from: this.from, to: email, subject, html });
        this.logger.log(`Email yuborildi (gmail) -> ${this.maskEmail(email)} [messageId: ${info.messageId}]`);
        return;
      } catch (e) {
        // Xom xato FAQAT logga (u manzil/kredensial ma'lumotini saqlashi mumkin).
        this.logger.error(`Gmail SMTP yuborib bo'lmadi: ${(e as Error).message}`);
        throw new ServiceUnavailableException({
          statusCode: 503,
          reason: 'email_provider_rejected',
          providerError: 'gmail_smtp_error',
          message: "Email yuborib bo'lmadi, birozdan so'ng qayta urinib ko'ring",
        });
      }
    }

    const { error } = await (this.resend as Resend).emails.send({ from: this.from, to: email, subject, html });
    if (error) {
      const detail = typeof error === 'object' && error !== null ? (error as { name?: string }).name : undefined;
      this.logger.error(`Resend email yuborib bo'lmadi: ${JSON.stringify(error)}`);
      throw new ServiceUnavailableException({
        statusCode: 503,
        reason: 'email_provider_rejected',
        providerError: detail ?? 'unknown',
        message: "Email yuborib bo'lmadi, birozdan so'ng qayta urinib ko'ring",
      });
    }
    this.logger.log(`Email yuborildi (resend) -> ${this.maskEmail(email)}`);
  }
}
