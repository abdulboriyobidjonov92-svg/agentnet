import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from './roles.decorator';
import { ROLE_RANK } from './role-rank';
import type { ImpersonationContext } from './impersonation.types';

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
 * `AuthGuard` o'rnatadi. Uni umuman ishlatmaydigan yo'llar ataylab shunday:
 *   - ochiq endpointlar (`/api/health`, `auth/dev-login`, `auth/otp/*`),
 *   - `InternalTokenGuard` bilan himoyalangan servis-ichi yo'llar,
 *   - Payme/Click to'lov webhooklari (`webhooks.controller.ts`).
 * Agar bu yerda `false`/403 qaytarilsa, global guard sifatida u SHU
 * YO'LLARNING HAMMASINI darhol buzardi — jumladan pul webhooklarini.
 * Ya'ni bu "fail-open" emas: bu yo'llar o'z guard'lariga ega yoki ataylab
 * ochiq; RolesGuard ularning avtorizatsiya modeli emas.
 */

/** Dekoratorsiz endpoint uchun minimal daraja (AC #4). */
const DEFAULT_MIN_ROLE: UserRole = 'MEMBER';

/**
 * SEC-11 — Konstitutsiya qoidasi #10: "OWNER/ADMIN roli 2FA'siz berilmaydi."
 *
 * Bu ro'yxat ATAYLAB faqat OWNER va ADMIN: Contract shu ikkitasini nomma-nom
 * aytadi. SUPPORT (impersonation huquqi bilan) SEC-12'da alohida ko'riladi —
 * bu yerga "ehtiyot uchun" qo'shish Contract matnidan oshib ketish bo'lardi.
 */
const ELEVATED_ROLES: readonly UserRole[] = ['OWNER', 'ADMIN'];

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request?.dbUser as { role?: UserRole; twoFactorEnabled?: boolean } | undefined;

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
      // SEC-12 §10 — IMTIYOZ YO'LI IMPERSONATION UCHUN BUTUNLAY YOPIQ.
      //
      // Bu tekshiruv `required.includes(role)` dan OLDIN turadi va ataylab
      // nishonning ROLIGA UMUMAN QARAMAYDI. Sababi "confused deputy":
      // impersonation paytida `dbUser` — KO'RILAYOTGAN foydalanuvchi, ya'ni
      // nishon ADMIN bo'lsa, oddiy rol tekshiruvi uni O'TKAZIB YUBORARDI va
      // SUPPORT operatori ADMIN endpointiga kirib olardi. Rol solishtiruvi
      // shu yerda hech qachon impersonation kontekstida bajarilmaydi.
      //
      // Amaliy natija: `@Roles(...)` bilan himoyalangan HAR BIR yo'l
      // (butun `admin/*` yuzasi, jumladan SEC-11 xavfli amallari)
      // impersonation sessiyasidan 403 oladi — ro'yxat saqlanmaydi.
      if (request?.impersonation) {
        const ctx = request.impersonation as ImpersonationContext;
        throw new ForbiddenException({
          message: "Impersonation sessiyasida imtiyozli yo'llar ochilmaydi",
          reason: 'impersonation_privileged_route',
          impersonationId: ctx.impersonationId,
        });
      }

      if (!required.includes(role)) {
        throw new ForbiddenException("Ruxsat yo'q");
      }

      // SEC-11 (Konstitutsiya #10): imtiyozli rol 2FA'siz KUCHGA KIRMAYDI.
      //
      // NEGA aynan shu yerda: tekshiruv faqat `@Roles(...)` bilan himoyalangan
      // (ya'ni imtiyoz TALAB QILADIGAN) yo'llarda ishlaydi. 2FA'siz OWNER
      // platformadan oddiy foydalanuvchi sifatida foydalanaveradi va
      // `/auth/2fa/*` orqali 2FA'ni yoqib, imtiyozini qaytara oladi —
      // ya'ni bu qoida hech kimni tizimdan QULFLAB QO'YMAYDI, faqat
      // imtiyozni 2FA ortiga oladi (bootstrap uchun zaxira yo'l shart emas).
      //
      // NEGA MUHIM: login OTP (email/SMS kod) — fishing va SIM-swap'ga
      // ochiq kanal. Usiz OWNER hisobini egallash butun platformani
      // egallash demak. 2FA — shu yo'ldagi yagona qo'shimcha to'siq.
      if (ELEVATED_ROLES.includes(role) && !user.twoFactorEnabled) {
        throw new ForbiddenException({
          message:
            "Imtiyozli rol uchun ikki bosqichli tasdiqlash (2FA) yoqilgan bo'lishi shart. " +
            "Sozlamalar → Xavfsizlik bo'limidan 2FA'ni yoqing.",
          reason: 'two_factor_required',
        });
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
