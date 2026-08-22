"use client";

import { useEffect, useRef, useState } from "react";
import type { ExecutionEvent } from "@/components/chat/step-card";

/**
 * UI-4 — bitta ijroning hodisalarini JONLI kuzatadi.
 *
 * Manba: `GET /runs/:runId/stream` (SSE, P0-13). Uzilib qolsa
 * `GET /runs/:runId/events?after=<seq>` bilan teshik TO'LDIRILADI —
 * UI hech qachon "shu yerda nima bo'lganini bilmayman" holatida
 * jimgina qolmaydi.
 *
 * `EventSource` ATAYLAB emas: u maxsus sarlavha yubora olmaydi, bizning
 * auth esa BFF proxy orqali cookie bilan ketadi. Shuning uchun `fetch` +
 * `ReadableStream` — chat oqimida allaqachon ishlatilgan naqsh.
 */
export function useRunEvents(runId: string | null) {
  const [events, setEvents] = useState<ExecutionEvent[]>([]);
  const lastSeq = useRef(0);

  useEffect(() => {
    if (!runId) return;

    // Yangi run — eski qadamlar tozalanadi.
    setEvents([]);
    lastSeq.current = 0;

    const controller = new AbortController();
    let cancelled = false;

    /** Kelgan hodisalarni `seq` bo'yicha dedupe qilib qo'shadi. */
    const append = (incoming: ExecutionEvent[]) => {
      if (!incoming.length) return;
      setEvents((prev) => {
        const seen = new Set(prev.map((e) => e.seq));
        const fresh = incoming.filter((e) => !seen.has(e.seq));
        if (!fresh.length) return prev;
        for (const e of fresh) lastSeq.current = Math.max(lastSeq.current, e.seq);
        return [...prev, ...fresh].sort((a, b) => a.seq - b.seq);
      });
    };

    /** Uzilishdan keyin o'tkazib yuborilganlarni oladi. */
    const backfill = async () => {
      try {
        const res = await fetch(`/api/backend/runs/${runId}/events?after=${lastSeq.current}`, {
          signal: controller.signal,
        });
        if (res.ok) append((await res.json()) as ExecutionEvent[]);
      } catch {
        // Teshik to'ldirilmadi — keyingi urinishda qayta ko'riladi.
      }
    };

    const listen = async () => {
      // Avval tarix (chat qayta yuklangan bo'lsa qadamlar yo'qolmasin),
      // keyin jonli oqim.
      await backfill();
      if (cancelled) return;

      try {
        const res = await fetch(`/api/backend/runs/${runId}/stream`, {
          headers: { Accept: "text/event-stream" },
          signal: controller.signal,
        });
        if (!res.ok || !res.body) return;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const raw = line.slice(5).trim();
            if (!raw) continue;
            try {
              append([JSON.parse(raw) as ExecutionEvent]);
            } catch {
              // yaroqsiz satr — o'tkazib yuboramiz
            }
          }
        }
      } catch {
        // Oqim uzildi (uzilish, navigatsiya) — quyida oxirgi backfill.
      }

      // Oqim tugadi: yakuniy hodisalar SSE'dan keyin yozilgan bo'lishi
      // mumkin, shuning uchun oxirida bir marta to'ldiramiz.
      if (!cancelled) await backfill();
    };

    void listen();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [runId]);

  return events;
}
