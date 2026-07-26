// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearClientSession,
  decodeSession,
  encodeSession,
  getClientSession,
  setClientSession,
  SESSION_COOKIE,
  type Session,
} from "./session";

// jsdom environment — `window`/`document` mavjud, shuning uchun encodeSession/
// decodeSession CLIENT (btoa/atob) yo'lidan o'tadi (session.test.ts server
// Buffer yo'lini sinaydi).

beforeEach(() => {
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0`;
});

describe("encodeSession / decodeSession — client (btoa/atob) yo'li", () => {
  it("round-trip: kirill/o'zbek belgilar bilan ham ishlaydi (unescape/encodeURIComponent)", () => {
    const session: Session = { userId: "u1", email: "a@b.com", name: "Азиз O'ktamov" };
    expect(decodeSession(encodeSession(session))).toEqual(session);
  });

  it("yaroqsiz qiymat -> null (yiqilmaydi)", () => {
    expect(decodeSession("!!!not-base64!!!")).toBeNull();
  });
});

describe("setClientSession / getClientSession — profil-cookie", () => {
  it("o'rnatilgan sessiyani orqaga o'qiydi", () => {
    setClientSession({ userId: "u1", email: "a@b.com", name: "Ali" });
    expect(getClientSession()).toEqual({ userId: "u1", email: "a@b.com", name: "Ali" });
  });

  it("token MAYDONI cookie'ga hech qachon yozilmaydi (XSS himoyasi)", () => {
    setClientSession({ userId: "u1", email: "a@b.com", token: "super-secret-jwt" });
    expect(document.cookie).not.toContain("super-secret-jwt");
    expect(getClientSession()).toEqual({ userId: "u1", email: "a@b.com" });
  });

  it("cookie o'rnatilmagan bo'lsa -> null", () => {
    expect(getClientSession()).toBeNull();
  });

  it("URL-encode qilingan qiymatni to'g'ri decode qiladi (base64 '=' padding saqlanadi)", () => {
    // encodeURIComponent bilan yozilgan qiymat ichida "=" padding bo'lishi mumkin —
    // split("=") emas, slice(prefix.length+1) ishlatilishi shu holatni tekshiradi.
    setClientSession({ userId: "u12345", email: "toshkent@agentnet.app" });
    expect(document.cookie).toContain(`${SESSION_COOKIE}=`);
    expect(getClientSession()?.userId).toBe("u12345");
  });
});

describe("clearClientSession", () => {
  it("profil-cookie'ni tozalaydi", () => {
    setClientSession({ userId: "u1", email: "a@b.com" });
    expect(getClientSession()).not.toBeNull();

    clearClientSession();
    expect(getClientSession()).toBeNull();
  });
});
