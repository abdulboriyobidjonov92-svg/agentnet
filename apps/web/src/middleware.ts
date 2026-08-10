import { NextRequest, NextResponse } from "next/server";
import { cspDirectives, generateNonce, serializeCsp } from "@/lib/security-headers";

// Lokal auth (tashqi provayder ishlatilmaydi). Dashboard yo'llari uchun sessiya cookie'sini tekshiradi.
// /agentos-demo — ochiq ko'rgazma sahifasi (Living Interface demo, shaxsiy ma'lumot yo'q)
const PUBLIC_PATHS = ["/", "/sign-in", "/sign-up", "/agentos-demo"];

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const TOKEN_COOKIE = "agentnet_token";
// SEC-12: impersonation tokeni (httpOnly). Mavjud bo'lsa API chaqiruvlariga
// AYNAN SHU qo'yiladi — operatorning o'z tokeni cookie'da qoladi, lekin
// so'rovlarga tushmaydi.
const IMPERSONATION_TOKEN_COOKIE = "agentnet_imp";
const PROXY_PREFIX = "/api/backend/";

// SEC-04: legacy profil-cookie fallback (legacyToken()) olib tashlandi — endi
// FAQAT httpOnly agentnet_token qabul qilinadi.
function resolveToken(request: NextRequest): string | null {
  return request.cookies.get(TOKEN_COOKIE)?.value ?? null;
}

/**
 * SEC-12 — API so'roviga qaysi token qo'yiladi.
 *
 * Impersonation tokeni USTUN: u bor ekan, BFF orqali ketadigan har bir
 * chaqiruv nishon nomidan (va server tomonda read-only cheklovi bilan)
 * boradi. Bu — UX qulayligi emas, IZOLYATSIYA: operator impersonation
 * paytida o'zining admin tokeni bilan hech narsa yubora olmaydi.
 *
 * Tokenning haqiqiyligi/muddati bu yerda TEKSHIRILMAYDI (BFF'da imzo
 * kaliti yo'q) — NestJS `AuthGuard` va `ImpersonationService` har so'rovda
 * tekshiradi (fail-closed o'zgarmagan).
 */
function resolveApiToken(request: NextRequest): string | null {
  return (
    request.cookies.get(IMPERSONATION_TOKEN_COOKIE)?.value ?? resolveToken(request)
  );
}

/**
 * Sessiya bormi? — endi asosiy belgi httpOnly token cookie'si. Middleware
 * imzoni tasdiqlay olmaydi (AUTH_JWT_SECRET faqat API'da) — bu faqat UX-gate:
 * cookie'siz foydalanuvchi darhol sign-in'ga yo'naltiriladi. Haqiqiy auth-qaror
 * har API chaqiruvida NestJS guard'da (imzo tekshiruvi bilan) qabul qilinadi.
 */
function hasSession(request: NextRequest): boolean {
  return !!resolveToken(request);
}

/**
 * SEC-13 — CSP sarlavhasining nomi.
 *
 * `CSP_REPORT_ONLY=1` bo'lsa `-Report-Only` variantiga o'tadi: Contract
 * SEC-13 DoD "report-only rejimdan boshlanadi, 2 hafta kuzatiladi, keyin
 * majburiy" deydi. Kod MAJBURLAB (enforce) yetkaziladi — lokal brauzer
 * tekshiruvida 0 buzilish tasdiqlangan — lekin operator prod'ga bosqichma-
 * bosqich chiqarmoqchi bo'lsa, bitta env bilan kuzatuv oynasini oladi.
 *
 * `report-uri`/`report-to` ATAYLAB YO'Q: hisobot endpointi — cheklanmagan,
 * hujumchi boshqaradigan payload oqimi. Contract uni Sentry'ga ulashni
 * talab qiladi, Sentry esa Phase 5 ishi (repoda hali yo'q). Ikkinchi
 * observability tizimi yaratilmaydi.
 */
function cspHeaderName(): string {
  return process.env.CSP_REPORT_ONLY === "1"
    ? "Content-Security-Policy-Report-Only"
    : "Content-Security-Policy";
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Same-origin API proxy: brauzer JS tokenni KO'RMAYDI (httpOnly cookie) —
  // middleware uni shu yerda Authorization header sifatida qo'shib, so'rovni
  // NestJS API'ga rewrite qiladi. api-client barcha chaqiruvlarni
  // /api/backend/* orqali yuboradi.
  if (pathname.startsWith(PROXY_PREFIX)) {
    const target = new URL(
      `${API_URL}/api/${pathname.slice(PROXY_PREFIX.length)}${request.nextUrl.search}`,
    );
    const headers = new Headers(request.headers);
    const token = resolveApiToken(request);
    if (token) headers.set("authorization", `Bearer ${token}`);
    return NextResponse.rewrite(target, { request: { headers } });
  }

  // SEC-12 §18/§20 — impersonation paytida ADMIN paneli ochilmaydi.
  //
  // Server tomonda bu allaqachon yopiq (`@Roles(...)` yo'llari impersonation
  // uchun 403), ya'ni bu yerdagi yo'naltirish XAVFSIZLIK CHORASI EMAS —
  // operator bo'sh, xatolarga to'la admin ekranini ko'rmasligi uchun.
  if (pathname.startsWith("/admin") && request.cookies.get(IMPERSONATION_TOKEN_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    // CSP bu yerda SHART EMAS: yo'naltirishda HTML tanasi yo'q, brauzer
    // esa `/dashboard` javobida to'liq siyosatni oladi.
    return NextResponse.redirect(url);
  }

  // SEC-13 — CSP nonce'i SHU YERDA, har javob uchun bir marta yaratiladi.
  //
  // MUHIM (Next.js shartnomasi): nonce Next'ga SO'ROV sarlavhasi orqali
  // yetkaziladi — Next `Content-Security-Policy` so'rov sarlavhasidan
  // nonce'ni o'zi ajratib oladi va O'Z inline/bootstrap `<script>`
  // teglariga qo'yadi. Javobga ham aynan shu qiymat qo'yiladi.
  const nonce = generateNonce();
  const csp = serializeCsp(cspDirectives({ nonce, isProd: process.env.NODE_ENV === "production" }));

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", csp);

  const withCsp = <T extends NextResponse>(response: T): T => {
    response.headers.set(cspHeaderName(), csp);
    return response;
  };

  const isPublic =
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    // Ulashilgan natija (/s/<token>) — PLG public sahifa, kirishsiz ochilishi SHART
    pathname.startsWith("/s/");

  if (isPublic) {
    return withCsp(NextResponse.next({ request: { headers: requestHeaders } }));
  }

  if (!hasSession(request)) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    return withCsp(NextResponse.redirect(url));
  }

  return withCsp(NextResponse.next({ request: { headers: requestHeaders } }));
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
