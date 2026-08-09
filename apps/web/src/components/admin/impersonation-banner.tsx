"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Loader2, LogOut } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import {
  IMPERSONATION_META_COOKIE,
  decodeImpersonationMeta,
  type ImpersonationMeta,
} from "@/lib/session";

/**
 * SEC-12 §18/§19 — IMPERSONATION BANNERI.
 *
 * Talab: "visually impossible to confuse with a normal user session".
 * Shuning uchun bu subtil matn emas — butun ekran kengligidagi, eng
 * yuqorida turadigan (`z-[100]`, admin qatoridan ham tepada), qizil
 * amber-ogohlantirish chizig'i. U SCROLL bilan ketmaydi (`sticky`) va
 * har sahifada ko'rinadi (dashboard layout'ida).
 *
 * §19 — QOLGAN VAQT jonli ko'rsatiladi. LEKIN: brauzer taymeri faqat UX.
 * Server har so'rovda muddatni o'zi tekshiradi va o'tgan bo'lsa 401
 * beradi. Taymer nolga yetganda bu komponent holatni TOZALAYDI va
 * operatorni admin paneliga qaytaradi — ya'ni "muddati o'tgan, lekin
 * hali ham impersonation ko'rinishidagi" ekran qolmaydi.
 */

function readMeta(): ImpersonationMeta | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${IMPERSONATION_META_COOKIE}=`));
  if (!match) return null;
  const raw = match.slice(IMPERSONATION_META_COOKIE.length + 1);
  try {
    return decodeImpersonationMeta(decodeURIComponent(raw));
  } catch {
    return decodeImpersonationMeta(raw);
  }
}

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function ImpersonationBanner() {
  const { t } = useT();
  const router = useRouter();
  const [meta, setMeta] = useState<ImpersonationMeta | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [stopping, setStopping] = useState(false);

  // Cookie faqat klientda o'qiladi (SSR'da mos kelmasligi oldini olish).
  useEffect(() => setMeta(readMeta()), []);

  const stop = useCallback(
    async (impersonationId: string) => {
      setStopping(true);
      try {
        await fetch(`/api/impersonation?id=${encodeURIComponent(impersonationId)}`, {
          method: "DELETE",
        });
      } finally {
        setMeta(null);
        // To'liq qayta yuklash: RSC keshida nishonning ma'lumoti qolmasin.
        window.location.href = "/admin/users";
      }
    },
    [],
  );

  useEffect(() => {
    if (!meta) return;
    const expiry = new Date(meta.expiresAt).getTime();

    const tick = () => {
      const left = expiry - Date.now();
      setRemaining(left);
      if (left <= 0) {
        // §19 — muddat tugadi: holat tozalanadi, operator xavfsiz ekranga.
        void stop(meta.impersonationId);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [meta, stop]);

  if (!meta) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="sticky top-0 z-[100] flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b-2 border-danger bg-danger px-4 py-2.5 text-white shadow-[0_8px_30px_rgba(0,0,0,0.6)]"
    >
      <div className="flex min-w-0 items-center gap-3">
        <Eye className="h-5 w-5 shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-bold uppercase tracking-wider">
            {t("imp.bannerTitle")}
          </p>
          <p className="truncate text-xs text-white/90">
            {t("imp.bannerBody").replace("{email}", meta.targetEmail)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="rounded-lg bg-black/30 px-2 py-1 text-xs font-semibold uppercase tracking-wider">
          {t("imp.readOnly")}
        </span>
        <span
          className="nums tabular-nums rounded-lg bg-black/30 px-2 py-1 text-sm font-bold"
          aria-label={t("imp.remaining")}
        >
          {formatRemaining(remaining)}
        </span>
        <button
          type="button"
          onClick={() => stop(meta.impersonationId)}
          disabled={stopping}
          className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-danger transition hover:bg-white/90 disabled:opacity-60"
        >
          {stopping ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <LogOut className="h-3.5 w-3.5" />
          )}
          {t("imp.stop")}
        </button>
      </div>
    </div>
  );
}
