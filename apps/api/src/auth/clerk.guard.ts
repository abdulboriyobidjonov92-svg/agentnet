import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { verifyToken } from './token.util';

/**
 * Lokal auth guard (Clerk'siz).
 * Frontend `Authorization: Bearer <token>` yuboradi — bu token server tomonda
 * imzolangan JWT (login paytida beriladi). Guard imzoni tekshiradi, ichidan
 * foydalanuvchi id'sini (sub) oladi va shu foydalanuvchini so'rovga biriktiradi.
 *
 * MUHIM: token endi shunchaki userId EMAS — imzosiz userId qabul qilinmaydi.
 * Shu tufayli boshqa foydalanuvchining id'sini qo'yib uning hisobiga kirib
 * bo'lmaydi (avvalgi zaiflik shu yerda hal qilingan).
 */
@Injectable()
export class ClerkGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException('Token talab qilinadi');

    const payload = verifyToken(token);
    if (!payload) throw new UnauthorizedException("Token yaroqsiz yoki muddati o'tgan");

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

    request.dbUser = user;
    return true;
  }

  private extractToken(request: any): string | null {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : null;
  }
}
