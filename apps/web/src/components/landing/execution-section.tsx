import { SectionMark } from "./section-mark";
import { ApprovalDemo } from "./approval-demo";

/**
 * 07 — IJRO OQIMI.
 *
 * Bo'lim ikki qismdan iborat: yuqorida — sahifaning o'z ijrosi to'xtaydigan
 * tasdiq lahzasi (`ApprovalDemo`, klient), pastda — ijro qaysi yuzalarda
 * kechishi (server).
 *
 * PASTKI UCH USTUN EHTIYOTKOR YOZILGAN. Har biri bugungi holatni aytadi,
 * kelajakni emas: ko'p agent (`agentos` moduli), brauzer (Playwright +
 * SEC-07 allowlist), qurilma (companion protokoli — sessiya foydalanuvchi
 * qurilmasida qoladi). Bo'yab ko'rsatilgan da'vo birinchi sinovdayoq
 * qaytib tegardi.
 */

const SURFACES = ["multi", "browser", "device"] as const;

export function ExecutionSection({ t }: { t: (key: string) => string }) {
  return (
    <section id="execution" aria-labelledby="execution-title" className="border-b border-border">
      <div className="mx-auto max-w-[1240px] px-5 py-16 sm:px-8 sm:py-24">
        <SectionMark id="execution" t={t} />

        <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <h2
            id="execution-title"
            className="max-w-2xl font-display text-[clamp(1.75rem,3.4vw,2.5rem)] font-semibold leading-[1.1] tracking-[-0.03em]"
          >
            {t("x.title")}
          </h2>
          <p className="max-w-md text-[0.9375rem] leading-relaxed text-muted-foreground">
            {t("x.sub")}
          </p>
        </div>

        <ApprovalDemo />

        <dl className="mt-6 grid gap-px border border-border bg-border md:grid-cols-3">
          {SURFACES.map((s) => (
            <div key={s} className="bg-[hsl(var(--surface-1))] px-5 py-6 sm:px-6">
              <dt className="font-mono text-[0.625rem] uppercase tracking-[0.2em] text-muted-foreground">
                {t(`x.${s}Label`)}
              </dt>
              <dd className="mt-3 text-[0.875rem] leading-relaxed text-muted-foreground">
                {t(`x.${s}Body`)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
