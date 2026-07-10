import * as crypto from 'crypto';
import { signToken, verifyToken } from './token.util';

/**
 * Imzolangan sessiya-token (HS256 JWT, Node `crypto` bilan) — avvalgi
 * zaiflik: token shunchaki `userId` edi, imzosiz. Bu testlar tasdiqlaydi:
 * imzo tekshiriladi, soxta/o'zgartirilgan payload rad etiladi, muddati
 * o'tgan token qabul qilinmaydi.
 */

describe('token.util', () => {
  beforeAll(() => {
    process.env.AUTH_JWT_SECRET = 'a'.repeat(32);
  });

  it('signToken/verifyToken round-trip — claims saqlanadi', () => {
    const token = signToken({ sub: 'u1', email: 'a@b.com' });
    const payload = verifyToken(token);

    expect(payload?.sub).toBe('u1');
    expect(payload?.email).toBe('a@b.com');
    expect(payload?.exp).toBeGreaterThan(payload!.iat);
  });

  it('imzo mos kelmasa -> null', () => {
    const token = signToken({ sub: 'u1' });
    const [header, body] = token.split('.');
    expect(verifyToken(`${header}.${body}.deadbeefdeadbeef`)).toBeNull();
  });

  it('payload o\'zgartirilib, eski imzo qoldirilsa -> null (soxtalashtirish rad etiladi)', () => {
    const token = signToken({ sub: 'u1' });
    const [header, , sig] = token.split('.');
    const fakeBody = Buffer.from(
      JSON.stringify({ sub: 'attacker', iat: 0, exp: 9_999_999_999 }),
    ).toString('base64url');

    expect(verifyToken(`${header}.${fakeBody}.${sig}`)).toBeNull();
  });

  it('muddati o\'tgan token -> null', () => {
    const token = signToken({ sub: 'u1' }, -10);
    expect(verifyToken(token)).toBeNull();
  });

  it('bo\'sh yoki noto\'g\'ri formatdagi token -> null', () => {
    expect(verifyToken(undefined)).toBeNull();
    expect(verifyToken(null)).toBeNull();
    expect(verifyToken('')).toBeNull();
    expect(verifyToken('only-one-part')).toBeNull();
    expect(verifyToken('a.b.c.d')).toBeNull();
  });

  it('"sub" bo\'lmagan payload -> null', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({ iat: 0, exp: 9_999_999_999 })).toString('base64url');
    const sig = crypto
      .createHmac('sha256', process.env.AUTH_JWT_SECRET!)
      .update(`${header}.${body}`)
      .digest('base64url');

    expect(verifyToken(`${header}.${body}.${sig}`)).toBeNull();
  });

  it('boshqa maxfiy kalit bilan imzolangan token -> null', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(
      JSON.stringify({ sub: 'u1', iat: 0, exp: 9_999_999_999 }),
    ).toString('base64url');
    const sig = crypto.createHmac('sha256', 'boshqa-maxfiy-kalit').update(`${header}.${body}`).digest('base64url');

    expect(verifyToken(`${header}.${body}.${sig}`)).toBeNull();
  });

  it('ttl parametri amal qilish muddatini belgilaydi', () => {
    const token = signToken({ sub: 'u1' }, 100);
    const payload = verifyToken(token)!;
    expect(payload.exp - payload.iat).toBe(100);
  });
});
