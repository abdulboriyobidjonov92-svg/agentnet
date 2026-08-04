import { NextRequest, NextResponse } from "next/server";
import { decodeSession, SESSION_COOKIE, TOKEN_COOKIE } from "@/lib/session";

/**
 * SEC-03 AC#5 — joriy sessiyani yangi 7-kunlik token bilan almashtiradi
 * ("jimgina yangilanish"). Faqat ENDPOINT sifatida mavjud: buni qачон
 * chaqirish kerakligini hal qiluvchi avtomatik mexanizm (client-side
 * polling/timer/background job) ATAYLAB qo'shilmagan — bu kelajakdagi UX
 * bosqichi (Engineering Contract, SEC-03 approval, Decision B).
 *
 * Token endi httpOnly cookie'da (XSS himoyasi); legacy sessiyalar uchun eski
 * profil-cookie ichidagi token fallback sifatida qabul qilinadi — xuddi
 * shu BFF-darajasidagi qo'shni route'lar (chat/stream, device/browser/stream)
 * bilan bir xil, chunki SEC-04 hali bu fallback'ni olib tashlamagan.
 */

// ../route.ts'dagi bilan AYNAN bir xil qiymat — Next.js route.ts fayllari
// HTTP-metod eksportlaridan boshqa nom eksport qilishga ruxsat bermaydi
// (sinab ko'rilgan, build xato beradi), shuning uchun bu yerda takrorlangan.
// Ikkalasini birga o'zgartiring.
const MAX_AGE = 60 * 60 * 24 * 7; // 7 kun
export async function POST(req: NextRequest) {
  const token =
    req.cookies.get(TOKEN_COOKIE)?.value ||
    decodeSession(req.cookies.get(SESSION_COOKIE)?.value)?.token;
  if (!token) return NextResponse.json({ message: "Sessiya topilmadi" }, { status: 401 });

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

  let upstream: Response;
  try {
    upstream = await fetch(`${apiUrl}/api/auth/session/refresh`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    return NextResponse.json({ message: "API bilan aloqa yo'q" }, { status: 503 });
  }

  if (!upstream.ok) {
    // Token allaqachon bekor qilingan yoki muddati o'tgan (401) — cookie'larni
    // bu yerda TOZALAMAYMIZ (qo'shni BFF route'lar ham shunday); keyingi
    // himoyalangan API chaqiruvi baribir 401 qaytaradi va foydalanuvchi odatiy
    // yo'l bilan qayta kirishga yo'naltiriladi.
    const info = await upstream.json().catch(() => ({}));
    return NextResponse.json(
      { message: info.message ?? "Sessiya yangilanmadi" },
      { status: upstream.status },
    );
  }

  const data = await upstream.json().catch(() => null);
  if (!data || typeof data.token !== "string") {
    return NextResponse.json({ message: "API yaroqsiz javob qaytardi" }, { status: 502 });
  }

  // Token brauzer JS'iga HECH QACHON qaytarilmaydi — faqat yangi httpOnly
  // cookie o'rnatiladi (/api/session POST bilan bir xil naqsh).
  const secure = process.env.NODE_ENV === "production";
  const res = NextResponse.json({ ok: true });
  res.cookies.set(TOKEN_COOKIE, data.token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
  return res;
}
