import { Injectable, Logger } from '@nestjs/common';
import { TelegramService } from '../../telegram/telegram.service';
import { captureMessage } from '../sentry';
import { scrubText } from '../redaction';
import type { AlertEvent } from './alert.types';

export type AlertDeliveryChannel = 'telegram' | 'sentry' | 'log';

export interface AlertDeliveryResult {
  /** Signal AMALDA yuborildimi (yoki faqat logga tushdimi). */
  delivered: boolean;
  /** Muvaffaqiyatli kanallar. */
  channels: AlertDeliveryChannel[];
  /** Sovish (cooldown) sababli o'tkazib yuborilganmi. */
  suppressed: boolean;
  reason?: 'cooldown' | 'no_channel_configured' | 'delivery_failed';
}

/**
 * Phase 5 (P5.4) — SIGNAL YETKAZISH.
 *
 * MAVJUD INFRATUZILMA QAYTA ISHLATILADI (yangi monitoring platformasi
 * KIRITILMAYDI — P5.4 talabi "eng sodda ishonchli mexanizm"):
 *   • Telegram — `TelegramService` (SEC-11 dan beri OWNER signali shu
 *     yo'ldan ketadi, bot tokeni allaqachon env'da);
 *   • Sentry   — `captureMessage` (P5.1 da ulandi);
 *   • Log      — HAR DOIM, oxirgi zaxira.
 *
 * "SOXTA MUVAFFAQIYAT YO'Q" (P5.4 talabi): kanal sozlanmagan bo'lsa
 * `delivered: false` va `reason: 'no_channel_configured'` qaytadi.
 * Signal baribir strukturaviy log sifatida yoziladi, lekin biz uni
 * "yuborildi" deb ATAMAYMIZ. Bu — `AdminAlertService` dagi (SEC-11)
 * bilan bir xil halol naqsh.
 *
 * DEDUP + COOLDOWN: `dedupeKey` bo'yicha, JARAYON ICHIDA. Ko'p instansda
 * har instans o'z sovish oynasini yuritadi (taqsimlangan dedup Redis
 * talab qiladi — Phase 6, ADR-006). Bu cheklov runbook'da yozilgan;
 * bu yerda "global dedup" DEB ATALMAYDI.
 */
@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);
  private readonly lastSentAt = new Map<string, number>();

  constructor(private readonly telegram: TelegramService) {}

  private get chatId(): string {
    // SEC-11 da kiritilgan AYNI env — ikkinchi kanal manzili yaratilmaydi.
    return process.env.OWNER_ALERT_TELEGRAM_CHAT_ID?.trim() ?? '';
  }

  /** Cooldown ichida bo'lsa `true` (signal bostiriladi). */
  isSuppressed(event: AlertEvent, now: number = Date.now()): boolean {
    const last = this.lastSentAt.get(event.dedupeKey);
    if (last === undefined) return false;
    return now - last < event.definition.cooldownMinutes * 60_000;
  }

  /** Testlar uchun — sovish holatini tozalaydi. */
  resetCooldowns(): void {
    this.lastSentAt.clear();
  }

  /**
   * Signal matni. FAQAT sonlar va kodlar — shaxsiy ma'lumot yo'q.
   * Chiqish `scrubText` dan ham o'tadi (ikki qatlamli himoya: kimdir
   * kelajakda `facts` ga sir qo'shib qo'ysa, u baribir kesiladi).
   */
  formatMessage(event: AlertEvent): string {
    const { definition } = event;
    const factLines = Object.entries(event.facts)
      .map(([key, value]) => `  ${key}: ${value}`)
      .join('\n');
    const text =
      `[${definition.severity.toUpperCase()}] ${event.title}\n` +
      `alert: ${definition.key}\n` +
      `oyna: ${definition.windowMinutes} daq\n` +
      `${factLines}\n` +
      `runbook: ${definition.runbook}`;
    return scrubText(text);
  }

  async send(event: AlertEvent, now: number = Date.now()): Promise<AlertDeliveryResult> {
    if (this.isSuppressed(event, now)) {
      return { delivered: false, channels: [], suppressed: true, reason: 'cooldown' };
    }

    const message = this.formatMessage(event);
    const channels: AlertDeliveryChannel[] = [];

    // 1) Log — HAR DOIM va BIRINCHI. Tashqi kanal yiqilsa ham signal
    //    Render loglarida qoladi (SEC-11 dagi bilan bir xil kafolat).
    this.logger.error(`ALERT ${event.definition.key}: ${message.replace(/\n/g, ' | ')}`);
    channels.push('log');

    // 2) Sentry — sozlangan bo'lsa. `captureMessage` sozlanmaganda no-op.
    captureMessage(message, event.definition.severity === 'critical' ? 'error' : 'warning');
    if (process.env.SENTRY_DSN?.trim()) channels.push('sentry');

    // 3) Telegram — operator kanali.
    let telegramOk = false;
    const chatId = this.chatId;
    if (chatId) {
      try {
        // `parse_mode: HTML` ISHLATILMAYDI: matnda foydalanuvchi kiritgan
        // qism yo'q, lekin `<`/`>` bo'lsa Telegram butun xabarni rad
        // etardi (AdminAlertService'da aynan shu tuzoq bor edi).
        await this.telegram.sendMessage(chatId, message);
        telegramOk = true;
        channels.push('telegram');
      } catch (e) {
        this.logger.error(
          `ALERT ${event.definition.key}: Telegram yetkazib berilmadi: ${scrubText((e as Error).message)}`,
        );
      }
    }

    /**
     * "Yetkazildi" deganda TASHQI kanal tushuniladi. Faqat log —
     * yetkazish EMAS (uni hech kim real vaqtda ko'rmaydi).
     */
    const delivered = telegramOk || channels.includes('sentry');

    // Cooldown FAQAT haqiqiy yuborishdan keyin boshlanadi. Aks holda
    // muvaffaqiyatsiz urinish keyingi (ehtimol muvaffaqiyatli) urinishni
    // bir soatga bloklab qo'yardi — jim yo'qolgan signal.
    if (delivered) this.lastSentAt.set(event.dedupeKey, now);

    if (!delivered) {
      return {
        delivered: false,
        channels,
        suppressed: false,
        reason: chatId ? 'delivery_failed' : 'no_channel_configured',
      };
    }

    return { delivered: true, channels, suppressed: false };
  }
}
