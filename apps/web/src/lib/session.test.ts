import { describe, expect, it } from "vitest";
import { decodeSession, encodeSession, tokenPayload, type Session } from "./session";

// Standart Vitest environment — "node" (vitest.config.ts) — `window` aniqlanmagan,
// shuning uchun encodeSession/decodeSession server (Buffer) yo'lidan o'tadi.

describe("encodeSession / decodeSession — server (Buffer) yo'li", () => {
  it("round-trip: encode qilingan sessiya aynan o'zi bilan decode qilinadi", () => {
    const session: Session = { userId: "u1", email: "a@b.com", name: "Ali" };
    expect(decodeSession(encodeSession(session))).toEqual(session);
  });

  it("userId'siz obyekt decode qilinganda null qaytaradi (halol sessiya emas)", () => {
    const encoded = Buffer.from(JSON.stringify({ email: "a@b.com" })).toString("base64");
    expect(decodeSession(encoded)).toBeNull();
  });

  it("yaroqsiz base64/JSON -> null (yiqilmaydi)", () => {
    expect(decodeSession("not-valid-base64-json!!!")).toBeNull();
  });

  it("undefined/null/bo'sh qiymat -> null", () => {
    expect(decodeSession(undefined)).toBeNull();
    expect(decodeSession(null)).toBeNull();
    expect(decodeSession("")).toBeNull();
  });
});

describe("tokenPayload — imzosiz JWT payload o'qish (faqat BFF uchun)", () => {
  function fakeJwt(payload: Record<string, unknown>, header: Record<string, unknown> = { alg: "HS256" }): string {
    const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
    return `${enc(header)}.${enc(payload)}.fake-signature`;
  }

  it("3-qismli tokendan payload'ni o'qiydi (imzo tekshirilmaydi)", () => {
    const token = fakeJwt({ sub: "u1", email: "a@b.com", exp: 123 });
    expect(tokenPayload(token)).toEqual({ sub: "u1", email: "a@b.com", exp: 123 });
  });

  it("sub yo'q bo'lsa -> null (BFF user_id'siz engine'ga bora olmaydi)", () => {
    const token = fakeJwt({ email: "a@b.com" });
    expect(tokenPayload(token)).toBeNull();
  });

  it("sub bo'sh satr bo'lsa -> null", () => {
    const token = fakeJwt({ sub: "" });
    expect(tokenPayload(token)).toBeNull();
  });

  it("3 qismdan iborat bo'lmagan token -> null", () => {
    expect(tokenPayload("faqat-bitta-qism")).toBeNull();
    expect(tokenPayload("ikki.qism")).toBeNull();
    expect(tokenPayload("bitta.ikki.uch.tort")).toBeNull();
  });

  it("o'rtadagi qism yaroqsiz base64url/JSON bo'lsa -> null", () => {
    expect(tokenPayload("header.###notbase64###.sig")).toBeNull();
  });

  it("null/undefined -> null", () => {
    expect(tokenPayload(null)).toBeNull();
    expect(tokenPayload(undefined)).toBeNull();
  });
});
