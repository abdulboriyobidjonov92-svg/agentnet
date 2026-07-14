import { NextRequest, NextResponse } from "next/server";
import { encodeSession, SESSION_COOKIE, TOKEN_COOKIE, type Session } from "@/lib/session";

/**
 * Sessiya o'rnatish/tozalash — httpOnly token cookie'si FAQAT shu yerda
 * yoziladi. Login muvaffaqiyatidan keyin auth-form API'dan olgan javobni
 * shu route'ga uzatadi:
 *   - agentnet_token (httpOnly, Secure prod'da) — JWT, JS ko'ra olmaydi
 *   - agentnet_user — tokensiz profil, UI uchun
 *
 * Bu route tokenning HAQIQIYLIGINI tekshirmaydi (BFF'da imzo-kaliti yo'q) —
 * soxta token bilan cookie o'rnatilsa ham, har bir API chaqiruvida NestJS
 * guard imzoni tekshiradi va 401 qaytaradi (fail-closed o'zgarmagan).
 */

const MAX_AGE = 60 * 60 * 24 * 30; // 30 kun — token muddati bilan bir xil

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const token: unknown = body?.token;
  const userId: unknown = body?.userId;

  if (
    typeof token !== "string" ||
    token.split(".").length !== 3 ||
    typeof userId !== "string" ||
    !userId
  ) {
    return NextResponse.json({ message: "Yaroqsiz sessiya ma'lumoti" }, { status: 400 });
  }

  const profile: Session = {
    userId,
    email: typeof body.email === "string" ? body.email : "",
    phone: typeof body.phone === "string" && body.phone ? body.phone : undefined,
    name: typeof body.name === "string" && body.name ? body.name : undefined,
  };

  const secure = process.env.NODE_ENV === "production";
  const res = NextResponse.json({ ok: true });
  res.cookies.set(TOKEN_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
  res.cookies.set(SESSION_COOKIE, encodeSession(profile), {
    httpOnly: false, // UI (layout, sidebar) profilni o'qiydi — ichida token YO'Q
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(TOKEN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
