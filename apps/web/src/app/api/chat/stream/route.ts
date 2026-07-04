import { NextRequest } from "next/server";
import { decodeSession, SESSION_COOKIE } from "@/lib/session";

export async function POST(req: NextRequest) {
  const session = decodeSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return new Response("Unauthorized", { status: 401 });

  const body = await req.json();
  const engineUrl = process.env.AGENT_ENGINE_URL ?? "http://localhost:8000";
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

  // Rate limit / xarajat himoyasi — LLM'ga o'tishdan OLDIN kunlik+global limitni
  // NestJS'da tekshiramiz va hisoblaymiz. 429 bo'lsa oqim boshlanmaydi.
  try {
    const limitRes = await fetch(`${apiUrl}/api/usage/consume-chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.userId}`,
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
    return new Response(
      `data: ${JSON.stringify({ type: "error", message: "Agent engine bilan aloqa yo'q" })}\n\n`,
      { status: 503, headers: { "Content-Type": "text/event-stream" } },
    );
  }

  if (!upstream.ok || !upstream.body) {
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
