"use client";
import { useCallback } from "react";

// Barcha API chaqiruvlari same-origin /api/backend/* orqali boradi — middleware
// httpOnly cookie'dagi tokenni Authorization header sifatida qo'shib, so'rovni
// NestJS API'ga proxy qiladi. Brauzer JS'i tokenni umuman ko'rmaydi (XSS
// himoyasi); shu sabab bu yerda getClientSession/Authorization YO'Q.
const API_BASE = "/api/backend";

/**
 * Phase 3 — kursorli pagination shartnomasi (Engineering Contract A18).
 * Har ro'yxat endpointi shu konvertni qaytaradi.
 */
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Ro'yxat javobidan qatorlarni ochadi.
 *
 * NEGA massiv shoxi ham bor (vaqtinchalik): frontend Vercel'da, API Render'da —
 * ular MUSTAQIL deploy bo'ladi (ADR-021). Deploy oynasida yangi frontend hali
 * konvert qaytarmaydigan eski API'ga urilishi mumkin; usiz sahifa oq ekran
 * berardi. Barcha muhitlarda konvertli API jonli bo'lgach, massiv shoxi
 * o'chiriladi (Qoida #39: mos-kelish shoxi 2 sprintdan ortiq yashamaydi).
 */
export function unwrapPage<T>(res: Page<T> | T[]): T[] {
  return Array.isArray(res) ? res : (res?.items ?? []);
}

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
  // SEC-12 §20 — impersonation cheklovlari MARKAZLASHGAN joyda tushuntiriladi.
  //
  // NEGA har bir tugmani alohida o'chirib chiqmadik: mutatsiya boshqaruvlari
  // ro'yxatini frontendda qo'lda saqlash — eskiradigan ro'yxat (yangi tugma
  // qo'shilganda unutiladi). Server esa YOZISHNI METOD darajasida to'liq rad
  // etadi, ya'ni har qanday mutatsiya baribir 403 oladi va foydalanuvchi
  // AYNAN shu yerda aniq sabab ko'radi.
  if (reason === "impersonation_read_only") return t("imp.readOnlyBlocked");
  if (reason === "impersonation_forbidden_resource") return t("imp.forbiddenResource");
  if (reason === "impersonation_privileged_route") return t("imp.readOnlyBlocked");
  if (
    reason === "impersonation_expired" ||
    reason === "impersonation_ended" ||
    reason === "impersonation_revoked"
  ) {
    return t("imp.expired");
  }
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
