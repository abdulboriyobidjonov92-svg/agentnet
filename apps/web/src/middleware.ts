import { NextRequest, NextResponse } from "next/server";

// Lokal auth (Clerk'siz). Dashboard yo'llari uchun sessiya cookie'sini tekshiradi.
// /agentos-demo — ochiq ko'rgazma sahifasi (Living Interface demo, shaxsiy ma'lumot yo'q)
const PUBLIC_PATHS = ["/", "/sign-in", "/sign-up", "/agentos-demo"];

/**
 * Cookie'ni Edge-runtime'da dekodlab, tuzilishini tekshiradi (L10). Middleware
 * imzoni tasdiqlay olmaydi (AUTH_JWT_SECRET faqat API'da), lekin cookie base64-JSON
 * bo'lib, `userId` VA imzolangan `token` maydonlariga ega ekanini tekshira oladi.
 * Ilgari middleware faqat cookie BORLIGINI tekshirardi — soxta/buzuq cookie bilan
 * dashboard qobig'i yuklanib, keyin har API chaqiruvi 401 berardi (xunuk UX).
 * Endi yaroqsiz cookie darhol sign-in'ga yo'naltiriladi.
 */
function hasValidSessionShape(raw: string | undefined): boolean {
  if (!raw) return false;
  try {
    const json = decodeURIComponent(escape(atob(raw)));
    const s = JSON.parse(json);
    return typeof s?.userId === "string" && !!s.userId && typeof s?.token === "string" && !!s.token;
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic =
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    // Ulashilgan natija (/s/<token>) — PLG public sahifa, kirishsiz ochilishi SHART
    pathname.startsWith("/s/");

  if (isPublic) return NextResponse.next();

  const session = request.cookies.get("agentnet_user")?.value;
  if (!hasValidSessionShape(session)) {
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
