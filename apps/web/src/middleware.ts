import { NextRequest, NextResponse } from "next/server";

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
    return NextResponse.redirect(url);
  }

  const isPublic =
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    // Ulashilgan natija (/s/<token>) — PLG public sahifa, kirishsiz ochilishi SHART
    pathname.startsWith("/s/");

  if (isPublic) return NextResponse.next();

  if (!hasSession(request)) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
