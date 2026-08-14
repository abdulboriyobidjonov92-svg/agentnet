import { NextRequest, NextResponse } from "next/server";
import { encodeSession, SESSION_COOKIE, TOKEN_COOKIE, type Session } from "@/lib/session";

/**
 * Google OAuth callback — Google BEVOSITA shu yerga qaytaradi (Authorized
 * redirect URI). Bu route server-tomonda NestJS API'ga `code`ni almashtiradi
 * va httpOnly token cookie'sini `/api/session`dagi bilan AYNAN bir xil
 * naqshda o'rnatadi — JWT hech qachon URL'da yoki brauzer JS'da ko'rinmaydi
 * (agar bu yerda emas, `/sign-in?token=...` orqali qilinganida, token
 * brauzer tarixi/referrer/serverlogda qolib ketardi).
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
// `/api/session`dagi bilan bir xil bo'lishi SHART (token TTL bilan mos).
const MAX_AGE = 60 * 60 * 24 * 7;

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const code = req.nextUrl.searchParams.get("code");
  const deniedByUser = req.nextUrl.searchParams.get("error");
  // `state` — ixtiyoriy referral kodi (auth-form uni authorize URL'ga qo'shadi).
  const ref = req.nextUrl.searchParams.get("state");

  if (deniedByUser || !code) {
    return NextResponse.redirect(`${origin}/sign-in?error=google_denied`);
  }

  try {
    const upstream = await fetch(`${API_URL}/api/auth/google/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        redirectUri: `${origin}/api/auth/google/callback`,
        ref: ref || undefined,
      }),
      cache: "no-store",
    });
    const data = await upstream.json().catch(() => ({}) as Record<string, unknown>);
    if (!upstream.ok) {
      return NextResponse.redirect(`${origin}/sign-in?error=google_failed`);
    }

    if (data.needsTwoFactor) {
      // Parolsiz login'ning davomi — TOTP kodi kerak. `auth-form` shu ikki
      // query-parametrni o'qib to'g'ridan-to'g'ri 2FA bosqichiga o'tadi
      // (OTP oqimidagi `needsTwoFactor` javobi bilan bir xil holat).
      const userId = typeof data.userId === "string" ? data.userId : "";
      return NextResponse.redirect(
        `${origin}/sign-in?needsTwoFactor=1&userId=${encodeURIComponent(userId)}`,
      );
    }

    const profile: Session = {
      userId: String(data.userId ?? ""),
      email: typeof data.email === "string" ? data.email : "",
      phone: typeof data.phone === "string" && data.phone ? data.phone : undefined,
      name: typeof data.name === "string" && data.name ? data.name : undefined,
    };
    const secure = process.env.NODE_ENV === "production";
    const res = NextResponse.redirect(
      `${origin}${data.isNewUser ? "/onboarding" : "/dashboard"}`,
    );
    res.cookies.set(TOKEN_COOKIE, String(data.token ?? ""), {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: MAX_AGE,
    });
    res.cookies.set(SESSION_COOKIE, encodeSession(profile), {
      httpOnly: false,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: MAX_AGE,
    });
    return res;
  } catch {
    return NextResponse.redirect(`${origin}/sign-in?error=google_failed`);
  }
}
