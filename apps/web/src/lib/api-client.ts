"use client";
import { useCallback } from "react";
import { getClientSession } from "@/lib/session";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

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
      const session = getClientSession();
      const res = await fetch(`${API_URL}/api${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
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
    getPublic: <T>(path: string) =>
      fetch(`${API_URL}/api${path}`).then((r) => r.json()) as Promise<T>,
    post: <T>(path: string, body: unknown) =>
      request<T>(path, { method: "POST", body: JSON.stringify(body) }),
    patch: <T>(path: string, body: unknown) =>
      request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
    delete: (path: string) => request(path, { method: "DELETE" }),
  };
}
