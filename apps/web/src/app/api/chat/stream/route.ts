import { NextRequest } from "next/server";
import { decodeSession, SESSION_COOKIE } from "@/lib/session";

export async function POST(req: NextRequest) {
  const session = decodeSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return new Response("Unauthorized", { status: 401 });

  const body = await req.json();
  const engineUrl = process.env.AGENT_ENGINE_URL ?? "http://localhost:8000";

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
