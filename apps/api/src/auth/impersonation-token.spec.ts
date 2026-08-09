import * as crypto from 'crypto';
import {
  IMPERSONATION_MAX_TTL_SECONDS,
  IMPERSONATION_READ_ONLY,
  IMPERSONATION_TYP,
  signToken,
  verifyToken,
} from './token.util';

/**
 * SEC-12 — impersonation TOKENI (§5, §6, §26 "Token" bloki).
 *
 * Bu testlar tokenning O'ZI beradigan kafolatlarni qulflaydi — DB holati
 * emas: shakl, 30 daqiqa chegarasi va "oddiy token impersonation deb
 * qabul qilinmaydi" qoidasi.
 */

beforeAll(() => {
  process.env.AUTH_JWT_SECRET = 'i'.repeat(32);
});

const impClaims = {
  sub: 'target1',
  tv: 0,
  typ: IMPERSONATION_TYP,
  act: 'admin1',
  imp: 'imp1',
  mode: IMPERSONATION_READ_ONLY,
};

/** Imzo TO'G'RI, lekin da'volar boshqacha bo'lgan token yasaydi. */
function signRaw(payload: Record<string, unknown>): string {
  // `signToken` da'volarni tiplaydi; bu yerda ataylab xom payload kerak.
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const data = `${header}.${body}`;
  const sig = crypto
    .createHmac('sha256', process.env.AUTH_JWT_SECRET as string)
    .update(data)
    .digest('base64url');
  return `${data}.${sig}`;
}

describe('SEC-12 — impersonation tokeni', () => {
  it('yaroqli impersonation tokeni barcha da\'volari bilan qaytadi', () => {
    const token = signToken(impClaims, 600);
    const payload = verifyToken(token);

    expect(payload).not.toBeNull();
    expect(payload!.typ).toBe(IMPERSONATION_TYP);
    expect(payload!.sub).toBe('target1'); // KO'RILAYOTGAN foydalanuvchi
    expect(payload!.act).toBe('admin1'); // HAQIQIY aktor
    expect(payload!.imp).toBe('imp1');
    expect(payload!.mode).toBe(IMPERSONATION_READ_ONLY);
  });

  it('ODDIY token impersonation EMAS — `typ`/`act`/`imp` bo\'sh', () => {
    const payload = verifyToken(signToken({ sub: 'u1', tv: 0 }));
    expect(payload!.typ).toBeUndefined();
    expect(payload!.act).toBeUndefined();
    expect(payload!.imp).toBeUndefined();
  });

  it('§6 — 30 daqiqadan UZUN impersonation tokeni RAD etiladi (imzo to\'g\'ri bo\'lsa ham)', () => {
    const now = Math.floor(Date.now() / 1000);
    const token = signRaw({
      ...impClaims,
      iat: now,
      exp: now + IMPERSONATION_MAX_TTL_SECONDS + 60,
    });
    expect(verifyToken(token)).toBeNull();
  });

  it('§6 — aynan 30 daqiqa QABUL qilinadi (chegara inklyuziv)', () => {
    const now = Math.floor(Date.now() / 1000);
    const token = signRaw({ ...impClaims, iat: now, exp: now + IMPERSONATION_MAX_TTL_SECONDS });
    expect(verifyToken(token)).not.toBeNull();
  });

  it('ARALASH token (`act` bor, `typ` yo\'q) RAD etiladi — jim imtiyoz yo\'q', () => {
    const now = Math.floor(Date.now() / 1000);
    const token = signRaw({ sub: 'target1', tv: 0, act: 'admin1', iat: now, exp: now + 600 });
    expect(verifyToken(token)).toBeNull();
  });

  it('to\'liqsiz impersonation tokeni (`imp` yo\'q) RAD etiladi', () => {
    const now = Math.floor(Date.now() / 1000);
    const token = signRaw({
      sub: 'target1',
      tv: 0,
      typ: IMPERSONATION_TYP,
      act: 'admin1',
      mode: IMPERSONATION_READ_ONLY,
      iat: now,
      exp: now + 600,
    });
    expect(verifyToken(token)).toBeNull();
  });

  it('noma\'lum rejim (READ_WRITE) RAD etiladi — SEC-12 da yozish rejimi YO\'Q', () => {
    const now = Math.floor(Date.now() / 1000);
    const token = signRaw({
      ...impClaims,
      mode: 'READ_WRITE',
      iat: now,
      exp: now + 600,
    });
    expect(verifyToken(token)).toBeNull();
  });

  it('aktor = nishon bo\'lgan token RAD etiladi (o\'z-o\'zini impersonation)', () => {
    const now = Math.floor(Date.now() / 1000);
    const token = signRaw({ ...impClaims, act: 'target1', iat: now, exp: now + 600 });
    expect(verifyToken(token)).toBeNull();
  });

  it('muddati o\'tgan impersonation tokeni RAD etiladi', () => {
    const token = signToken(impClaims, -10);
    expect(verifyToken(token)).toBeNull();
  });

  it('buzilgan imzo RAD etiladi (da\'volar to\'g\'ri bo\'lsa ham)', () => {
    const token = signToken(impClaims, 600);
    const tampered = `${token.slice(0, -3)}aaa`;
    expect(verifyToken(tampered)).toBeNull();
  });

  it('boshqa kalit bilan imzolangan token RAD etiladi', () => {
    const original = process.env.AUTH_JWT_SECRET;
    process.env.AUTH_JWT_SECRET = 'z'.repeat(32);
    const foreign = signToken(impClaims, 600);
    process.env.AUTH_JWT_SECRET = original;

    expect(verifyToken(foreign)).toBeNull();
  });
});
