import { UserRole } from '@prisma/client';

/**
 * Rol ierarxiyasi — YAGONA manba (Engineering Contract A8 / ADR-002).
 *
 * NEGA ALOHIDA FAYL: bu tartib endi UCH joyda kerak — `RolesGuard`
 * (dekoratorsiz endpoint uchun minimal daraja), SEC-12 impersonation
 * (kim kimni ko'ra oladi) va SEC-12 blok/blokdan-chiqarish (kim kimni
 * bloklay oladi). Uch nusxa — uchta mustaqil xato manbai; ular
 * ajralib qolsa, imtiyoz oshirish yo'li ochiladi.
 *
 * Kichik raqam = YUQORI huquq. Tartib `schema.prisma`dagi `enum UserRole`
 * bilan mos bo'lishi SHART — ikkalasini birga o'zgartiring.
 */
export const ROLE_RANK: Record<UserRole, number> = {
  OWNER: 0,
  ADMIN: 1,
  SUPPORT: 2,
  MEMBER: 3,
  VIEWER: 4,
};

/**
 * `actor` roli `target` rolidan QAT'IY yuqorimi?
 *
 * QAT'IY (`<`, `<=` emas) — ataylab: teng rollar bir-birining ustidan
 * imtiyozli amal bajara olmaydi. Bu bitta qoida uchta hujumni yopadi:
 *   • ADMIN boshqa ADMIN'ni bloklab, uni platformadan chiqarib yuborishi,
 *   • ADMIN OWNER'ni impersonation qilib, OWNER ma'lumotini ko'rishi,
 *   • OWNER boshqa OWNER hisobiga kirib, break-glass izini chalkashtirishi
 *     (§6.7 bus-factor: OWNER hisoblari o'zaro tegilmas bo'lib qoladi).
 *
 * Natijada OWNER hech kim tomonidan impersonation/blok qilinmaydi —
 * "himoyalangan hisob" alohida ro'yxat sifatida saqlanmaydi, u shu
 * qoidadan KELIB CHIQADI (unutib qoldirib bo'lmaydi).
 */
export function outranks(actor: UserRole, target: UserRole): boolean {
  return ROLE_RANK[actor] < ROLE_RANK[target];
}
