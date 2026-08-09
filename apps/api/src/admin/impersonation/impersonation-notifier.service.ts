import { Injectable, Logger } from '@nestjs/common';
import type { ImpersonationSession, User } from '@prisma/client';
import { ConnectorsService } from '../../connectors/connectors.service';
import { escapeTelegramHtml } from '../dangerous/admin-alert.service';

/**
 * SEC-12 §6.6 (oxirgi bant) — "Foydalanuvchiga xabar: impersonation tugagach
 * unga bildirishnoma (shaffoflik — ishonch mahsulotning bir qismi)."
 *
 * MAVJUD INFRATUZILMA: `ConnectorsService.sendViaChannel(user,'telegram',...)`
 * — bu platformadagi YAGONA "foydalanuvchiga xabar yuborish" yo'li
 * (`device-companion.service.ts` juftlash ogohlantirishida va
 * `agent-billing.service.ts` muzlatish xabarida ayni shu ishlatiladi).
 * Parallel bildirishnoma tizimi YARATILMAYDI.
 *
 * QACHON: sessiya TUGAGANDA (aniq to'xtatish yoki muddat) — Contract shuni
 * aytadi. Boshlanishda yuborilmaydi: qo'llab-quvvatlash chaqirig'i davomida
 * foydalanuvchi allaqachon operator bilan gaplashayotgan bo'ladi, tugash
 * xabari esa TO'LIQ (davomiyligi bilan) va tekshiriladigan bo'ladi.
 *
 * NIMA YOZILMAYDI (§21 "unnecessary internal security information"):
 * operator emaili/id'si, sessiya id'si, ko'rilgan sahifalar. Foydalanuvchiga
 * FAKT, SABAB va VAQT beriladi; kim ko'rgani — audit jurnalining ishi
 * (u yerda `actorId` bor), foydalanuvchiga operatorni nomlash esa
 * qo'llab-quvvatlash xodimini shaxsiy tahdid ostiga qo'yadi.
 *
 * BEST-EFFORT: yetkazib bo'lmasa sessiya tugashi BEKOR QILINMAYDI — audit
 * yozuvi birlamchi dalil, bildirishnoma esa shaffoflik qatlami.
 */
@Injectable()
export class ImpersonationNotifierService {
  private readonly logger = new Logger(ImpersonationNotifierService.name);

  constructor(private readonly connectors: ConnectorsService) {}

  /**
   * Nishonga tugash xabarini yuboradi.
   * @returns yuborildimi (`true` bo'lsa `notifiedAt` belgilanadi)
   */
  async notifyEnded(target: User, session: ImpersonationSession): Promise<boolean> {
    if (!target.telegramChatId) {
      // Kanal yo'q — jim yo'qolmaydi: audit yozuvi baribir bor, bu yerda
      // faqat "yetkazib bo'lmadi" fakti loglanadi.
      this.logger.log(
        `Impersonation bildirishnomasi yuborilmadi (kanal yo'q): session=${session.id}`,
      );
      return false;
    }

    const minutes = Math.max(
      1,
      Math.round(
        ((session.endedAt ?? new Date()).getTime() - session.createdAt.getTime()) / 60000,
      ),
    );

    const text =
      `🔎 <b>Hisobingiz qo'llab-quvvatlash tomonidan ko'rildi</b>\n` +
      `Vaqt: ${session.createdAt.toISOString()}\n` +
      `Davomiyligi: ~${minutes} daqiqa\n` +
      `Rejim: faqat o'qish (hech narsa o'zgartirilmadi)\n` +
      // Sabab — OPERATOR yozgan erkin matn. `parse_mode: 'HTML'` uchun
      // xavfsizlashtiriladi: aks holda bitta `<` belgisi butun xabarni
      // Telegram tomonidan rad etdirardi (foydalanuvchi hech narsa olmasdi).
      `Sabab: ${escapeTelegramHtml(session.reason)}\n\n` +
      `Bu siz so'ramagan bo'lsa, darhol qo'llab-quvvatlashga murojaat qiling.`;

    try {
      const res = await this.connectors.sendViaChannel(
        target,
        'telegram',
        target.telegramChatId,
        text,
      );
      if (!res.ok) {
        this.logger.warn(`Impersonation bildirishnomasi yuborilmadi: ${res.error}`);
        return false;
      }
      return true;
    } catch (e) {
      this.logger.warn(
        `Impersonation bildirishnomasi yuborilmadi: ${(e as Error).message}`,
      );
      return false;
    }
  }
}
