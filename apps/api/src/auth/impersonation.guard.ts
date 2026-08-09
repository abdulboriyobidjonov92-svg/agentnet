import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ImpersonationService } from './impersonation.service';
import {
  IMPERSONATION_SAFE_METHODS,
  isForbiddenImpersonationRead,
} from './impersonation.policy';
import type { ImpersonationContext } from './impersonation.types';

/**
 * SEC-12 §8 — impersonation sessiyasidagi TAQIQLAR (guard darajasida).
 *
 * Global `APP_GUARD`, `AuthGuard`+`RolesGuard` dan KEYIN ro'yxatdan o'tadi
 * (guardlar ro'yxatga qo'yilgan tartibda ishlaydi) — ya'ni bu yerga faqat
 * autentifikatsiyadan o'tgan so'rov keladi va `request.impersonation` allaqachon
 * to'ldirilgan bo'ladi.
 *
 * IKKI QOIDA — ikkalasi ham RO'YXAT SAQLAMAYDI (§8: "Do not rely on a
 * manually maintained frontend list"):
 *
 *   1. XAVFSIZ BO'LMAGAN HTTP METODI RAD ETILADI. `GET/HEAD/OPTIONS` dan
 *      boshqa hamma narsa 403. Bu bitta qoida §8 dagi butun ro'yxatni
 *      qoplaydi — parol/2FA, email/telefon, rol tayinlash, sessiya bekor
 *      qilish, API kalitlari, konnektor sirlari, to'lov/payout, obuna,
 *      xavfli amallar, hisobni o'chirish, qurilma buyruqlari — chunki
 *      ularning HAMMASI POST/PATCH/PUT/DELETE. Yangi yozish endpointi
 *      qo'shilganda u AVTOMATIK qamraladi.
 *
 *   2. MAXFIY O'QISH YO'LLARI RAD ETILADI (`impersonation.policy.ts`
 *      prefikslari): qurilma boshqaruvi va qo'ng'iroq yozuvlari, GDPR
 *      eksport, 2FA sozlash yuzasi. §6.6 ularni "hatto OWNER uchun ham"
 *      taqiqlaydi.
 *
 * Har rad etish AUDITLANADI (§13 "bloklangan urinishlar"): guard
 * interceptor'dan OLDIN ishlaydi, shuning uchun rad etilgan so'rovni
 * interceptor ko'rmaydi — yozuvni shu yerda qoldiramiz.
 */
@Injectable()
export class ImpersonationGuard implements CanActivate {
  constructor(private readonly impersonation: ImpersonationService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const ctx = request?.impersonation as ImpersonationContext | undefined;

    // Impersonation emas — bu guard umuman aralashmaydi.
    if (!ctx) return true;

    const method = String(request.method ?? '').toUpperCase();
    const route = this.routeOf(request);

    if (!IMPERSONATION_SAFE_METHODS.includes(method)) {
      await this.deny(ctx, method, route, 'impersonation_read_only');
      throw new ForbiddenException({
        message:
          "Impersonation FAQAT O'QISH rejimida — bu amal foydalanuvchi nomidan bajarilmaydi",
        reason: 'impersonation_read_only',
        impersonationId: ctx.impersonationId,
      });
    }

    if (isForbiddenImpersonationRead(route)) {
      await this.deny(ctx, method, route, 'impersonation_forbidden_resource');
      throw new ForbiddenException({
        message: 'Bu maʼlumot impersonation sessiyasida ochilmaydi',
        reason: 'impersonation_forbidden_resource',
        impersonationId: ctx.impersonationId,
      });
    }

    return true;
  }

  private async deny(
    ctx: ImpersonationContext,
    method: string,
    route: string,
    denyReason: string,
  ): Promise<void> {
    await this.impersonation.recordRequest({
      context: ctx,
      method,
      route,
      outcome: 'denied',
      statusCode: 403,
      denyReason,
    });
  }

  /**
   * So'rov yo'li — global `/api/` prefiksisiz, so'rov satrisiz.
   * Siyosat prefikslari (`device`, `users/me/export`, ...) shu shaklda.
   */
  private routeOf(request: { originalUrl?: string; url?: string }): string {
    const raw = request.originalUrl ?? request.url ?? '';
    const withoutQuery = raw.split('?')[0];
    return withoutQuery.replace(/^\/+/, '').replace(/^api\//, '');
  }
}
