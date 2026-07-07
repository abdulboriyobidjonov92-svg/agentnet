import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { InternalTokenGuard } from './internal-token.guard';

const ctxWith = (headers: Record<string, any>): ExecutionContext =>
  ({ switchToHttp: () => ({ getRequest: () => ({ headers }) }) }) as any;

describe('InternalTokenGuard (server-to-server /billing/refund himoyasi)', () => {
  const guard = new InternalTokenGuard();
  const origEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it('DEV: x-internal-token yo\'q -> rad etiladi', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.INTERNAL_API_TOKEN;
    expect(() => guard.canActivate(ctxWith({}))).toThrow(UnauthorizedException);
  });

  it('DEV: noto\'g\'ri token -> rad etiladi', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.INTERNAL_API_TOKEN; // default 'agentnet-internal-dev'
    expect(() =>
      guard.canActivate(ctxWith({ 'x-internal-token': 'wrong-token' })),
    ).toThrow(UnauthorizedException);
  });

  it('DEV: default token bilan mos -> ruxsat', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.INTERNAL_API_TOKEN;
    expect(guard.canActivate(ctxWith({ 'x-internal-token': 'agentnet-internal-dev' }))).toBe(true);
  });

  it('PROD: ommaviy default kalit -> fail-closed (rad etiladi)', () => {
    process.env.NODE_ENV = 'production';
    process.env.INTERNAL_API_TOKEN = 'agentnet-internal-dev';
    expect(() =>
      guard.canActivate(ctxWith({ 'x-internal-token': 'agentnet-internal-dev' })),
    ).toThrow(/production/i);
  });

  it('PROD: INTERNAL_API_TOKEN yo\'q -> fail-closed', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.INTERNAL_API_TOKEN;
    expect(() =>
      guard.canActivate(ctxWith({ 'x-internal-token': 'anything' })),
    ).toThrow(/production/i);
  });

  it('PROD: kuchli kalit + mos header -> ruxsat', () => {
    process.env.NODE_ENV = 'production';
    process.env.INTERNAL_API_TOKEN = 'a-strong-random-secret-64hex-etc';
    expect(
      guard.canActivate(ctxWith({ 'x-internal-token': 'a-strong-random-secret-64hex-etc' })),
    ).toBe(true);
  });

  it('PROD: kuchli kalit + noto\'g\'ri header -> rad etiladi', () => {
    process.env.NODE_ENV = 'production';
    process.env.INTERNAL_API_TOKEN = 'a-strong-random-secret-64hex-etc';
    expect(() =>
      guard.canActivate(ctxWith({ 'x-internal-token': 'a-strong-random-secret-64hex-XXX' })),
    ).toThrow(UnauthorizedException);
  });
});
