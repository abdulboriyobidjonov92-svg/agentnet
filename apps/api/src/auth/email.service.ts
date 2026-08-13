import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
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
    } else {
      // Ilgari prod'da bu YER'da `throw` bo'lardi — bitta yetishmagan kalit BUTUN
      // API'ni boot'da qulatardi (telefon-login sozlangan bo'lsa ham). Endi boot
      // qulamaydi: validateEnv() kamida BITTA login-kanali (email YOKI telefon)
      // borligini kafolatlaydi; email kanali yo'q bo'lsa bu servis jim turadi va
      // faqat email-OTP so'ralganda aniq xato beradi (telefon-login ishlayveradi).
      this.resend = null;
      this.logger.warn(
        isProd
          ? "RESEND_API_KEY yo'q — EMAIL orqali kirish o'chirilgan (telefon-login ishlashi mumkin)."
          : 'RESEND_API_KEY sozlanmagan — email yuborilmaydi, OTP kod serverga log qilinadi (dev).',
      );
    }
  }

  /**
   * Phase 5 (P5.8) — email manzilini logga xavfsiz ko'rinishda yozadi.
   *
   * ADR-014: "PII hech qachon logga tushmaydi (telefon/email/token/sir
   * maskalanadi)". Bu yerda to'liq manzil YO'Q, lekin qo'llab-quvvatlash
   * uchun yetarli ko'rsatkich bor: domen + birinchi harf. Ikkita turli
   * foydalanuvchini ajratish uchun bu yetarli, kimligini aniqlash
   * uchun — yo'q.
   */
  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    return `${local.slice(0, 1)}***@${domain}`;
  }

  async sendOtpCode(email: string, code: string): Promise<void> {
    if (!this.resend) {
      /**
       * FAIL-CLOSED (P5.8 tuzatmasi): ilgari shart `NODE_ENV ===
       * 'production'` edi, ya'ni `NODE_ENV` UMUMAN QO'YILMAGAN muhitda
       * (noto'g'ri sozlangan prod, konteyner default'i) kod pastdagi
       * "DEV" tarmog'iga tushib, OTP **ochiq matnda logga** yozilardi.
       * Endi teskarisi: kod FAQAT aniq dev/test da loglanadi; qolgan
       * har qanday holatda — xato. Noaniqlik endi xavfsiz tomonga
       * og'adi.
       */
      const env = process.env.NODE_ENV;
      const isExplicitDev = env === 'development' || env === 'test';
      if (!isExplicitDev) {
        this.logger.error(
          `Email-OTP so'raldi, lekin RESEND_API_KEY yo'q (${this.maskEmail(email)}).`,
        );
        throw new Error('Email orqali kirish hozircha mavjud emas — iltimos telefon bilan kiring.');
      }
      this.logger.warn(
        `[DEV OTP] ${this.maskEmail(email)} -> ${code} (Resend sozlanmagani uchun yuborilmadi)`,
      );
      return;
    }

    const { error } = await this.resend.emails.send({
      from: this.from,
      to: email,
      subject: `${code} — AgentNet kirish kodi`,
      html: `<p>AgentNet'ga kirish kodingiz:</p><p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p><p>Kod 10 daqiqa amal qiladi. Agar bu so'rovni siz yubormagan bo'lsangiz, e'tiborsiz qoldiring.</p>`,
    });

    if (error) {
      // 2026-08-13 insidenti: bu yerda oddiy `Error` tashlanardi va u
      // NestJS'da **500 "Ichki server xatosi"** ga aylanardi. Natijada
      // TASHQI xizmat nosozligi (Resend domeni tasdiqlanmagan) bizning
      // kod xatomizdan ajratib bo'lmasdi — na foydalanuvchi, na operator
      // sababni ko'ra olardi, faqat "Ichki server xatosi".
      //
      // Endi: 503 (vaqtinchalik, tashqi bog'liqlik) + MASHINA O'QIY
      // OLADIGAN sabab kodi. Resend'ning xom javobi FAQAT logga tushadi —
      // u foydalanuvchi manzili kabi ma'lumot saqlashi mumkin.
      const detail = typeof error === 'object' && error !== null ? (error as { name?: string }).name : undefined;
      this.logger.error(`Resend email yuborib bo'lmadi: ${JSON.stringify(error)}`);
      throw new ServiceUnavailableException({
        statusCode: 503,
        reason: 'email_provider_rejected',
        providerError: detail ?? 'unknown',
        message: "Email yuborib bo'lmadi, birozdan so'ng qayta urinib ko'ring",
      });
    }
  }
}
