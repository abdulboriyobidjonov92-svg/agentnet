import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SectionMark } from "./section-mark";

/**
 * 05 — MARKETPLACE.
 *
 * NARXLAR VA NOMLAR O'YLAB TOPILMAGAN: oltitasi ham
 * `apps/api/src/templates/registry.ts` dan (jami 20 ta kasbiy shablon).
 * Narx `createUsd` maydonining aynan o'zi — landing va katalog bir xil
 * raqamni ko'rsatishi shart, aks holda birinchi bosishdayoq ishonch
 * yo'qoladi.
 *
 * KREATOR QATORI EHTIYOTKOR YOZILGAN: payout kanali hali ulanmagan
 * (LAUNCH.md §5), shuning uchun "pul ishlang" emas — "daromad hisobingizda
 * yig'iladi" deyiladi. Bu haqiqat va uni bo'yab ko'rsatish keyin
 * qaytib tegardi.
 */

const TEMPLATES = [
  { id: "shop-owner", usd: 70 },
  { id: "restaurant", usd: 50 },
  { id: "delivery", usd: 50 },
  { id: "doctor", usd: 45 },
  { id: "accounting", usd: 35 },
  { id: "photographer", usd: 30 },
] as const;

export function MarketplaceSection({ t }: { t: (key: string) => string }) {
  return (
    <section id="market" aria-labelledby="market-title" className="border-b border-border">
      <div className="mx-auto max-w-[1240px] px-5 py-16 sm:px-8 sm:py-24">
        <SectionMark id="market" t={t} />

        <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <h2
            id="market-title"
            className="max-w-2xl font-display text-[clamp(1.75rem,3.4vw,2.5rem)] font-semibold leading-[1.1] tracking-[-0.03em]"
          >
            {t("m.title")}
          </h2>
          <p className="max-w-md text-[0.9375rem] leading-relaxed text-muted-foreground">
            {t("m.sub")}
          </p>
        </div>

        <ul className="mt-12 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATES.map((tpl) => (
            <li
              key={tpl.id}
              className="flex items-baseline justify-between gap-4 bg-[hsl(var(--surface-1))] px-5 py-5 sm:px-6"
            >
              <span className="text-[0.9375rem] text-foreground">{t(`m.${tpl.id}`)}</span>
              <span className="shrink-0 font-mono text-[0.8125rem] tabular-nums text-muted-foreground">
                ${tpl.usd}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-[0.875rem] leading-relaxed text-muted-foreground">
            {t("m.creator")}
          </p>
          <Link
            href="/marketplace"
            className="group inline-flex shrink-0 items-center gap-2 text-[0.9375rem] font-medium text-[hsl(var(--violet-text))] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--background))]"
          >
            {t("m.all")}
            <ArrowRight
              className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
              aria-hidden
            />
          </Link>
        </div>
      </div>
    </section>
  );
}
