import { Injectable, Logger } from '@nestjs/common';
import type { DangerousActionKind } from '@prisma/client';
import { TelegramService } from '../../telegram/telegram.service';

/**
 * SEC-11 §6.5(6) — "har xavfli amal OWNER Telegram kanaliga darhol yuboriladi".
 *
 * MAVJUD ARXITEKTURA QAYTA ISHLATILADI: yuborish `TelegramService.sendMessage`
 * orqali (bot tokeni `TELEGRAM_BOT_TOKEN` env'da, `render.yaml` `sync: false`).
 * Yangi/parallel Telegram integratsiyasi YARATILMAYDI va kodda hech qanday
 * sir saqlanmaydi (Konstitutsiya #7).
 *
 * KANAL MANZILI: `OWNER_ALERT_TELEGRAM_CHAT_ID` env'i — operator
 * to'ldiradigan qiymat (kanal/guruh chat id). U foydalanuvchi ma'lumoti
 * emas, infratuzilma sozlamasi, shuning uchun DB'da emas env'da.
 *
 * SOZLANMAGAN HOLAT — JIM YO'QOLMAYDI: agar env bo'sh bo'lsa, signal
 * `logger.error` bilan STRUKTURAVIY log sifatida yoziladi. Ya'ni xavfli
 * amal hech qachon "hech kim ko'rmasdan" o'tmaydi; log Render'da qoladi va
 * Phase 5 (Sentry) uni avtomatik oladi.
 *
 * DIQQAT: bu servis yetkazib berishni KAFOLATLAMAYDI (Telegram tashqi
 * xizmat). Signal xatosi xavfli amalni TO'XTATMAYDI — audit yozuvi
 * (§6.5(4)) birlamchi, buzilmas dalil; Telegram — qulaylik qatlami.
 */
@Injectable()
export class AdminAlertService {
  private readonly logger = new Logger(AdminAlertService.name);

  constructor(private readonly telegram: TelegramService) {}

  private get ownerChatId(): string {
    return process.env.OWNER_ALERT_TELEGRAM_CHAT_ID?.trim() ?? '';
  }

  async dangerousActionRequested(params: {
    kind: DangerousActionKind;
    actorEmail: string;
    targetEmail: string;
    reason: string;
    actionId: string;
  }): Promise<void> {
    const text =
      `⚠️ <b>Xavfli amal so'raldi</b>\n` +
      `Amal: <code>${params.kind}</code>\n` +
      `Kim: ${params.actorEmail}\n` +
      `Kimga: ${params.targetEmail}\n` +
      `Sabab: ${params.reason}\n` +
      `ID: <code>${params.actionId}</code>`;

    await this.send(text, params.actionId);
  }

  private async send(text: string, actionId: string): Promise<void> {
    const chatId = this.ownerChatId;

    if (!chatId) {
      // Sozlanmagan — LEKIN signal yo'qolmaydi.
      this.logger.error(
        `OWNER signali yuborilmadi (OWNER_ALERT_TELEGRAM_CHAT_ID sozlanmagan). ` +
          `Xavfli amal: ${actionId}. Matn: ${text.replace(/<[^>]+>/g, '')}`,
      );
      return;
    }

    try {
      await this.telegram.sendMessage(chatId, text);
    } catch (e) {
      // Tashqi xizmat xatosi xavfli amalni to'xtatmaydi (audit birlamchi),
      // lekin JIM ham qolmaydi.
      this.logger.error(`OWNER signali yuborilmadi (${actionId}): ${(e as Error).message}`);
    }
  }
}
