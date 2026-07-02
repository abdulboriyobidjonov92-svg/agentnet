import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Lokal auth guard (Clerk'siz).
 * Frontend `Authorization: Bearer <userId>` yuboradi — bu userId SQLite'dagi
 * foydalanuvchi id'si. Guard shu foydalanuvchini topib, so'rovga biriktiradi.
 * Tashqi auth xizmatiga bog'liqlik yo'q — prototip uchun ishonchli.
 */
@Injectable()
export class ClerkGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = this.extractToken(request);
    if (!userId) throw new UnauthorizedException('Token talab qilinadi');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Foydalanuvchi topilmadi');

    request.dbUser = user;
    return true;
  }

  private extractToken(request: any): string | null {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : null;
  }
}
