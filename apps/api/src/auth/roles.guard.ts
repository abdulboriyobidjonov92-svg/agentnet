import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedUser, Role } from './auth-types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly allowedRoles: Role[]) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;
    if (!user) throw new UnauthorizedException();
    if (!this.allowedRoles.includes(user.role)) {
      throw new ForbiddenException(`Ruxsat yo'q: ${this.allowedRoles.join(',')} talab qilinadi`);
    }
    return true;
  }
}
