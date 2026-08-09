import type { UserRole } from '@prisma/client';
import type { IMPERSONATION_READ_ONLY } from './token.util';

/**
 * SEC-12 — so'rov kontekstidagi impersonation holati.
 *
 * `AuthGuard` uni `request.impersonation` ga qo'yadi (faqat impersonation
 * tokenida). Boshqa har qanday so'rovda maydon YO'Q — ya'ni "impersonation
 * emas" holati `undefined` bilan bir ma'noda ifodalanadi va uni tasodifan
 * `false` deb yozib bo'lmaydi.
 *
 * MUHIM AJRATISH (§10): `realActor*` — AVTORIZATSIYA egasi (kim javobgar),
 * `targetUserId` — KO'RILAYOTGAN identifikator (kimning ma'lumoti). Ular
 * hech qachon almashmaydi; `request.dbUser` esa nishon bo'lib qoladi, chunki
 * qolgan butun kod-baza "men kimman" degan savolga shundan javob oladi.
 */
export interface ImpersonationContext {
  impersonationId: string;
  realActorId: string;
  realActorRole: UserRole;
  realActorEmail: string;
  targetUserId: string;
  mode: typeof IMPERSONATION_READ_ONLY;
  issuedAt: Date;
  expiresAt: Date;
}

/** `request` ning SEC-12 kengaytmasi (Express `Request` ustiga). */
export interface RequestWithImpersonation {
  impersonation?: ImpersonationContext;
}
