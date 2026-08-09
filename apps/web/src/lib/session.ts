// Lokal sessiya (tashqi provayder ishlatilmaydi) — IKKI cookie:
//
//   1. agentnet_token (httpOnly) — imzolangan JWT. FAQAT server o'rnatadi
//      (/api/session route). JS'dan o'qib bo'lmaydi — XSS token'ni o'g'irlay
//      olmaydi. API chaqiruvlariga middleware proxy (/api/backend/*) uni
//      Authorization header sifatida qo'shadi.
//   2. agentnet_user — TOKENSIZ profil (userId, email, name) — UI ko'rsatishi
//      uchun JS-o'qiladigan. Auth-qaror hech qachon bunga tayanmaydi.
//
// Ilgari token JS-ochiq cookie'da edi — har qanday XSS 30 kunlik to'liq
// hisob-kirishini o'g'irlashi mumkin edi. Endi bu yopilgan.

export interface Session {
  userId: string;
  email: string;
  phone?: string;
  name?: string;
  // Legacy: eski sessiyalarda token profil-cookie ichida edi. Yangi login'da
  // BU MAYDON PROFIL-COOKIE'GA YOZILMAYDI (faqat httpOnly cookie'da).
  token?: string;
}

const COOKIE = "agentnet_user";
const TOKEN = "agentnet_token";

export function encodeSession(s: Session): string {
  return typeof window === "undefined"
    ? Buffer.from(JSON.stringify(s)).toString("base64")
    : btoa(unescape(encodeURIComponent(JSON.stringify(s))));
}

export function decodeSession(raw: string | undefined | null): Session | null {
  if (!raw) return null;
  try {
    const json =
      typeof window === "undefined"
        ? Buffer.from(raw, "base64").toString("utf-8")
        : decodeURIComponent(escape(atob(raw)));
    const s = JSON.parse(json);
    return s?.userId ? s : null;
  } catch {
    return null;
  }
}

/**
 * JWT payload'ini IMZONI TEKSHIRMASDAN o'qiydi (server tomonda, faqat BFF
 * uchun). BFF'da AUTH_JWT_SECRET yo'q — imzo baribir NestJS API'da tekshiriladi
 * (charge-message birinchi chaqiruv, fail-closed). Bu helper faqat token
 * ichidagi `sub`ni olish uchun: engine'ga yuboriladigan user_id endi soxtalab
 * bo'ladigan profil-cookie'dan EMAS, token ichidan olinadi.
 */
export function tokenPayload(
  token: string | undefined | null,
): { sub?: string; email?: string; exp?: number } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
    return typeof payload?.sub === "string" && payload.sub ? payload : null;
  } catch {
    return null;
  }
}

// ---- Client tomonda ----

export function getClientSession(): Session | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${COOKIE}=`));
  if (!match) return null;
  // Qiymat birinchi "="dan keyin TO'LIQ olinadi (base64 padding "="ni
  // split kesib yubormasligi uchun). Server (Next res.cookies.set) qiymatni
  // URL-encode qiladi (%3D, %2B...) — avval decode, legacy xom-base64
  // cookie'lar uchun esa decode yiqilsa xomligicha ishlatiladi.
  const raw = match.slice(COOKIE.length + 1);
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    /* legacy xom qiymat */
  }
  return decodeSession(decoded);
}

/** Profil-cookie'ni yangilaydi. Token HECH QACHON bu cookie'ga yozilmaydi. */
export function setClientSession(s: Session): void {
  const { token: _omit, ...profile } = s;
  const val = encodeURIComponent(encodeSession(profile as Session));
  document.cookie = `${COOKIE}=${val}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
}

/** Faqat profil-cookie'ni tozalaydi — httpOnly token cookie'sini server
 *  (DELETE /api/session) tozalaydi; logout ikkalasini ham chaqirishi kerak. */
export function clearClientSession(): void {
  document.cookie = `${COOKIE}=; path=/; max-age=0`;
}

export const SESSION_COOKIE = COOKIE;
export const TOKEN_COOKIE = TOKEN;

// ---- SEC-12: impersonation cookie'lari ----
//
// IKKI COOKIE, sessiya cookie'lari bilan AYNAN bir xil naqshda:
//   1. agentnet_imp (httpOnly) — impersonation JWT. Middleware uni
//      Authorization sifatida qo'yadi; brauzer JS ko'rmaydi.
//   2. agentnet_imp_meta — TOKENSIZ metadata (nishon emaili, tugash vaqti,
//      sessiya id'si) — faqat BANNER ko'rsatishi uchun.
//
// MUHIM: haqiqiy operator tokeni (agentnet_token) O'CHIRILMAYDI. Shu
// tufayli "to'xtatish" — imp cookie'sini o'chirish + serverga aniq
// to'xtatish so'rovi; operator qaytadan login qilmaydi (§17).
//
// META COOKIE'GA ISHONILMAYDI: u faqat matn ko'rsatadi. Rejim, muddat va
// taqiqlar serverda majburlanadi — meta'ni o'zgartirish hech qanday
// imtiyoz bermaydi (banner noto'g'ri vaqt ko'rsatadi, xolos).
export const IMPERSONATION_TOKEN_COOKIE = "agentnet_imp";
export const IMPERSONATION_META_COOKIE = "agentnet_imp_meta";

export interface ImpersonationMeta {
  impersonationId: string;
  targetEmail: string;
  targetName?: string | null;
  /** ISO 8601 — banner shundan sanoqni hisoblaydi. */
  expiresAt: string;
  mode: "READ_ONLY";
}

export function encodeImpersonationMeta(m: ImpersonationMeta): string {
  return typeof window === "undefined"
    ? Buffer.from(JSON.stringify(m)).toString("base64")
    : btoa(unescape(encodeURIComponent(JSON.stringify(m))));
}

export function decodeImpersonationMeta(
  raw: string | undefined | null,
): ImpersonationMeta | null {
  if (!raw) return null;
  try {
    const json =
      typeof window === "undefined"
        ? Buffer.from(raw, "base64").toString("utf-8")
        : decodeURIComponent(escape(atob(raw)));
    const m = JSON.parse(json);
    return m?.impersonationId && m?.expiresAt ? m : null;
  } catch {
    return null;
  }
}
