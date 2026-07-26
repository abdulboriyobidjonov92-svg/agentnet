import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

/**
 * /api/chat/stream — pul (charge-message) LLM chaqiruvidan OLDIN yechiladi;
 * keyingi HAR QANDAY muvaffaqiyatsizlik (rate-limit/engine o'chiq/engine xatosi/
 * oqim o'rtasida uzilish/demo-rejim) yechilgan pulni QAYTARISHI SHART — aks
 * holda foydalanuvchi xizmat olmay pul yo'qotadi. Bu fayl aynan shu
 * pul-himoyasi zanjirini (L11/L12/M6) sinaydi.
 */

function fakeJwt(payload: Record<string, unknown>): string {
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${enc({ alg: "HS256" })}.${enc(payload)}.sig`;
}

const VALID_TOKEN = fakeJwt({ sub: "u1" });

function chatReq(body: unknown = { message: "salom" }, cookie = `agentnet_token=${VALID_TOKEN}`) {
  return new NextRequest("https://app.agentnet.uz/api/chat/stream", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(body),
  });
}

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 500) {
  return { ok, status, json: async () => body } as Response;
}

function sseEngineResponse(text: string, ok = true) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
  return { ok, status: ok ? 200 : 500, body: ok ? stream : null } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;
let chargeResponse: Response;
let consumeChatResponse: Response;
let engineResponse: Response;

beforeEach(() => {
  chargeResponse = jsonResponse({});
  consumeChatResponse = jsonResponse({});
  engineResponse = sseEngineResponse(`data: ${JSON.stringify({ type: "chunk", content: "salom" })}\n\ndata: ${JSON.stringify({ type: "done", demo_mode: false })}\n\n`);

  fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async (url) => {
    if (url.includes("/api/billing/charge-message")) return chargeResponse;
    if (url.includes("/api/usage/consume-chat")) return consumeChatResponse;
    if (url.includes("/api/billing/refund")) return jsonResponse({ ok: true });
    if (url.includes("/agents/stream")) return engineResponse;
    throw new Error(`Kutilmagan fetch URL: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function refundCalls() {
  return fetchMock.mock.calls.filter((call) => (call[0] as string).includes("/api/billing/refund"));
}

/** refund-chaqiruvining JSON tanasini o'qiydi (idempotencyKey/reason tekshiruvi uchun). */
function refundBody(index = 0): { reason: string; idempotencyKey: string } {
  const init = refundCalls()[index][1] as RequestInit;
  return JSON.parse(init.body as string);
}

describe("auth gate — LLM chaqiruvidan oldin", () => {
  it("token cookie'si yo'q -> 401, HECH QANDAY fetch chaqirilmaydi (pul yechilmaydi)", async () => {
    const res = await POST(chatReq({ message: "salom" }, ""));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("token 3-qismli emas (yaroqsiz) -> 401", async () => {
    const res = await POST(chatReq({ message: "salom" }, "agentnet_token=not-a-jwt"));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("token yaroqli lekin payload'da sub yo'q -> 401 (user_id'siz engine'ga borilmaydi)", async () => {
    const token = fakeJwt({ email: "a@b.com" }); // sub yo'q
    const res = await POST(chatReq({ message: "salom" }, `agentnet_token=${token}`));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("legacy profil-cookie ICHIDAGI token ham ishlaydi (fallback)", async () => {
    const token = fakeJwt({ sub: "u1" });
    const legacy = Buffer.from(JSON.stringify({ userId: "u1", email: "a@b.com", token })).toString("base64");
    const res = await POST(chatReq({ message: "salom" }, `agentnet_user=${legacy}`));
    expect(res.status).toBe(200); // to'liq muvaffaqiyatli oqimgacha yetib boradi
  });
});

describe("1) Pul himoyasi — charge-message LLM'dan OLDIN", () => {
  it("balans yetarli emas (402) -> SSE insufficient_balance, consume-chat/engine CHAQIRILMAYDI", async () => {
    chargeResponse = jsonResponse({ message: "Balans yetarli emas", pricePerMessageSom: 500 }, false, 402);

    const res = await POST(chatReq());
    const text = await res.text();

    expect(res.status).toBe(200); // SSE protokoli — HTTP status doim 200
    expect(text).toContain('"type":"insufficient_balance"');
    expect(text).toContain('"type":"done"');
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining("consume-chat"), expect.anything());
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining("agents/stream"), expect.anything());
  });

  it("charge-message boshqa xato bilan muvaffaqiyatsiz (masalan 401) -> umumiy SSE xato, LLM chaqirilmaydi", async () => {
    chargeResponse = jsonResponse({}, false, 401);

    const res = await POST(chatReq());
    const text = await res.text();

    expect(text).toContain('"type":"error"');
    expect(text).not.toContain("insufficient_balance");
  });

  it("charge-message tarmoq xatosi bilan yiqilsa (fetch reject) -> fail-closed, umumiy SSE xato", async () => {
    fetchMock.mockImplementationOnce(async () => {
      throw new Error("ECONNREFUSED");
    });

    const res = await POST(chatReq());
    const text = await res.text();
    expect(text).toContain('"type":"error"');
  });
});

describe("2) Rate-limit — pul allaqachon yechilgan, limitga urilsa QAYTARILADI", () => {
  it("consume-chat 429 qaytarsa -> refund('rate_limited') chaqiriladi, SSE rate_limit eventi", async () => {
    consumeChatResponse = jsonResponse({ message: "Kunlik limitga yetdingiz", reason: "daily_limit" }, false, 429);

    const res = await POST(chatReq());
    const text = await res.text();

    expect(text).toContain('"type":"rate_limit"');
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining("agents/stream"), expect.anything());
    expect(refundCalls()).toHaveLength(1);
    expect(refundBody().reason).toBe("rate_limited");
  });

  it("consume-chat tarmoq xatosi bilan yiqilsa -> yumshoq muvaffaqiyatsizlik, oqim DAVOM ETADI (bloklanmaydi)", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/api/billing/charge-message")) return chargeResponse;
      if (url.includes("/api/usage/consume-chat")) throw new Error("usage API o'chiq");
      if (url.includes("/api/billing/refund")) return jsonResponse({ ok: true });
      if (url.includes("/agents/stream")) return engineResponse;
      throw new Error(`Kutilmagan fetch URL: ${url}`);
    });

    const res = await POST(chatReq());
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('"type":"chunk"');
    expect(refundCalls()).toHaveLength(0); // pul yechilgan va xizmat berilgan — qaytarilmaydi
  });
});

describe("3) Engine ishlamasa — yechilgan pul QAYTARILADI", () => {
  it("engine mavjud emas (fetch reject) -> refund('engine_unreachable'), 503", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/api/billing/charge-message")) return chargeResponse;
      if (url.includes("/api/usage/consume-chat")) return consumeChatResponse;
      if (url.includes("/api/billing/refund")) return jsonResponse({ ok: true });
      if (url.includes("/agents/stream")) throw new Error("ECONNREFUSED");
      throw new Error(`Kutilmagan fetch URL: ${url}`);
    });

    const res = await POST(chatReq());
    expect(res.status).toBe(503);
    expect(refundCalls()).toHaveLength(1);
    expect(refundBody().reason).toBe("engine_unreachable");
  });

  it("engine non-OK javob bersa -> refund('engine_error'), 500", async () => {
    engineResponse = sseEngineResponse("", false);

    const res = await POST(chatReq());
    expect(res.status).toBe(500);
    expect(refundCalls()).toHaveLength(1);
    expect(refundBody().reason).toBe("engine_error");
  });
});

