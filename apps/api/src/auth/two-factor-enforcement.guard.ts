import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedUser } from './auth-types';

@Injectable()
export class TwoFactorEnforcementGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;

    if (!user) throw new UnauthorizedException('Autentifikatsiya talab qilinadi');

    if (user.isBusinessAccount && !user.twoFactorEnabled) {
      throw new ForbiddenException(
        'Biznes hisob uchun 2FA yoqilishi shart. /api/auth/2fa/setup ga murojaat qiling.',
      );
    }

    return true;
  }
}
