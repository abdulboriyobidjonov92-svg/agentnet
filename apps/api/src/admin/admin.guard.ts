import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

/**
 * Super-admin panel guard. ClerkGuard'dan KEYIN ishlaydi (request.dbUser talab
 * qiladi). "Super foydalanuvchi" — User.role === "OWNER" (feedback moduli
 * bilan bir xil konvensiya: platformada alohida SUPER_ADMIN roli yo'q,
 * OWNER shu vazifani bajaradi).
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.dbUser;
    if (!user || user.role !== 'OWNER') {
      throw new ForbiddenException('Faqat super-admin uchun');
    }
    return true;
  }
}
