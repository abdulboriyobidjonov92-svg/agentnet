import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { verifyToken, IMPERSONATION_TYP, type TokenPayload } from './token.util';
import { IS_PUBLIC_KEY } from './public.decorator';
import { ImpersonationService } from './impersonation.service';

/**
 * Lokal auth guard — o'z HS256 JWT'imizga asoslangan (tashqi provayder yo'q).
 * Frontend `Authorization: Bearer <token>` yuboradi — bu token server tomonda
 * imzolangan JWT (login paytida beriladi). Guard imzoni tekshiradi, ichidan
 * foydalanuvchi id'sini (sub) oladi va shu foydalanuvchini so'rovga biriktiradi.
 *
 * MUHIM: token endi shunchaki userId EMAS — imzosiz userId qabul qilinmaydi.
 * Shu tufayli boshqa foydalanuvchining id'sini qo'yib uning hisobiga kirib
 * bo'lmaydi (avvalgi zaiflik shu yerda hal qilingan).
 *
 * SEC-05 (Option B): bu hali ham har CONTROLLER'da alohida qo'llaniladi —
 * `@Public()` tekshiruvi hozircha NO-OP (chunki hali global emas). Keyingi
 * commit'da `APP_GUARD` sifatida ro'yxatdan o'tkaziladi; shu paytgacha
 * `@Public()` bilan belgilangan endpointlar mavjud xulqidan farq qilmaydi.
 *
 * SEC-12: token IKKI xil bo'lishi mumkin — oddiy sessiya va impersonation
 * (`typ=impersonation`). Ikkinchisida `request.dbUser` NISHON bo'ladi, lekin
 * `request.impersonation` orqali HAQIQIY operator ham kontekstda qoladi
 * (avtorizatsiya qarorlari o'shanga tayanadi).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
    private readonly impersonation: ImpersonationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException('Token talab qilinadi');

    const payload = verifyToken(token);
    if (!payload) throw new UnauthorizedException("Token yaroqsiz yoki muddati o'tgan");

    const user =
      payload.typ === IMPERSONATION_TYP
        ? await this.resolveImpersonated(request, payload)
        : await this.resolveUser(payload);

    // SEC-12 §24 — BLOKLANGAN hisob himoyalangan yo'llarga kira olmaydi.
    //
    // Bu yerda (AuthGuard'da), rol tekshiruvidan OLDIN: blok — hisob
    // darajasidagi qaror, ya'ni u dekoratorsiz oddiy endpointlarga ham
    // tegishli. `@Public()` yo'llar (login-oldi oqim, webhooklar) yuqorida
    // allaqachon qaytgan — bloklangan foydalanuvchi tizimga qayta kira
    // olmasligi uchun login yo'lining O'ZI ham `auth.service` da
    // tekshiriladi.
    if (user.blockedAt) {
      throw new ForbiddenException({
        message: 'Hisobingiz bloklangan. Qo\'llab-quvvatlash xizmatiga murojaat qiling.',
        reason: 'account_blocked',
      });
    }

    request.dbUser = user;
    return true;
  }

  /** Oddiy sessiya — SEC-03 token-versiya solishtiruvi bilan. */
  private async resolveUser(payload: TokenPayload): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('Foydalanuvchi topilmadi');

    // SEC-03: token-versiya solishtiruvi. Deploy'dan oldin berilgan HAR QANDAY
    // token'da `tv` yo'q (undefined) — user.tokenVersion esa doim raqam
    // (default 0), shuning uchun bu tekshiruv ishga tushgan zahoti barcha eski
    // tokenlar bir martalik tarzda rad etiladi (ataylab — Engineering Contract
    // ADR-001). Keyinchalik 2FA yoqilganda tokenVersion oshadi va o'sha
    // foydalanuvchining eski tokenlari xuddi shunday rad etiladi.
    if (user.tokenVersion !== payload.tv) {
      throw new UnauthorizedException("Sessiya bekor qilingan — qaytadan kiring");
    }
    return user;
  }

  /**
   * SEC-12 — impersonation tokeni.
   *
   * NISHON `tokenVersion` tekshiruvi SHU YERDA HAM bajariladi (oddiy sessiya
   * bilan bir xil qoida): nishonning sessiyalari bekor qilinsa, uning nomidan
   * ochilgan impersonation ham darhol o'ladi.
   */
  private async resolveImpersonated(request: any, payload: TokenPayload): Promise<User> {
    const { context, target } = await this.impersonation.resolve(payload);

    if (target.tokenVersion !== payload.tv) {
      throw new UnauthorizedException("Sessiya bekor qilingan — impersonation to'xtatildi");
    }

    request.impersonation = context;
    return target;
  }

  private extractToken(request: any): string | null {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : null;
  }
}
