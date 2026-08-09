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
   * Shuning uchun hozirgi amallarda 0 — ular darhol bajarilishi mumkin.
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
  // §6.1: "Qo'lda kredit berish — OWNER ✅, ADMIN ✅ (≤500k so'm/kun), SUPPORT ❌"
  //
  // §6.5 xavfli ro'yxatida "qo'lda kredit >500k so'm" turibdi, ya'ni
  // matn bo'yicha kichik summa oqimdan tashqarida qolardi. ATAYLAB
  // shunday QILINMADI: bu ikkinchi (nazoratsiz) kredit yo'lini talab
  // qilardi — SEC-12 buyrug'i esa "ikkinchi tasdiqlash mexanizmi
  // yaratilmaydi" deydi. Chegara yo'qolmadi: u `ADMIN_DAILY_CREDIT_CAP`
  // sifatida ADMIN uchun KUNLIK limitga aylandi (quyida).
  credit_manual: {
    allowedRoles: [UserRole.OWNER, UserRole.ADMIN],
    confirmVerb: 'CREDIT',
    executionDelayMs: 0,
  },
  // §6.1: "Foydalanuvchini bloklash — OWNER ✅, ADMIN ✅, SUPPORT ❌"
  user_block: {
    allowedRoles: [UserRole.OWNER, UserRole.ADMIN],
    confirmVerb: 'BLOCK',
    executionDelayMs: 0,
  },
  // Blokdan chiqarish ham SHU oqimdan o'tadi: u xavfsizlik qarorini
  // BEKOR QILADI (bloklangan hisob qaytadan ishlay boshlaydi), ya'ni
  // bloklashning o'zi kabi sabab + TOTP + ikki audit yozuvi talab qiladi.
  user_unblock: {
    allowedRoles: [UserRole.OWNER, UserRole.ADMIN],
    confirmVerb: 'UNBLOCK',
    executionDelayMs: 0,
  },
};

/**
 * §6.1 — ADMIN uchun qo'lda kreditning KUNLIK chegarasi: 500 000 so'm.
 * Tiyinda: 500_000 × 100. OWNER uchun chegara YO'Q (matritsada "✅").
 */
export const ADMIN_DAILY_CREDIT_CAP_TIYIN = 50_000_000n;

/**
 * Bitta amaldagi MUTLAQ chegara (10 mln so'm) — rolidan qat'i nazar.
 *
 * Bu ruxsat emas, XATOGA QARSHI to'siq: tiyin/so'm chalkashligi yoki
 * ortiqcha nol bitta klikda hamyonga 100× ko'p pul yozardi. Chegaradan
 * katta summa — bir necha amal (har biri alohida auditlanadi).
 */
export const MAX_SINGLE_CREDIT_TIYIN = 1_000_000_000n;

/** Kunlik chegara oynasi (ms) — "kun" sifatida oxirgi 24 soat. */
export const CREDIT_CAP_WINDOW_MS = 24 * 60 * 60 * 1000;

/** §6.5(3) — server kutayotgan ANIQ tasdiqlash satri. */
export function expectedConfirmation(kind: DangerousActionKind, targetUserId: string): string {
  return `${DANGEROUS_ACTIONS[kind].confirmVerb} ${targetUserId}`;
}
