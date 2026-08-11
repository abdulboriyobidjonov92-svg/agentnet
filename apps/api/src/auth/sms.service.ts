import { Injectable, Logger } from '@nestjs/common';

/**
 * SMS OTP yetkazish — Eskiz.uz (https://eskiz.uz) orqali, O'zbekiston raqamlari uchun.
 *
 * ESKIZ_EMAIL/ESKIZ_PASSWORD hali sozlanmagan bo'lishi mumkin (hisob ochilmagan) —
 * shu holatda `isConfigured()` false qaytaradi va OtpService telefon orqali
 * kirishni ochiq rad etadi (jim yutqazib, "yuborildi" deb yolg'on aytmaydi).
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly baseUrl = 'https://notify.eskiz.uz/api';
  private token: string | null = null;
  private tokenExpiresAt = 0;

  isConfigured(): boolean {
    return !!(process.env.ESKIZ_EMAIL && process.env.ESKIZ_PASSWORD);
  }

  async sendOtpCode(phone: string, code: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error(
        "SMS orqali kirish hozircha mavjud emas (ESKIZ_EMAIL/ESKIZ_PASSWORD sozlanmagan)",
      );
    }

    const message = `AgentNet kirish kodi: ${code}. Hech kimga aytmang.`;
    const mobilePhone = phone.replace(/^\+/, '');

    const attempt = async (): Promise<Response> => {
      const token = await this.getToken();
      return fetch(`${this.baseUrl}/message/sms/send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          mobile_phone: mobilePhone,
          message,
          from: process.env.ESKIZ_SMS_FROM || '4546',
        }),
      });
    };

    let res = await attempt();
    if (res.status === 401) {
      // Token eskirgan/bekor bo'lgan bo'lishi mumkin — bir marta majburiy yangilab qayta urinamiz.
      this.token = null;
      res = await attempt();
    }

    if (!res.ok) {
      /**
       * Phase 5 (P5.8): uchinchi tomon javob TANASI to'liq loglanardi.
       * Eskiz javobi ichida telefon raqami (PII) va ba'zan auth
       * tafsiloti bo'lishi mumkin — ya'ni bu boshqarilmaydigan payload.
       *
       * Endi: 300 belgiga qisqartiriladi (log portlashi oldi olinadi).
       * Sir shakllari (Bearer/JWT/kalit) esa pino qatlamida
       * `scrubText` bilan kesiladi — ya'ni bu yerda ularni qo'lda
       * qidirish SHART EMAS va ikkinchi (ayrilib ketadigan) ro'yxat
       * paydo bo'lmaydi.
       */
      const body = (await res.text().catch(() => '')).slice(0, 300);
      this.logger.error(`Eskiz SMS yuborilmadi (${res.status}): ${body}`);
      throw new Error("SMS yuborib bo'lmadi, birozdan so'ng qayta urinib ko'ring");
    }
  }

  private async getToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiresAt) return this.token;

    const res = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        email: process.env.ESKIZ_EMAIL,
        password: process.env.ESKIZ_PASSWORD,
      }),
    });
    if (!res.ok) {
      throw new Error("Eskiz autentifikatsiyasi muvaffaqiyatsiz bo'ldi");
    }
    const json = (await res.json()) as { data?: { token?: string } };
    const token = json.data?.token;
    if (!token) throw new Error('Eskiz token qaytarilmadi');

    this.token = token;
    // Eskiz tokeni ~30 kun amal qiladi — 25 kunda xavfsiz yangilaymiz.
    this.tokenExpiresAt = Date.now() + 25 * 24 * 60 * 60 * 1000;
    return token;
  }
}
