import { UserRole } from '@prisma/client';
import { outranks } from './role-rank';

/**
 * SEC-12 §6.6 — impersonation SIYOSATI (yagona manba).
 *
 * Bu fayl "kim, kimni, nima qila oladi" savoliga BIR JOYDA javob beradi.
 * Guard, servis va testlar shu yerdan o'qiydi — ya'ni siyosat controller
 * dekoratorlariga sochilib ketmaydi va frontendda TAKRORLANMAYDI.
 */

/**
 * §6.1 matritsasi: "Impersonation (read-only) — OWNER ✅ ADMIN ✅ SUPPORT ✅".
 * MEMBER/VIEWER ro'yxatda YO'Q — ular hech qachon impersonation qila olmaydi.
 */
export const IMPERSONATION_ACTOR_ROLES: readonly UserRole[] = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.SUPPORT,
];

/** §6.6 — maksimal umr (30 daqiqa), millisekundda. */
export const IMPERSONATION_MAX_DURATION_MS = 30 * 60 * 1000;

/** §6.6 — sabab uzunligi. SEC-11 (§6.5(1)) bilan AYNAN bir xil chegara. */
export const IMPERSONATION_MIN_REASON = 20;

/**
 * Aktor shu nishonni impersonation qila oladimi (ROL darajasida)?
 *
 * QAT'IY yuqori rol talab qilinadi (`outranks`). Bundan kelib chiqadi:
 *   • MEMBER/VIEWER umuman aktor bo'la olmaydi (yuqoridagi ro'yxat),
 *   • hech kim OWNER'ni impersonation qila olmaydi (OWNER — eng yuqori
 *     daraja, undan qat'iy yuqori rol yo'q),
 *   • ADMIN boshqa ADMIN'ni, SUPPORT boshqa SUPPORT'ni ko'ra olmaydi,
 *   • o'z-o'zini impersonation qilish ham shu bilan yopiladi (bir xil rol),
 *     lekin servis buni ALOHIDA ham tekshiradi (OWNER o'zi uchun `outranks`
 *     baribir `false` beradi — ikkinchi to'siq ortiqcha emas, aniqroq xato
 *     xabari beradi).
 */
export function canImpersonateRole(actorRole: UserRole, targetRole: UserRole): boolean {
  if (!IMPERSONATION_ACTOR_ROLES.includes(actorRole)) return false;
  return outranks(actorRole, targetRole);
}

/**
 * §6.6 / §8 — impersonation sessiyasida TAQIQLANGAN O'QISH yo'llari.
 *
 * YOZISH umuman taqiqlangan (guard xavfsiz bo'lmagan HTTP metodlarini
 * to'liq rad etadi), shuning uchun bu ro'yxat FAQAT `GET` yuzasi haqida —
 * ya'ni "o'qish ham juda maxfiy" bo'lgan joylar. §6.6: "Hech qachon ruxsat
 * etilmaydi: ... konnektor sirlarini ko'rish, qo'ng'iroq yozuvini eshitish,
 * qurilma buyrug'i yuborish".
 *
 * Prefiks bo'yicha solishtiriladi (yo'l `/api/` global prefiksidan keyin),
 * ya'ni yangi qo'shilgan `device/...` endpointi AVTOMATIK qamraladi —
 * "unutilgan qator" xatosi bu yerda mumkin emas.
 */
export const IMPERSONATION_FORBIDDEN_READ_PREFIXES: readonly string[] = [
  // Qurilma boshqaruvi: qo'ng'iroq yozuvlari, companion tokenlari, buyruq
  // navbati va ekran/kamera yuzasi — butun prefiks yopiladi.
  'device',
  // GDPR eksport — hisobning TO'LIQ shaxsiy dampi bitta so'rovda.
  'users/me/export',
  // 2FA sozlash yuzasi (QR/secret). Yozish allaqachon yopiq, lekin o'qish
  // ham sirni oshkor qiladi.
  'auth/2fa',
];

/**
 * Yo'l taqiqlangan prefikslardan biriga tushadimi?
 * `path` — global `/api/` prefiksisiz, boshidagi `/` siz (masalan
 * `device/recordings/abc`).
 */
export function isForbiddenImpersonationRead(path: string): boolean {
  const normalized = path.replace(/^\/+/, '').replace(/\/+$/, '');
  return IMPERSONATION_FORBIDDEN_READ_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  );
}

/**
 * §6.6 — impersonation sessiyasida ruxsat etilgan HTTP metodlari.
 * "Read-only" ni METOD darajasida ta'riflaymiz, endpoint ro'yxati bilan
 * emas: yangi yozish endpointi qo'shilganda uni ro'yxatga qo'shishni
 * "unutib qoldirish" mumkin emas (§8 talabi).
 */
export const IMPERSONATION_SAFE_METHODS: readonly string[] = ['GET', 'HEAD', 'OPTIONS'];
