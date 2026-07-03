// Lokal sessiya (Clerk'siz). Cookie'да base64(JSON) sifatida saqlanadi,
// shunda middleware (server) ham, komponentlar (client) ham o'qiy oladi.

export interface Session {
  userId: string;
  email: string;
  phone?: string;
  name?: string;
}

const COOKIE = "agentnet_user";

export function encodeSession(s: Session): string {
  return typeof window === "undefined"
    ? Buffer.from(JSON.stringify(s)).toString("base64")
    : btoa(unescape(encodeURIComponent(JSON.stringify(s))));
}

export function decodeSession(raw: string | undefined | null): Session | null {
  if (!raw) return null;
  try {
    const json =
      typeof window === "undefined"
        ? Buffer.from(raw, "base64").toString("utf-8")
        : decodeURIComponent(escape(atob(raw)));
    const s = JSON.parse(json);
    return s?.userId ? s : null;
  } catch {
    return null;
  }
}

// ---- Client tomonda ----

export function getClientSession(): Session | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${COOKIE}=`));
  return decodeSession(match?.split("=")[1]);
}

export function setClientSession(s: Session): void {
  const val = encodeSession(s);
  document.cookie = `${COOKIE}=${val}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
}

export function clearClientSession(): void {
  document.cookie = `${COOKIE}=; path=/; max-age=0`;
}

export const SESSION_COOKIE = COOKIE;
