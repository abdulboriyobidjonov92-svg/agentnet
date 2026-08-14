"use client";
import { useState, useRef, useEffect } from "react";
import { Globe, Check } from "lucide-react";
import { useT, LOCALES } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/**
 * `placement` — menyu qaysi tomonga ochiladi.
 *
 * NEGA KERAK (telefon xatosi, 2026-08-14): switcher sidebar'ning ENG PASTIDA
 * turadi, menyu esa har doim PASTGA (`mt-2`) ochilardi — ya'ni u ekran
 * tagiga tushib, ro'yxat kesilib qolardi va yuqoriga ko'tarilmasdi.
 * Sidebar endi `up` beradi; sahifa tepasidagi ishlatishlar (landing,
 * auth-shell) avvalgidek pastga ochiladi.
 */
export function LanguageSwitcher({
  variant = "light",
  placement = "down",
}: {
  variant?: "light" | "dark";
  placement?: "down" | "up";
}) {
  const { locale, setLocale } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          // `min-h-11` — Apple/Material'ning 44px teginish o'lchami: barmoq
          // bilan aniq tegish uchun eng kichik xavfsiz nishon.
          "flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition",
          variant === "dark"
            ? "border-white/20 text-white/90 hover:bg-white/10"
            : "border-border bg-card hover:bg-muted",
        )}
      >
        <Globe className="h-4 w-4 shrink-0" />
        {/* Bayroq endi telefonda ham ko'rinadi — `hidden sm:inline` uni
            aynan kichik ekranda yashirar edi, holbuki joy yetarli. */}
        <span>{current.flag}</span>
        <span className="uppercase">{current.code}</span>
      </button>

      {open && (
        <div
          role="listbox"
          className={cn(
            "absolute z-50 w-44 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border bg-popover p-1 shadow-lift",
            // Tekislash joylashuvga bog'liq: "down" — sahifa TEPA-O'NGIDA
            // ishlatiladi (o'ngga tekislanadi, aks holda o'ng chetdan
            // chiqib ketardi), "up" — sidebar'ning chap ustunida.
            placement === "up" ? "bottom-full left-0 mb-2" : "right-0 top-full mt-2",
          )}
        >
          {LOCALES.map((l) => (
            <button
              key={l.code}
              onClick={() => {
                setLocale(l.code);
                setOpen(false);
              }}
              role="option"
              aria-selected={l.code === locale}
              className={cn(
                // `min-h-11` — barmoq uchun xavfsiz teginish nishoni (44px).
                "flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-sm transition",
                l.code === locale ? "bg-accent text-accent-foreground" : "hover:bg-muted",
              )}
            >
              <span className="shrink-0 text-base">{l.flag}</span>
              <span className="min-w-0 flex-1 truncate text-left">{l.label}</span>
              {l.code === locale && <Check className="h-4 w-4 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
