import { NextRequest } from "next/server";
import { decodeSession, SESSION_COOKIE } from "@/lib/session";

export async function POST(req: NextRequest) {
  const session = decodeSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return new Response("Unauthorized", { status: 401 });

  const body = await req.json();
  const engineUrl = process.env.AGENT_ENGINE_URL ?? "http://localhost:8000";
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  // Ichki (server-to-server) kalit — /billing/refund balansni OSHIRADI, shuning
  // uchun InternalTokenGuard bilan himoyalangan; faqat shu BFF chaqira oladi.
  const internalToken = process.env.INTERNAL_API_TOKEN ?? "agentnet-internal-dev";

  // Imzolangan token — barcha API (usage/billing) chaqiruvlari uchun. Token
  // bo'lmasa foydalanuvchi qayta kirishi kerak (eski, imzosiz sessiya).
  if (!session.token) return new Response("Unauthorized", { status: 401 });
  const authHeader = `Bearer ${session.token}`;

  // Rate limit / xarajat himoyasi — LLM'ga o'tishdan OLDIN kunlik+global limitni
  // NestJS'da tekshiramiz va hisoblaymiz. 429 bo'lsa oqim boshlanmaydi.
  try {
    const limitRes = await fetch(`${apiUrl}/api/usage/consume-chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
    });
    if (limitRes.status === 429) {
      const info = await limitRes.json().catch(() => ({}));
      return new Response(
        `data: ${JSON.stringify({ type: "rate_limit", message: info.message ?? "Limitga yetdingiz", reason: info.reason })}\n\n` +
          `data: ${JSON.stringify({ type: "done", demo_mode: false })}\n\n`,
        { status: 200, headers: { "Content-Type": "text/event-stream" } },
      );
    }
  } catch {
    // Usage API o'chik bo'lsa — chatni bloklamaymiz (soft-fail), lekin log qoladi
    console.warn("[chat/stream] usage limit tekshiruvi o'tkazib yuborildi (API javob bermadi)");
  }

  // Pul himoyasi — LLM chaqiruvidan OLDIN foydalanuvchi balansidan yechamiz.
  // Balans yetarli bo'lmasa 402 qaytadi va Claude API'ga so'rov UMUMAN ketmaydi —
  // platforma egasi hech qachon bu xarajatni ko'tarmaydi.
  const chargeRes = await fetch(`${apiUrl}/api/billing/charge-message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
  }).catch(() => null);

  // FAIL-CLOSED: pul yechilishi TASDIQLANMASA oqim BOSHLANMAYDI. 402 = balans
  // yetarli emas (aniq xabar). Boshqa HAR QANDAY non-OK (401/403 — yaroqsiz/
  // eskirgan token, 5xx, yoki tarmoq uzilishi) ham bloklaydi — aks holda soxta
  // cookie'dagi ixtiyoriy token bilan BEPUL LLM olish mumkin bo'lardi (billing
  // + rate-limit chetlab o'tilardi). Balans himoyasi shu yerda yakuniy darvoza.
  if (!chargeRes || !chargeRes.ok) {
    const info = chargeRes ? await chargeRes.json().catch(() => ({})) : {};
    const insufficient = chargeRes?.status === 402;
    return new Response(
      `data: ${JSON.stringify({
        type: insufficient ? "insufficient_balance" : "error",
        message:
          info.message ??
          (insufficient
            ? "Balansingiz yetarli emas. Hisobingizni to'ldiring."
            : "To'lovni tasdiqlab bo'lmadi — qaytadan kiring yoki birozdan keyin urinib ko'ring."),
        pricePerMessageSom: info.pricePerMessageSom,
      })}\n\n` + `data: ${JSON.stringify({ type: "done", demo_mode: false })}\n\n`,
      { status: 200, headers: { "Content-Type": "text/event-stream" } },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${engineUrl}/agents/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_definition: body.agentDefinition,
        user_id: session.userId,
        message: body.message,
        conversation_id: body.conversationId ?? null,
        conversation_history: body.conversationHistory ?? null,
        profession: body.profession ?? "",
      }),
    });
  } catch (e: any) {
    // Xizmat ko'rsatilmadi — to'langan pulni qaytaramiz
    fetch(`${apiUrl}/api/billing/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader, "x-internal-token": internalToken },
      body: JSON.stringify({ reason: "engine_unreachable" }),
    }).catch(() => {});
    return new Response(
      `data: ${JSON.stringify({ type: "error", message: "Agent engine bilan aloqa yo'q" })}\n\n`,
      { status: 503, headers: { "Content-Type": "text/event-stream" } },
    );
  }

  if (!upstream.ok || !upstream.body) {
    fetch(`${apiUrl}/api/billing/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader, "x-internal-token": internalToken },
      body: JSON.stringify({ reason: "engine_error" }),
    }).catch(() => {});
    return new Response(
      `data: ${JSON.stringify({ type: "error", message: "Agent engine xatosi" })}\n\n`,
      { status: 500, headers: { "Content-Type": "text/event-stream" } },
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
