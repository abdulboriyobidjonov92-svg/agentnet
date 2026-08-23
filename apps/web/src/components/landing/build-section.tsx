import { SectionMark } from "./section-mark";
import { BuildWith } from "./build-with";

/**
 * 03 — bo'lim qobig'i (server) + interaktiv qismi (klient).
 *
 * Ajratilishining sababi: sarlavha va matn server'da render qilinadi
 * (SEO va JS'siz ham o'qiladi), faqat soha tanlagich klientga tushadi.
 */
export function BuildSection({ t }: { t: (key: string) => string }) {
  return (
    <section id="build" aria-labelledby="build-title" className="border-b border-border">
      <div className="mx-auto max-w-[1240px] px-5 py-16 sm:px-8 sm:py-24">
        <SectionMark id="build" t={t} />

        <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <h2
            id="build-title"
            className="max-w-2xl font-display text-[clamp(1.75rem,3.4vw,2.5rem)] font-semibold leading-[1.1] tracking-[-0.03em]"
          >
            {t("b.title")}
          </h2>
          <p className="max-w-md text-[0.9375rem] leading-relaxed text-muted-foreground">
            {t("b.sub")}
          </p>
        </div>

        <BuildWith />
      </div>
    </section>
  );
}
