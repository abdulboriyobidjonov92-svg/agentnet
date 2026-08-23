import { SectionMark } from "./section-mark";

/**
 * 08 — BIZNES SSENARIYLARI.
 *
 * NEGA "TEJALGAN VAQT" RAQAMI YO'Q: "14 daqiqa -> 40 soniya" turidagi
 * raqamlarni bugun hech kim o'lchamagan, ya'ni ular o'ylab topilgan
 * bo'lardi. Bu esa aynan "1200+ agent · 99.9% uptime" bandini olib
 * tashlash sababi edi.
 *
 * O'RNIGA UCH ANIQ USTUN: nima ISHGA TUSHIRADI, agent nimaga TEGADI
 * (haqiqiy konnektor id'lari), va oxirida NIMA QOLADI. Bu uchtasi
 * tekshiriladigan gap va ular birgalikda ssenariyni raqamsiz ham
 * tushunarli qiladi.
 */

const SCENARIOS = [
  { key: "order", steps: ["uzum-market.list_orders", "google-sheets.append_row", "payme-merchant.create_receipt"] },
  { key: "claim", steps: ["telegram-bot.get_updates", "bitrix24.create_lead", "smtp-email.send_email"] },
  { key: "month", steps: ["google-sheets.read_range", "soliq-uz.check_debt", "telegram-bot.send_message"] },
] as const;

export function ScenariosSection({ t }: { t: (key: string) => string }) {
  return (
    <section id="scenarios" aria-labelledby="scenarios-title" className="border-b border-border">
      <div className="mx-auto max-w-[1240px] px-5 py-16 sm:px-8 sm:py-24">
        <SectionMark id="scenarios" t={t} />

        <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <h2
            id="scenarios-title"
            className="max-w-2xl font-display text-[clamp(1.75rem,3.4vw,2.5rem)] font-semibold leading-[1.1] tracking-[-0.03em]"
          >
            {t("sc.title")}
          </h2>
          <p className="max-w-md text-[0.9375rem] leading-relaxed text-muted-foreground">
            {t("sc.sub")}
          </p>
        </div>

        <div className="mt-12 grid gap-px border border-border bg-border lg:grid-cols-3">
          {SCENARIOS.map((s) => (
            <article key={s.key} className="flex flex-col bg-[hsl(var(--surface-1))] px-5 py-6 sm:px-6">
              <h3 className="font-display text-[1.25rem] font-medium tracking-[-0.02em]">
                {t(`sc.${s.key}Title`)}
              </h3>

              <p className="mt-4 font-mono text-[0.625rem] uppercase tracking-[0.18em] text-muted-foreground">
                {t("sc.trigger")}
              </p>
              <p className="mt-2 text-[0.875rem] leading-relaxed text-foreground/85">
                {t(`sc.${s.key}Trigger`)}
              </p>

              <p className="mt-5 font-mono text-[0.625rem] uppercase tracking-[0.18em] text-muted-foreground">
                {t("sc.touches")}
              </p>
              <ol className="mt-2 space-y-1.5">
                {s.steps.map((step, i) => (
                  <li key={step} className="flex items-baseline gap-2.5">
                    <span className="font-mono text-[0.625rem] tabular-nums text-muted-foreground/70">
                      {i + 1}
                    </span>
                    <span className="min-w-0 break-all font-mono text-[0.75rem] text-foreground/85">
                      {step}
                    </span>
                  </li>
                ))}
              </ol>

              <p className="mt-5 font-mono text-[0.625rem] uppercase tracking-[0.18em] text-muted-foreground">
                {t("sc.result")}
              </p>
              <p className="mt-2 flex-1 text-[0.875rem] leading-relaxed text-foreground/85">
                {t(`sc.${s.key}Result`)}
              </p>
            </article>
          ))}
        </div>

        {/* Uchala ssenariyda ham pul yoki davlat hujjatiga tegadigan qadam
            tasdiq talab qiladi — buni aytmaslik ssenariyni yolg'on qilardi. */}
        <p className="mt-8 text-[0.875rem] leading-relaxed text-muted-foreground">{t("sc.note")}</p>
      </div>
    </section>
  );
}
