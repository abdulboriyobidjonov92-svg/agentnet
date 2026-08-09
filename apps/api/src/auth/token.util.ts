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
  // SEC-03: token-versiya. AuthGuard buni User.tokenVersion bilan solishtiradi
  // — mos kelmasa 401. Ixtiyoriy: shu maydonsiz signToken() chaqiruvchilar
  // (masalan telegram.service.ts'dagi qisqa-muddatli link-kod, AuthGuard'dan
  // o'tmaydi) o'zgarishsiz ishlayveradi. Bu maydon YO'Q token — istalgan
  // haqiqiy foydalanuvchi uchun `undefined !== 0` bo'lgani uchun AuthGuard
  // uni avtomatik rad etadi (deploy'dan oldingi barcha eski tokenlar shunday).
  tv?: number;

  // ----------------------------------------------------------------
  // SEC-12 §6.6 — impersonation da'volari.
  //
  // IKKINCHI IMZO-KALITI YO'Q va ikkinchi auth stack YO'Q: bu aynan shu
  // HS256 mexanizmi, faqat da'volari boshqa. Farqni `typ` BIR MA'NODA
  // beradi — `sub` ning "kim" ekanini talqin qilish shunga bog'liq:
  //   typ yo'q          -> oddiy sessiya, sub = haqiqiy foydalanuvchi
  //   typ=impersonation -> sub = KO'RILAYOTGAN foydalanuvchi,
  //                        act = HAQIQIY operator (avtorizatsiya egasi)
  // ----------------------------------------------------------------
  /** `'impersonation'` bo'lsa — bu oddiy sessiya EMAS. */
  typ?: typeof IMPERSONATION_TYP;
  /** Haqiqiy aktor (admin/support) id'si — `sub` EMAS. */
  act?: string;
  /** `ImpersonationSession.id` — server tomonidagi holatga havola. */
  imp?: string;
  /** Rejim. SEC-12 da yagona qiymat — o'qish. */
  mode?: typeof IMPERSONATION_READ_ONLY;

  iat: number; // beriltan vaqt (unix soniya)
  exp: number; // amal qilish muddati (unix soniya)
}

/** `TokenPayload.typ` ning impersonation qiymati. */
export const IMPERSONATION_TYP = 'impersonation' as const;
/** `TokenPayload.mode` — SEC-12 da yagona rejim (§6.6 "default read-only"). */
export const IMPERSONATION_READ_ONLY = 'READ_ONLY' as const;

/**
 * §6.6 — impersonation tokenining MUTLAQ yuqori chegarasi (30 daqiqa).
 *
 * Bu qiymat `verifyToken()` da ham majburlanadi, ya'ni chegaradan uzun
 * impersonation tokeni TO'G'RI IMZO bilan ham rad etiladi. Nega: imzo-kaliti
 * bitta, shuning uchun kelajakdagi biror chaqiruv-nuqta xato TTL bersa
 * (yoki kalit sizib chiqsa) — 30 daqiqa baribir tekshiruv nuqtasida qoladi.
 */
export const IMPERSONATION_MAX_TTL_SECONDS = 30 * 60;

// SEC-03: 30 kun -> 7 kun (xavfsizlik ta'sir doirasini qisqartirish).
// Jimgina yangilash uchun POST /auth/session/refresh mavjud.
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 kun

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
  claims: {
    sub: string;
    email?: string;
    tv?: number;
    typ?: typeof IMPERSONATION_TYP;
    act?: string;
    imp?: string;
    mode?: typeof IMPERSONATION_READ_ONLY;
  },
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
    if (!impersonationClaimsWellFormed(payload)) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * SEC-12 — impersonation da'volarining SHAKL tekshiruvi (imzo to'g'ri
 * bo'lgandan KEYIN, DB'ga borishdan OLDIN).
 *
 * Uchta fail-closed qoida:
 *   1. `act`/`imp`/`mode` bor, lekin `typ` YO'Q — bu ARALASH token. Oddiy
 *      sessiya sifatida qabul qilinsa, `act` da'vosi jimgina e'tiborsiz
 *      qolardi; impersonation deb qabul qilinsa, `typ`siz token imtiyoz
 *      olardi. Ikkalasi ham xavfli, shuning uchun — RAD.
 *   2. `typ=impersonation`, lekin majburiy da'volar to'liq emas — RAD.
 *   3. `typ=impersonation`, lekin umri 30 daqiqadan uzun — RAD (§6.6
 *      chegarasi imzodan MUSTAQIL majburlanadi).
 * Aktor `sub` ga teng bo'lishi ham rad etiladi: o'z-o'zini impersonation
 * qilish audit izini ma'nosiz qiladi (§15(5)).
 */
function impersonationClaimsWellFormed(payload: TokenPayload): boolean {
  const hasImpersonationClaims =
    payload.act !== undefined || payload.imp !== undefined || payload.mode !== undefined;

  if (payload.typ === undefined) return !hasImpersonationClaims;
  if (payload.typ !== IMPERSONATION_TYP) return false;

  if (typeof payload.act !== 'string' || !payload.act) return false;
  if (typeof payload.imp !== 'string' || !payload.imp) return false;
  if (payload.mode !== IMPERSONATION_READ_ONLY) return false;
  if (payload.act === payload.sub) return false;

  if (typeof payload.iat !== 'number') return false;
  if (payload.exp - payload.iat > IMPERSONATION_MAX_TTL_SECONDS) return false;

  return true;
}
