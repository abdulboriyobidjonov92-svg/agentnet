import { NextRequest, NextResponse } from "next/server";

// Lokal auth (Clerk'siz). Dashboard yo'llari uchun sessiya cookie'sini tekshiradi.
// /agentos-demo — ochiq ko'rgazma sahifasi (Living Interface demo, shaxsiy ma'lumot yo'q)
const PUBLIC_PATHS = ["/", "/sign-in", "/sign-up", "/agentos-demo"];

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const TOKEN_COOKIE = "agentnet_token";
const SESSION_COOKIE = "agentnet_user";
const PROXY_PREFIX = "/api/backend/";

/** Legacy sessiyalar (token profil-cookie ichida bo'lgan davr) uchun fallback. */
function legacyToken(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(decodeURIComponent(escape(atob(raw))));
    return typeof s?.token === "string" && s.token ? s.token : null;
  } catch {
    return null;
  }
}

function resolveToken(request: NextRequest): string | null {
  return (
    request.cookies.get(TOKEN_COOKIE)?.value ||
    legacyToken(request.cookies.get(SESSION_COOKIE)?.value)
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
    const token = resolveToken(request);
    if (token) headers.set("authorization", `Bearer ${token}`);
    return NextResponse.rewrite(target, { request: { headers } });
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
