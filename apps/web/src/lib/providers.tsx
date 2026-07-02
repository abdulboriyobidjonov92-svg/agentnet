"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { LanguageProvider } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/dictionary";

/**
 * Global suyuq to'lqin (ripple) — har bir button/link bosishida.
 * Delegatsiyalangan bitta listener; prefers-reduced-motion hurmat qilinadi.
 */
function useGlobalRipple() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = (e.target as HTMLElement)?.closest?.("button, a[href]") as HTMLElement | null;
      if (!target || target.classList.contains("no-ripple")) return;
      const rect = target.getBoundingClientRect();
      if (rect.width === 0 || rect.width > 600) return;
      target.classList.add("ripple-host");
      const ink = document.createElement("span");
      const size = Math.max(rect.width, rect.height);
      ink.className = "ripple-ink";
      ink.style.width = ink.style.height = `${size}px`;
      ink.style.left = `${e.clientX - rect.left - size / 2}px`;
      ink.style.top = `${e.clientY - rect.top - size / 2}px`;
      target.appendChild(ink);
      setTimeout(() => ink.remove(), 700);
    };
    document.addEventListener("pointerdown", onPointerDown, { passive: true });
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);
}

export function Providers({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } }),
  );
  useGlobalRipple();
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider initialLocale={initialLocale}>{children}</LanguageProvider>
    </QueryClientProvider>
  );
}
