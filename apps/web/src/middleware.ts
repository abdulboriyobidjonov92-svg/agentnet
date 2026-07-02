import { NextRequest, NextResponse } from "next/server";

// Lokal auth (Clerk'siz). Dashboard yo'llari uchun sessiya cookie'sini tekshiradi.
const PUBLIC_PATHS = ["/", "/sign-in", "/sign-up"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic =
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next");

  if (isPublic) return NextResponse.next();

  const session = request.cookies.get("agentnet_user")?.value;
  if (!session) {
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
