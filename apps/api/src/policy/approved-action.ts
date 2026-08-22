import { BadRequestException } from '@nestjs/common';

/**
 * V3-P0 · P0-6/P0-8 — TASDIQLANGAN AMALNI TEKSHIRISH.
 *
 * Tasdiqdan keyin amal BAJARILADI. Bu — imtiyoz oshirishning eng aniq
 * yuzasi, shuning uchun tekshiruv alohida, testlanadigan funksiyada.
 *
 * ⚠️ ASOSIY QOIDA: foydalanuvchi **faqat parametrlarni** tuzata oladi.
 * `connector` va `action` QULFLANGAN.
 *
 * Nega: agent "google-sheets.read_range" ni taklif qiladi (LOW, tasdiq
 * kerak emas edi) yoki "telegram.send" ni (HIGH). Agar tahrirlashda
 * `connector`/`action` ni almashtirishga ruxsat berilsa, foydalanuvchi
 * (yoki uning nomidan ishlayotgan injection) tasdiq oynasida ko'rgan
 * amalni BOSHQASIGA — masalan `payme.create_invoice` ga — almashtirib
 * yuborardi. Ya'ni policy engine bergan qaror boshqa amalga ko'chirilardi.
 *
 * Shuning uchun: tier qaysi amal uchun hisoblangan bo'lsa, AYNAN o'sha
 * amal bajariladi.
 */

export interface ProposedAction {
  connector: string;
  action: string;
  params: Record<string, unknown>;
}

/** `proposedAction`/`modifiedAction` JSON'ini xavfsiz shaklga keltiradi. */
export function parseProposedAction(raw: unknown): ProposedAction | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.connector !== 'string' || !o.connector) return null;
  if (typeof o.action !== 'string' || !o.action) return null;
  const params =
    typeof o.params === 'object' && o.params !== null && !Array.isArray(o.params)
      ? (o.params as Record<string, unknown>)
      : {};
  return { connector: o.connector, action: o.action, params };
}

/**
 * Bajariladigan amalni aniqlaydi.
 *
 * `modified` berilgan bo'lsa — undagi PARAMETRLAR olinadi, lekin
 * `connector`/`action` **taklifdan** olinadi va mos kelmasa rad etiladi.
 */
export function resolveApprovedAction(
  proposedRaw: unknown,
  modifiedRaw: unknown,
): ProposedAction {
  const proposed = parseProposedAction(proposedRaw);
  if (!proposed) {
    // Bu holat yozuv buzilganini anglatadi — jimgina "hech narsa qilmaslik"
    // o'rniga aniq xato: tasdiqlangan amal bajarilmagani foydalanuvchiga
    // KO'RINISHI kerak.
    throw new BadRequestException("Tasdiq so'rovidagi amal yozuvi buzuq");
  }
  if (modifiedRaw == null) return proposed;

  const modified = parseProposedAction(modifiedRaw);
  if (!modified) {
    // Faqat parametrlar berilgan bo'lishi ham mumkin (`{params: {...}}`).
    const o = modifiedRaw as Record<string, unknown>;
    const params =
      typeof o?.params === 'object' && o.params !== null && !Array.isArray(o.params)
        ? (o.params as Record<string, unknown>)
        : null;
    if (!params) throw new BadRequestException('Tuzatilgan amal shakli noto‘g‘ri');
    return { ...proposed, params };
  }

  if (modified.connector !== proposed.connector || modified.action !== proposed.action) {
    throw new BadRequestException(
      "Tahrirlashda faqat parametrlarni o‘zgartirish mumkin — konnektor va amal qulflangan",
    );
  }
  return { ...proposed, params: modified.params };
}
