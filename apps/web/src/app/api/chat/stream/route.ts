import { NextRequest } from "next/server";
import { decodeSession, tokenPayload, SESSION_COOKIE, TOKEN_COOKIE } from "@/lib/session";

export async function POST(req: NextRequest) {
  // Token endi httpOnly cookie'da (XSS himoyasi); legacy sessiyalar uchun eski
  // profil-cookie ichidagi token fallback sifatida qabul qilinadi.
  const token =
    req.cookies.get(TOKEN_COOKIE)?.value ||
    decodeSession(req.cookies.get(SESSION_COOKIE)?.value)?.token;
  if (!token) return new Response("Unauthorized", { status: 401 });

  // user_id IMZOLANGAN token ichidan olinadi — ilgari profil-cookie'dagi userId
  // ishlatilardi, uni esa har kim o'zgartira olardi (o'z tokeni bilan boshqa
  // foydalanuvchi nomidan engine'ga borish mumkin edi). Imzo o'zi quyidagi
  // charge-message chaqiruvida API tomonidan tekshiriladi (fail-closed).
  const payload = tokenPayload(token);
  if (!payload?.sub) return new Response("Unauthorized", { status: 401 });

  const body = await req.json();
  const engineUrl = process.env.AGENT_ENGINE_URL ?? "http://localhost:8000";
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  // Ichki (server-to-server) kalit — /billing/refund balansni OSHIRADI, shuning
  // uchun InternalTokenGuard bilan himoyalangan; faqat shu BFF chaqira oladi.
  const internalToken = process.env.INTERNAL_API_TOKEN ?? "agentnet-internal-dev";

  const authHeader = `Bearer ${token}`;

  // Refund idempotency (L12): shu so'rov uchun BITTA kalit. Barcha refund-yo'llari
  // (limit/engine-uzilishi/oqim-xatosi) shu kalit bilan chaqiriladi — bir necha
  // yo'l yoki qayta urinish bo'lsa ham balans FAQAT BIR MARTA qaytariladi.
  const refundKey = crypto.randomUUID();
  const postRefund = (reason: string) => {
    fetch(`${apiUrl}/api/billing/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader, "x-internal-token": internalToken },
      body: JSON.stringify({ reason, idempotencyKey: refundKey }),
    }).catch(() => {});
  };

  // Rate limit / xarajat himoyasi — LLM'ga o'tishdan OLDIN kunlik+global limitni
  // NestJS'da tekshiramiz va hisoblaymiz. 429 bo'lsa oqim boshlanmaydi.
  // TARTIB (M6): avval PUL, keyin RATE-LIMIT. Ilgari `consume-chat` (kunlik+global
  // hisoblagichni oshiradi) BIRINCHI chaqirilardi; agar keyin `charge-message` 402
  // (balans yetmasa) qaytarsa, hisoblagich OSHIRILGANICHA qolardi — balanssiz
  // foydalanuvchi har muvaffaqiyatsiz urinishda o'z kunlik kvotasini va GLOBAL LLM
  // limitini yeb bitirishi (griefing) mumkin edi. Endi avval balans yechiladi:
  // pul yetmasa 402 DARHOL to'xtaydi, hisoblagichga umuman tegilmaydi.

  // 1) Pul himoyasi — LLM chaqiruvidan OLDIN balansdan yechamiz.
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

  // 2) Rate-limit (kunlik/global). Pul allaqachon yechilgani uchun, agar bu yerda
  // 429 bo'lsa yechilgan pulni QAYTARAMIZ (aks holda limitga urilgan foydalanuvchi
  // xizmat olmay pul yo'qotardi).
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
      postRefund("rate_limited");
      return new Response(
        `data: ${JSON.stringify({ type: "rate_limit", message: info.message ?? "Limitga yetdingiz", reason: info.reason })}\n\n` +
          `data: ${JSON.stringify({ type: "done", demo_mode: false })}\n\n`,
        { status: 200, headers: { "Content-Type": "text/event-stream" } },
      );
    }
  } catch {
    // Usage API o'chik bo'lsa — chatni bloklamaymiz (soft-fail); pul yechilgan,
    // oqim davom etadi (rate-limit vaqtincha tekshirilmaydi).
    console.warn("[chat/stream] usage limit tekshiruvi o'tkazib yuborildi (API javob bermadi)");
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${engineUrl}/agents/stream`, {
      method: "POST",
      // Engine endi ichki auth talab qiladi (main.py internal_token_guard) —
      // token'siz so'rov 401. Bu BFF platformaning ichki servisi bo'lgani uchun
      // uzatishga haqli (foydalanuvchi brauzeri engine'ga to'g'ridan-to'g'ri
      // yeta olmaydi).
      headers: { "Content-Type": "application/json", "x-internal-token": internalToken },
      body: JSON.stringify({
        agent_definition: body.agentDefinition,
        user_id: payload.sub,
        message: body.message,
        conversation_id: body.conversationId ?? null,
        conversation_history: body.conversationHistory ?? null,
        profession: body.profession ?? "",
      }),
    });
  } catch (e: any) {
    // Xizmat ko'rsatilmadi — to'langan pulni qaytaramiz
    postRefund("engine_unreachable");
    return new Response(
      `data: ${JSON.stringify({ type: "error", message: "Agent engine bilan aloqa yo'q" })}\n\n`,
      { status: 503, headers: { "Content-Type": "text/event-stream" } },
    );
  }

  if (!upstream.ok || !upstream.body) {
    postRefund("engine_error");
    return new Response(
      `data: ${JSON.stringify({ type: "error", message: "Agent engine xatosi" })}\n\n`,
      { status: 500, headers: { "Content-Type": "text/event-stream" } },
    );
  }

  // L11: OQIM O'RTASIDA uzilish/xato — pulni qaytarish. Charge muvaffaqiyatli
  // bo'lib, engine 200 bilan javob berib, keyin oqim O'RTASIDA yiqilsa (yoki
  // `type:"error"` event yuborsa yoki `type:"done"`siz uzilsa) foydalanuvchi
  // buzuq/qisman javob uchun pul to'lagan bo'lardi. Oqimni kuzatib, shunday
  // holatda refund qilamiz (idempotency kaliti bilan — double-credit bo'lmaydi).
  const decoder = new TextDecoder();
  let tail = "";
  let sawError = false;
  let sawDone = false;
  let sawDemo = false;
  const monitor = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      controller.enqueue(chunk); // mijozga o'zgarishsiz uzatamiz
      tail = (tail + decoder.decode(chunk, { stream: true })).slice(-1024); // chunk-chegarasi bo'linishi uchun oyna
      if (/"type"\s*:\s*"error"/.test(tail)) sawError = true;
      if (/"type"\s*:\s*"done"/.test(tail)) sawDone = true;
      // Demo-javob (ANTHROPIC_API_KEY sozlanmagan instans) — real Claude javobi
      // emas, shuning uchun bunga PUL OLINMAYDI. Bu regex faqat engine'ning
      // `{"type":"done","demo_mode":true}` eventiga mos keladi (BFF'ning o'z
      // sintetik eventlari doim demo_mode:false yuboradi).
      if (/"demo_mode"\s*:\s*true/.test(tail)) sawDemo = true;
    },
    flush() {
      // Xato-event ko'rildi YOKI oqim `done`siz tugadi (erta uzilish) YOKI
      // javob demo rejimda berildi (xizmat real ko'rsatilmadi) -> refund.
      if (sawError || !sawDone) postRefund("stream_failed");
      else if (sawDemo) postRefund("demo_mode");
    },
  });

  return new Response(upstream.body.pipeThrough(monitor), {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
