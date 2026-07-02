"use client";
import { useCallback } from "react";
import { getClientSession } from "@/lib/session";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function useApiClient() {
  const request = useCallback(
    async <T>(path: string, options: RequestInit = {}): Promise<T> => {
      const session = getClientSession();
      const res = await fetch(`${API_URL}/api${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(session ? { Authorization: `Bearer ${session.userId}` } : {}),
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
