"use client";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useApiClient, unwrapPage, type Page } from "@/lib/api-client";

/**
 * Phase 4 — admin ro'yxatlari uchun yagona kursorli o'qish hook'i.
 *
 * Barcha admin ekranlari shu yerdan foydalanadi: kursor uzatish, sahifalarni
 * birlashtirish va `total` ni olish mantig'i TAKRORLANMAYDI.
 *
 * Server `{ items, nextCursor, hasMore, total }` qaytaradi (Phase 3
 * shartnomasi + admin `total`i).
 */
export interface AdminPage<T> extends Page<T> {
  total: number;
}

export function useAdminList<T>(
  key: readonly unknown[],
  path: string,
  filters: Record<string, string | undefined>,
) {
  const api = useApiClient();

  // Bo'sh/undefined filtrlar so'rovga umuman qo'shilmaydi.
  const params = Object.entries(filters).filter(([, v]) => v !== undefined && v !== "");

  const query = useInfiniteQuery({
    queryKey: [...key, Object.fromEntries(params)],
    queryFn: ({ pageParam }) => {
      const search = new URLSearchParams(params as [string, string][]);
      if (pageParam) search.set("cursor", pageParam);
      const qs = search.toString();
      return api.get<AdminPage<T>>(`${path}${qs ? `?${qs}` : ""}`);
    },
    initialPageParam: "" as string,
    getNextPageParam: (last) => last?.nextCursor ?? undefined,
  });

  const rows = query.data?.pages.flatMap((p) => unwrapPage<T>(p)) ?? [];
  const total = query.data?.pages[0]?.total ?? 0;

  return { ...query, rows, total };
}
