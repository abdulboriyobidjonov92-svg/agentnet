import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { DELETE, POST } from "./route";
import { SESSION_COOKIE, TOKEN_COOKIE, decodeSession } from "@/lib/session";

function postReq(body: unknown) {
  return new NextRequest("https://app.agentnet.uz/api/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const ORIGINAL_ENV = process.env.NODE_ENV;
function setNodeEnv(value: string) {
  Object.assign(process.env, { NODE_ENV: value });
}
afterEach(() => {
  setNodeEnv(ORIGINAL_ENV);
});

describe("POST /api/session — validatsiya", () => {
  it("token 3-qismli JWT shaklida bo'lmasa -> 400, cookie o'rnatilmaydi", async () => {
    const res = await POST(postReq({ token: "not-a-jwt", userId: "u1" }));
    expect(res.status).toBe(400);
    expect(res.cookies.get(TOKEN_COOKIE)).toBeUndefined();
  });

  it("userId yo'q bo'lsa -> 400", async () => {
    const res = await POST(postReq({ token: "a.b.c" }));
    expect(res.status).toBe(400);
  });

  it("body butunlay yaroqsiz JSON bo'lsa -> yiqilmasdan 400", async () => {
    const req = new NextRequest("https://app.agentnet.uz/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not valid json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/session — muvaffaqiyatli login", () => {
  it("httpOnly token cookie'si va JS-o'qiladigan profil-cookie o'rnatiladi", async () => {
    const res = await POST(postReq({ token: "a.b.c", userId: "u1", email: "a@b.com", name: "Ali" }));

    expect(res.status).toBe(200);

    const tokenCookie = res.cookies.get(TOKEN_COOKIE)!;
    expect(tokenCookie.value).toBe("a.b.c");
    expect(tokenCookie.httpOnly).toBe(true);

    const profileCookie = res.cookies.get(SESSION_COOKIE)!;
    expect(profileCookie.httpOnly).toBeFalsy();
    expect(decodeSession(profileCookie.value)).toEqual({ userId: "u1", email: "a@b.com", name: "Ali" });
  });

  it("token MAYDONI profil-cookie ICHIGA yozilmaydi (faqat httpOnly cookie'da)", async () => {
    const res = await POST(postReq({ token: "a.b.c", userId: "u1", email: "a@b.com" }));
    const profileCookie = res.cookies.get(SESSION_COOKIE)!;
    const decoded = decodeSession(profileCookie.value);
    expect(decoded).not.toHaveProperty("token");
  });

  it("phone/name berilmasa profilga qo'shilmaydi (undefined qoladi)", async () => {
    const res = await POST(postReq({ token: "a.b.c", userId: "u1" }));
    const decoded = decodeSession(res.cookies.get(SESSION_COOKIE)!.value);
    expect(decoded?.phone).toBeUndefined();
    expect(decoded?.name).toBeUndefined();
    expect(decoded?.email).toBe("");
  });

  it("dev/test rejimida cookie 'secure' emas, prod'da 'secure'", async () => {
    setNodeEnv("development");
    const devRes = await POST(postReq({ token: "a.b.c", userId: "u1" }));
    expect(devRes.cookies.get(TOKEN_COOKIE)!.secure).toBeFalsy();

    setNodeEnv("production");
    const prodRes = await POST(postReq({ token: "a.b.c", userId: "u1" }));
    expect(prodRes.cookies.get(TOKEN_COOKIE)!.secure).toBe(true);
  });
});

describe("DELETE /api/session — logout", () => {
  it("ikkala cookie'ni ham tozalaydi (max-age=0)", async () => {
    const res = await DELETE();
    expect(res.status).toBe(200);
    expect(res.cookies.get(TOKEN_COOKIE)!.value).toBe("");
    expect(res.cookies.get(SESSION_COOKIE)!.value).toBe("");
  });
});
