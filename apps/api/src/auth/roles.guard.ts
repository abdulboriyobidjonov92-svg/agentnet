import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from './roles.decorator';

/**
 * SEC-05 — global RBAC guard (Engineering Contract A8 / ADR-002).
 *
 * `APP_GUARD` sifatida ro'yxatdan o'tadi, ya'ni HAR bir so'rovdan o'tadi.
 * Ikki rejimda ishlaydi:
 *
 *   1. `@Roles(...)` qo'yilgan bo'lsa — foydalanuvchi rol AYNAN shu ro'yxatda
 *      bo'lishi shart (meros yo'q — sabab `roles.decorator.ts`da).
 *   2. Dekoratorsiz endpoint — ierarxiya bo'yicha "kamida MEMBER" (AC #4).
 *      Ya'ni VIEWER (eng past) dekoratorsiz endpointga kira olmaydi, qolgan
 *      hammasi kiradi. Bugungi kunda hamma real foydalanuvchi MEMBER yoki
 *      undan yuqori, shuning uchun bu mavjud xulqni O'ZGARTIRMAYDI.
 *
 * ENG MUHIM QOIDA — `request.dbUser` yo'q bo'lsa, guard `true` qaytaradi.
 * Sababi: RBAC — autentifikatsiyadan KEYINGI qatlam. `dbUser`ni faqat
 * `ClerkGuard` o'rnatadi. Uni umuman ishlatmaydigan yo'llar ataylab shunday:
 *   - ochiq endpointlar (`/api/health`, `auth/dev-login`, `auth/otp/*`),
 *   - `InternalTokenGuard` bilan himoyalangan servis-ichi yo'llar,
 *   - Payme/Click to'lov webhooklari (`webhooks.controller.ts`).
 * Agar bu yerda `false`/403 qaytarilsa, global guard sifatida u SHU
 * YO'LLARNING HAMMASINI darhol buzardi — jumladan pul webhooklarini.
 * Ya'ni bu "fail-open" emas: bu yo'llar o'z guard'lariga ega yoki ataylab
 * ochiq; RolesGuard ularning avtorizatsiya modeli emas.
 */

/**
 * Ierarxiya faqat DEKORATORSIZ endpointlar uchun ishlatiladi (2-rejim).
 * Kichik raqam = yuqori huquq. Tartib `schema.prisma`dagi `enum UserRole`
 * bilan mos bo'lishi SHART — ikkalasini birga o'zgartiring.
 */
const ROLE_RANK: Record<UserRole, number> = {
  OWNER: 0,
  ADMIN: 1,
  SUPPORT: 2,
  MEMBER: 3,
  VIEWER: 4,
};

/** Dekoratorsiz endpoint uchun minimal daraja (AC #4). */
const DEFAULT_MIN_ROLE: UserRole = 'MEMBER';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request?.dbUser as { role?: UserRole } | undefined;

    // Autentifikatsiya qilinmagan yo'l — yuqoridagi izohga qarang.
    if (!user) return true;

    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const role = user.role;
    // Rol umuman yo'q/noma'lum — fail-closed (dbUser bor, demak bu
    // autentifikatsiya qilingan yo'l va rol kutilishi kerak).
    if (!role || !(role in ROLE_RANK)) {
      throw new ForbiddenException("Ruxsat yo'q");
    }

    if (required && required.length > 0) {
      if (!required.includes(role)) {
        throw new ForbiddenException("Ruxsat yo'q");
      }
      return true;
    }

    // Dekoratorsiz (yoki bo'sh `@Roles()`) — kamida MEMBER.
    if (ROLE_RANK[role] > ROLE_RANK[DEFAULT_MIN_ROLE]) {
      throw new ForbiddenException("Ruxsat yo'q");
    }
    return true;
  }
}