describe("4) Oqim monitor — L11 (o'rtada uzilish/xato -> qaytarish)", () => {
  it("muvaffaqiyatli oqim (type:done bor, xatosiz, demo emas) -> refund UMUMAN CHAQIRILMAYDI", async () => {
    const res = await POST(chatReq());
    const text = await res.text();

    expect(text).toContain('"type":"done"');
    expect(refundCalls()).toHaveLength(0);
  });

  it("oqimda type:'error' eventi bo'lsa -> refund('stream_failed')", async () => {
    engineResponse = sseEngineResponse(
      `data: ${JSON.stringify({ type: "error", message: "LLM xatosi" })}\n\ndata: ${JSON.stringify({ type: "done" })}\n\n`,
    );

    const res = await POST(chatReq());
    await res.text();

    expect(refundCalls()).toHaveLength(1);
    expect(refundBody().reason).toBe("stream_failed");
  });

  it("oqim 'done'siz erta uzilsa -> refund('stream_failed')", async () => {
    engineResponse = sseEngineResponse(`data: ${JSON.stringify({ type: "chunk", content: "yarim gap" })}\n\n`);

    const res = await POST(chatReq());
    await res.text();

    expect(refundCalls()).toHaveLength(1);
    expect(refundBody().reason).toBe("stream_failed");
  });

  it("demo_mode:true bilan tugasa (real Claude javobi emas) -> refund('demo_mode')", async () => {
    engineResponse = sseEngineResponse(
      `data: ${JSON.stringify({ type: "chunk", content: "demo javob" })}\n\ndata: ${JSON.stringify({ type: "done", demo_mode: true })}\n\n`,
    );

    const res = await POST(chatReq());
    await res.text();

    expect(refundCalls()).toHaveLength(1);
    expect(refundBody().reason).toBe("demo_mode");
  });

  it("mijozga yuboriladigan baytlar O'ZGARISHSIZ uzatiladi (monitor faqat kuzatadi)", async () => {
    const original = `data: ${JSON.stringify({ type: "chunk", content: "aniq matn" })}\n\ndata: ${JSON.stringify({ type: "done" })}\n\n`;
    engineResponse = sseEngineResponse(original);

    const res = await POST(chatReq());
    const text = await res.text();
    expect(text).toBe(original);
  });
});

describe("refund-idempotency (L12)", () => {
  it("bitta so'rov ichida BARCHA refund-yo'llar bir xil idempotencyKey ishlatadi", async () => {
    consumeChatResponse = jsonResponse({}, false, 429);

    await POST(chatReq());

    expect(refundCalls()).toHaveLength(1); // shu yo'lda faqat bitta refund chaqiriladi
    expect(typeof refundBody().idempotencyKey).toBe("string");
    expect(refundBody().idempotencyKey.length).toBeGreaterThan(0);
  });
});
