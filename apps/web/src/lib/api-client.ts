"use client";
import { useCallback } from "react";

// Barcha API chaqiruvlari same-origin /api/backend/* orqali boradi — middleware
// httpOnly cookie'dagi tokenni Authorization header sifatida qo'shib, so'rovni
// NestJS API'ga proxy qiladi. Brauzer JS'i tokenni umuman ko'rmaydi (XSS
// himoyasi); shu sabab bu yerda getClientSession/Authorization YO'Q.
const API_BASE = "/api/backend";

interface ApiErrorPayload {
  reason?: string;
  creationPriceSom?: number;
  limit?: number;
}

/**
 * Backend xato-xabarlari (message) doim o'zbekcha keladi — chetdan kelgan matnni
 * to'g'ridan-to'g'ri ko'rsatish tanlangan UI tilini buzadi. `reason` kodi bo'lsa,
 * o'rniga tarjima qilingan matn quramiz; bo'lmasa xom `message`ga tushamiz.
 */
export function apiErrorMessage(err: unknown, t: (key: string) => string): string {
  const e = err as { message?: string; payload?: ApiErrorPayload } | undefined;
  const reason = e?.payload?.reason;
  if (reason === "engine_unavailable") return t("common.engineUnavailable");
  if (reason === "insufficient_balance" && e?.payload?.creationPriceSom != null) {
    return t("common.insufficientBalance").replace(
      "{price}",
      e.payload.creationPriceSom.toLocaleString("ru-RU"),
    );
  }
  if (reason === "agent_limit" && e?.payload?.limit != null) {
    return t("common.agentLimitReached").replace("{limit}", String(e.payload.limit));
  }
  return e?.message ?? t("common.error");
}

/** Ethics Guard blokladi — sabab bo'lsa ko'rsatamiz, aks holda umumiy xabar. */
export function blockedMessage(
  reason: string | null | undefined,
  t: (key: string) => string,
  keys: { plain: string; withReason: string } = { plain: "filter.blocked", withReason: "filter.blockedReason" },
): string {
  return reason ? t(keys.withReason).replace("{reason}", reason) : t(keys.plain);
}

export function useApiClient() {
  const request = useCallback(
    async <T>(path: string, options: RequestInit = {}): Promise<T> => {
      const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        const e = new Error(err.message ?? err.reason ?? "API xatosi") as Error & {
          payload?: unknown;
          status?: number;
        };
        e.payload = err;
        e.status = res.status;
        throw e;
      }
      if (res.status === 204) return undefined as T;
      return res.json();
    },
    [],
  );

  return {
    get: <T>(path: string) => request<T>(path),
    getPublic: async <T>(path: string): Promise<T> => {
      // `request` bilan bir xil xato-ishlovi: non-OK javob DATA sifatida
      // qaytmasligi kerak (aks holda React Query uni "muvaffaqiyat" deb bilib,
      // keyin `.map` render'da yiqiladi va sahifa oqarib qoladi).
      const res = await fetch(`${API_BASE}${path}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        const e = new Error(err.message ?? err.reason ?? "API xatosi") as Error & {
          payload?: unknown;
          status?: number;
        };
        e.payload = err;
        e.status = res.status;
        throw e;
      }
      if (res.status === 204) return undefined as T;
      return res.json();
    },
    post: <T>(path: string, body: unknown) =>
      request<T>(path, { method: "POST", body: JSON.stringify(body) }),
    patch: <T>(path: string, body: unknown) =>
      request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
    delete: (path: string) => request(path, { method: "DELETE" }),
  };
}
