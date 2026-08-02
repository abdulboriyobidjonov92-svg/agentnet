import { NextRequest } from "next/server";
import { decodeSession, tokenPayload, SESSION_COOKIE, TOKEN_COOKIE } from "@/lib/session";

/**
 * Device Control brauzer-agent BFF — httpOnly cookie'dagi tokenni o'qib,
 * NestJS'ning SSE endpointiga (`/api/device/browser/stream`) proxy qiladi va
 * qadam-eventlarini brauzerga uzatadi. Chat/stream bilan bir xil naqsh:
 * token JS'ga ko'rinmaydi, faqat server uni Authorization sifatida qo'shadi.
 */
export async function POST(req: NextRequest) {
  const token =
    req.cookies.get(TOKEN_COOKIE)?.value ||
    decodeSession(req.cookies.get(SESSION_COOKIE)?.value)?.token;
  if (!token || !tokenPayload(token)?.sub) {
    return new Response("Unauthorized", { status: 401 });
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const body = await req.json().catch(() => ({}));

  let upstream: Response;
  try {
    upstream = await fetch(`${apiUrl}/api/device/browser/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ goal: body.goal, startUrl: body.startUrl || undefined }),
    });
  } catch {
    return new Response(
      `data: ${JSON.stringify({ type: "error", message: "Qurilma-boshqaruv xizmati bilan aloqa yo'q" })}\n\n`,
      { status: 503, headers: { "Content-Type": "text/event-stream" } },
    );
  }

  if (!upstream.ok || !upstream.body) {
    // Kvota (429) yoki auth (401) — xatoni SSE ko'rinishida uzatamiz.
    const info = await upstream.json().catch(() => ({}));
    const type = upstream.status === 429 ? "rate_limit" : "error";
    return new Response(
      `data: ${JSON.stringify({ type, message: info.message ?? "So'rov bajarilmadi", status: upstream.status })}\n\n`,
      { status: 200, headers: { "Content-Type": "text/event-stream" } },
    );
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
