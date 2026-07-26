import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { middleware } from "./middleware";

function req(pathname: string, opts: { cookie?: string; search?: string } = {}) {
  const url = `https://app.agentnet.uz${pathname}${opts.search ?? ""}`;
  return new NextRequest(url, {
    headers: opts.cookie ? { cookie: opts.cookie } : {},
  });
}

describe("middleware — ochiq (public) yo'llar", () => {
  it.each(["/", "/sign-in", "/sign-up", "/agentos-demo"])(
    "%s — sessiyasiz ham o'tkaziladi (redirect yo'q)",
    (pathname) => {
      const res = middleware(req(pathname));
      expect(res.status).not.toBe(307);
      expect(res.headers.get("location")).toBeNull();
    },
  );

  it("/s/<token> — ulashilgan natija sahifasi, sessiyasiz ham ochiq", () => {
    const res = middleware(req("/s/abc123"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("/_next/* — statik assetlar sessiyasiz o'tkaziladi", () => {
    const res = middleware(req("/_next/static/chunk.js"));
    expect(res.headers.get("location")).toBeNull();
  });
});

describe("middleware — himoyalangan dashboard yo'llari", () => {
  it("sessiya cookie'siz -> /sign-in'ga redirect (307)", () => {
    const res = middleware(req("/dashboard"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/sign-in");
  });

  it("agentnet_token cookie'si bilan -> o'tkaziladi (redirect yo'q)", () => {
    const res = middleware(req("/dashboard", { cookie: "agentnet_token=header.payload.sig" }));
    expect(res.headers.get("location")).toBeNull();
  });

  it("faqat legacy profil-cookie (token ICHIDA) bilan ham o'tkaziladi", () => {
    const legacy = { userId: "u1", email: "a@b.com", token: "legacy.jwt.token" };
    const b64 = Buffer.from(JSON.stringify(legacy)).toString("base64");
    const res = middleware(req("/dashboard", { cookie: `agentnet_user=${b64}` }));
    expect(res.headers.get("location")).toBeNull();
  });

  it("legacy profil-cookie'da token maydoni bo'lmasa -> baribir redirect", () => {
    const legacy = { userId: "u1", email: "a@b.com" }; // token yo'q
    const b64 = Buffer.from(JSON.stringify(legacy)).toString("base64");
    const res = middleware(req("/dashboard", { cookie: `agentnet_user=${b64}` }));
    expect(res.status).toBe(307);
  });

  it("buzilgan legacy cookie (JSON emas) -> yiqilmasdan redirect qiladi", () => {
    const res = middleware(req("/dashboard", { cookie: "agentnet_user=not-valid-base64-json" }));
    expect(res.status).toBe(307);
  });
});

describe("middleware — /api/backend/* proksi (BFF)", () => {
  it("token'ni Authorization sarlavhasi sifatida qo'shadi va NestJS API'ga rewrite qiladi", () => {
    const res = middleware(
      req("/api/backend/agents", { cookie: "agentnet_token=my.jwt.token" }),
    );
    // NextResponse.rewrite — asl javob emas, lekin qayta yozilgan so'rov sarlavhalarini o'qiy olamiz
    const rewrittenUrl = res.headers.get("x-middleware-rewrite");
    expect(rewrittenUrl).toBe("http://localhost:3001/api/agents");
    expect(res.headers.get("x-middleware-request-authorization")).toBe("Bearer my.jwt.token");
  });

  it("query-parametrlarni saqlab qoladi", () => {
    const res = middleware(
      req("/api/backend/agents", { cookie: "agentnet_token=t", search: "?agentId=a1" }),
    );
    expect(res.headers.get("x-middleware-rewrite")).toBe("http://localhost:3001/api/agents?agentId=a1");
  });

  it("token'siz so'rovda Authorization sarlavhasi QO'SHILMAYDI (NestJS guard 401 qaytaradi)", () => {
    const res = middleware(req("/api/backend/agents"));
    expect(res.headers.get("x-middleware-request-authorization")).toBeNull();
    // Baribir proksilanadi — auth-qaror middleware'da EMAS, API guard'da
    expect(res.headers.get("x-middleware-rewrite")).toBe("http://localhost:3001/api/agents");
  });
});

describe("middleware — /api/* (BFF marshrutlari, backend proksi emas)", () => {
  it("/api/session kabi yo'llar sessiyasiz ham o'tkaziladi (o'zi cookie o'rnatadi)", () => {
    const res = middleware(req("/api/session"));
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-rewrite")).toBeNull(); // faqat /api/backend/* rewrite qilinadi
  });
});
