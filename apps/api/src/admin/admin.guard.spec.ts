import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';

const ctxWith = (dbUser: any): ExecutionContext =>
  ({ switchToHttp: () => ({ getRequest: () => ({ dbUser }) }) }) as any;

describe('AdminGuard (super-admin panel himoyasi)', () => {
  const guard = new AdminGuard();

  it('dbUser yo\'q -> rad etiladi', () => {
    expect(() => guard.canActivate(ctxWith(undefined))).toThrow(ForbiddenException);
  });

  it('MEMBER roli -> rad etiladi', () => {
    expect(() => guard.canActivate(ctxWith({ role: 'MEMBER' }))).toThrow(ForbiddenException);
  });

  it('ADMIN roli (org-darajasida) -> rad etiladi, OWNER emas', () => {
    expect(() => guard.canActivate(ctxWith({ role: 'ADMIN' }))).toThrow(ForbiddenException);
  });

  it('OWNER roli -> ruxsat', () => {
    expect(guard.canActivate(ctxWith({ role: 'OWNER' }))).toBe(true);
  });
});
