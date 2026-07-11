import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

/**
 * Email OTP yetkazish — Resend (https://resend.com) orqali.
 *
 * Prod'da RESEND_API_KEY SHART (boshqa maxfiy-kalitlar bilan bir xil
 * fail-closed qoida — [[crypto.service]], [[token.util]]). Dev'da kalit
 * bo'lmasa, kod jo'natilmaydi — server logiga chiqariladi, shu bilan
 * mahalliy ishlab chiqish uchun haqiqiy Resend hisobi shart emas.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    const isProd = process.env.NODE_ENV === 'production';
    this.from = process.env.RESEND_FROM_EMAIL || 'AgentNet <login@agentnet.app>';

    if (apiKey && apiKey.trim()) {
      this.resend = new Resend(apiKey.trim());
    } else if (isProd) {
      throw new Error(
        'RESEND_API_KEY production uchun SHART (email-OTP yetkazish). resend.com da API kalit yarating.',
      );
    } else {
      this.resend = null;
      this.logger.warn(
        'RESEND_API_KEY sozlanmagan — email yuborilmaydi, OTP kod faqat serverga log qilinadi (faqat dev).',
      );
    }
  }

  async sendOtpCode(email: string, code: string): Promise<void> {
    if (!this.resend) {
      this.logger.warn(`[DEV OTP] ${email} -> ${code} (Resend sozlanmagani uchun yuborilmadi)`);
      return;
    }

    const { error } = await this.resend.emails.send({
      from: this.from,
      to: email,
      subject: `${code} — AgentNet kirish kodi`,
      html: `<p>AgentNet'ga kirish kodingiz:</p><p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p><p>Kod 10 daqiqa amal qiladi. Agar bu so'rovni siz yubormagan bo'lsangiz, e'tiborsiz qoldiring.</p>`,
    });

    if (error) {
      this.logger.error(`Resend email yuborib bo'lmadi: ${JSON.stringify(error)}`);
      throw new Error("Email yuborib bo'lmadi, birozdan so'ng qayta urinib ko'ring");
    }
  }
}
