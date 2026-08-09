import { NextRequest, NextResponse } from "next/server";
import {
  IMPERSONATION_META_COOKIE,
  IMPERSONATION_TOKEN_COOKIE,
  TOKEN_COOKIE,
  encodeImpersonationMeta,
  type ImpersonationMeta,
} from "@/lib/session";

/**
 * SEC-12 §6.6 — impersonation cookie'larini o'rnatish/tozalash.
 *
 * `/api/session` bilan AYNAN bir xil naqsh: httpOnly token FAQAT shu
 * server-route'da yoziladi, brauzer JS uni hech qachon ko'rmaydi.
 *
 * MUHIM ARXITEKTURA TANLOVI — operatorning O'Z tokeni (`agentnet_token`)
 * TEGILMAYDI. Sabab: "to'xtatish" so'rovi HAQIQIY operator sifatida
 * yuborilishi kerak (impersonation tokeni `@Roles(...)` yo'llariga
 * kirolmaydi — §10). Shu tanlov tufayli `ImpersonationGuard` da bironta
 * ham "ruxsat etilgan yozish" istisnosi qoldirmadik.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/** Cookie umri — token muddatidan BIR OZ uzun emas, AYNAN teng bo'lishi shart. */
function maxAgeFrom(expiresAt: string): number {
  const seconds = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000);
  // Manfiy/nol bo'lsa cookie umuman o'rnatilmaydi (quyida tekshiriladi).
  return seconds;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const token: unknown = body?.token;
  const meta: unknown = body?.meta;

  if (
    typeof token !== "string" ||
    token.split(".").length !== 3 ||
    !meta ||
    typeof (meta as ImpersonationMeta).impersonationId !== "string" ||
    typeof (meta as ImpersonationMeta).expiresAt !== "string"
  ) {
    return NextResponse.json({ message: "Yaroqsiz impersonation ma'lumoti" }, { status: 400 });
  }

  const typed = meta as ImpersonationMeta;
  const maxAge = maxAgeFrom(typed.expiresAt);
  if (maxAge <= 0) {
    return NextResponse.json({ message: "Muddati o'tgan sessiya" }, { status: 400 });
  }

  const secure = process.env.NODE_ENV === "production";
  const res = NextResponse.json({ ok: true });

  res.cookies.set(IMPERSONATION_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge,
  });
  res.cookies.set(IMPERSONATION_META_COOKIE, encodeImpersonationMeta(typed), {
    httpOnly: false, // banner o'qiydi — ichida TOKEN YO'Q
    secure,
    sameSite: "lax",
    path: "/",
    maxAge,
  });
  return res;
}

/**
 * §17 — to'xtatish.
 *
 * Ikki qadam, TARTIBI muhim:
 *   1. SERVERGA aniq to'xtatish so'rovi — HAQIQIY operator tokeni bilan
 *      (`agentnet_token`), chunki `/admin/*` impersonation uchun yopiq.
 *      Server sessiyani `ended` qiladi va tugash auditini yozadi.
 *   2. Cookie'lar tozalanadi.
 * Server qadami yiqilsa ham cookie'lar TOZALANADI: token baribir 30
 * daqiqada o'ladi va cron uni `expired` deb yopadi — operatorni
 * impersonation ichida "qamab qo'yish" eng yomon natija bo'lardi.
 */
export async function DELETE(req: NextRequest) {
  const impersonationId = req.nextUrl.searchParams.get("id");
  const operatorToken = req.cookies.get(TOKEN_COOKIE)?.value;

  let serverStopped = false;
  if (impersonationId && operatorToken) {
    try {
      const upstream = await fetch(
        `${API_URL}/api/admin/impersonation/${encodeURIComponent(impersonationId)}/stop`,
        {
          method: "POST",
          headers: { authorization: `Bearer ${operatorToken}` },
          cache: "no-store",
        },
      );
      serverStopped = upstream.ok;
    } catch {
      serverStopped = false;
    }
  }

  const res = NextResponse.json({ ok: true, serverStopped });
  res.cookies.set(IMPERSONATION_TOKEN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  res.cookies.set(IMPERSONATION_META_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
