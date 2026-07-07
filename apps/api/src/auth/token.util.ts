/**
 * Imzolangan sessiya-token (HS256 JWT) — tashqi bog'liqliksiz, Node `crypto` bilan.
 *
 * Nega: avval frontend `Authorization: Bearer <userId>` yuborardi — ya'ni
 * har kim boshqa foydalanuvchining id'sini qo'yib, uning hisobiga kira olardi
 * (imzo yo'q edi). Endi token server tomonda maxfiy kalit bilan imzolanadi va
 * guard imzoni tekshiradi — soxta token rad etiladi.
 *
 * Prod uchun AUTH_JWT_SECRET .env orqali berilishi SHART. Berilmasa — jarayon
 * har ishga tushganda tasodifiy kalit yaratadi (restartda barcha tokenlar bekor
 * bo'ladi), bu prod'da soxta "stabil default"dan ko'ra xavfsizroq: kalit hech
 * qachon kodga tushib qolmaydi.
 */

import * as crypto from 'crypto';

export interface TokenPayload {
  sub: string; // foydalanuvchi id
  email?: string;
  iat: number; // beriltan vaqt (unix soniya)
  exp: number; // amal qilish muddati (unix soniya)
}

const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 kun

function secret(): string {
  const s = process.env.AUTH_JWT_SECRET;
  if (s && s.length >= 16) return s;

  const g = globalThis as unknown as { __agentnetJwtFallback?: string };
  if (!g.__agentnetJwtFallback) {
    g.__agentnetJwtFallback = crypto.randomBytes(48).toString('hex');
    // eslint-disable-next-line no-console
    console.warn(
      "[auth] AUTH_JWT_SECRET o'rnatilmagan — vaqtinchalik tasodifiy kalit ishlatilmoqda " +
        "(restartda barcha tokenlar bekor bo'ladi). Prod uchun .env ga AUTH_JWT_SECRET qo'ying.",
    );
  }
  return g.__agentnetJwtFallback;
}

/** Foydalanuvchi uchun imzolangan token beradi. */
export function signToken(
  claims: { sub: string; email?: string },
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload: TokenPayload = { ...claims, iat: now, exp: now + ttlSeconds };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const data = `${header}.${body}`;
  const sig = crypto.createHmac('sha256', secret()).update(data).digest('base64url');
  return `${data}.${sig}`;
}

/** Token imzosi va muddatini tekshiradi. Yaroqsiz bo'lsa null. */
export function verifyToken(token: string | undefined | null): TokenPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;

  const expected = crypto
    .createHmac('sha256', secret())
    .update(`${header}.${body}`)
    .digest('base64url');

  // Doimiy-vaqtli taqqoslash (timing hujumidan himoya)
  const got = Buffer.from(sig);
  const exp = Buffer.from(expected);
  if (got.length !== exp.length || !crypto.timingSafeEqual(got, exp)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8')) as TokenPayload;
    if (!payload.sub) return null;
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
