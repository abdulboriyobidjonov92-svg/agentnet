import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * SEC-05 — endpoint uchun talab qilinadigan rollarni belgilaydi.
 *
 * Ishlatish: `@Roles(UserRole.OWNER)` yoki `@Roles(UserRole.OWNER, UserRole.ADMIN)`.
 *
 * MUHIM semantika: bu ro'yxat "kamida shu daraja" EMAS — u AYNAN sanab
 * o'tilgan rollar to'plami (`RolesGuard` ierarxiyaga emas, a'zolikka qaraydi).
 * Ya'ni `@Roles(UserRole.ADMIN)` OWNER'ni ichiga OLMAYDI — OWNER ham kirishi
 * kerak bo'lsa, u ham ochiq yoziladi: `@Roles(UserRole.OWNER, UserRole.ADMIN)`.
 * Bu ataylab: avtorizatsiyada oshkoralik jimgina merosdan xavfsizroq, va
 * §6.1 ruxsat matritsasida ADMIN qila olmaydigan, faqat OWNER qiladigan
 * amallar bor (masalan balansdan yechish) — ierarxik "yuqori rol hammasini
 * qiladi" qoidasi u yerda noto'g'ri natija berardi.
 *
 * Dekorator QO'YILMAGAN endpoint uchun qoida boshqacha: `RolesGuard` uni
 * ierarxiya bo'yicha "kamida MEMBER" deb baholaydi (AC #4).
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
