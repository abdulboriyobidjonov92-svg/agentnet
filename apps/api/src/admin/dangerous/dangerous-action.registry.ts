import { DangerousActionKind, UserRole } from '@prisma/client';

/**
 * SEC-11 §6.5 — xavfli amallar REGISTRI.
 *
 * Har amal turi shu yerda BIR MARTA e'lon qilinadi: kim bajara oladi,
 * tasdiqlash satri qanday, majburiy kutish bormi. Framework registrdan
 * o'qiydi — ya'ni yangi xavfli amal qo'shish uchun oqimni (sabab, TOTP,
 * tasdiq, ikki audit yozuvi, oyna) qayta yozish SHART EMAS va uni
 * "unutib qoldirish" ham mumkin emas.
 *
 * `@Roles(...)` controller darajasida ham qo'yiladi (birinchi darvoza);
 * bu registr amal-darajasidagi IKKINCHI, aniqroq darvoza — masalan
 * controller ADMIN'ni kiritsa ham, `role_assign` faqat OWNER'da qoladi.
 */

/** Amalni bajara oladigan rollar (§6.1 ruxsat matritsasi). */
export interface DangerousActionSpec {
  /** §6.1: bu amalni kim bajara oladi. */
  allowedRoles: readonly UserRole[];
  /**
   * Tasdiqlash satrining fe'li (§6.5(3) `DELETE user_abc123` naqshi).
   * To'liq kutilgan satr: `<VERB> <targetUserId>`.
   */
  confirmVerb: string;
  /**
   * Bajarishdan oldin MAJBURIY kutish (ms).
   *
   * Contract §6.5(5): kechiktirilgan bajarish FAQAT o'chirish uchun.
   * Shuning uchun hozirgi ikki amalda 0 — ular darhol bajarilishi mumkin.
   * Bekor qilish oynasi baribir REAL: tasdiq `expiresAt` gacha yashaydi
   * va shu vaqt ichida bekor qilinadi (`dangerous-action.service.ts`).
   */
  executionDelayMs: number;
}

/** Tasdiq shu muddatdan keyin eskiradi — §6.5 "24 soatlik oyna". */
export const APPROVAL_WINDOW_MS = 24 * 60 * 60 * 1000;

export const DANGEROUS_ACTIONS: Record<DangerousActionKind, DangerousActionSpec> = {
  // §6.1: "Rol tayinlash — OWNER ✅, ADMIN ❌, SUPPORT ❌"
  role_assign: {
    allowedRoles: [UserRole.OWNER],
    confirmVerb: 'ROLE',
    executionDelayMs: 0,
  },
  // §6.1: "Sessiyalarni ommaviy bekor qilish — OWNER ✅, ADMIN ❌, SUPPORT ❌"
  session_revoke: {
    allowedRoles: [UserRole.OWNER],
    confirmVerb: 'REVOKE',
    executionDelayMs: 0,
  },
};

/** §6.5(3) — server kutayotgan ANIQ tasdiqlash satri. */
export function expectedConfirmation(kind: DangerousActionKind, targetUserId: string): string {
  return `${DANGEROUS_ACTIONS[kind].confirmVerb} ${targetUserId}`;
}
