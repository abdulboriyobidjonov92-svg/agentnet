import { SectionMark } from "./section-mark";

/**
 * 04 — AGENT YARATISH OQIMI: Ulang -> Tanlang -> Tasdiqlang.
 *
 * BU YERDA RAQAMLASH O'RINLI: uchta qadam haqiqiy KETMA-KETLIK
 * (birinchisisiz ikkinchisi ma'nosiz), ya'ni raqam ma'lumot beradi.
 * Sahifaning boshqa joyida dekorativ `01/02/03` ishlatilmaydi.
 *
 * Har qadam ostida kichik ARTEFAKT turadi — ikonka emas: ulangan
 * konnektor chiplari, shablon nomi va tasdiq qatori. Foydalanuvchi
 * qadamni o'qimasdan ham nima bo'lishini ko'radi.
 */

const STEPS = [
  { n: "1", key: "s1", artifact: "connectors" },
  { n: "2", key: "s2", artifact: "template" },
  { n: "3", key: "s3", artifact: "approval" },
] as const;

/** Qadam ostidagi kichik artefakt. */
function Artifact({ kind, t }: { kind: string; t: (key: string) => string }) {
  if (kind === "connectors") {
    return (
      <ul className="flex flex-wrap gap-2">
        {["telegram-bot", "google-sheets", "payme-merchant"].map((c) => (
          <li
            key={c}
            className="flex items-center gap-1.5 rounded-[2px] border border-border px-2 py-1 font-mono text-[0.6875rem] text-foreground/85"
          >
            <span
              className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--state-success))]"
              aria-hidden
            />
            {c}
          </li>
        ))}
      </ul>
    );
  }

  if (kind === "template") {
    return (
      <div className="rounded-[2px] border border-border px-3 py-2.5">
        <p className="text-[0.8125rem] text-foreground">{t("c.tplName")}</p>
        <p className="mt-1 font-mono text-[0.6875rem] text-muted-foreground">{t("c.tplTools")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-[2px] border border-[hsl(var(--state-waiting)/0.35)] bg-[hsl(var(--state-waiting)/0.08)] px-3 py-2.5">
      <p className="font-mono text-[0.6875rem] text-foreground/85">
        payme-merchant.create_invoice
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {["c.approve", "c.edit", "c.reject"].map((k, i) => (
          <span
            key={k}
            className={`rounded-[2px] px-2 py-0.5 text-[0.6875rem] ${
              i === 0
                ? "bg-[hsl(var(--cta))] text-white"
                : "border border-border text-muted-foreground"
            }`}
          >
            {t(k)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function CreateFlow({ t }: { t: (key: string) => string }) {
  return (
    <section id="create" aria-labelledby="create-title" className="border-b border-border">
      <div className="mx-auto max-w-[1240px] px-5 py-16 sm:px-8 sm:py-24">
        <SectionMark id="create" t={t} />

        <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <h2
            id="create-title"
            className="max-w-2xl font-display text-[clamp(1.75rem,3.4vw,2.5rem)] font-semibold leading-[1.1] tracking-[-0.03em]"
          >
            {t("c.title")}
          </h2>
          <p className="max-w-md text-[0.9375rem] leading-relaxed text-muted-foreground">
            {t("c.sub")}
          </p>
        </div>

        <ol className="mt-12 grid gap-px border border-border bg-border md:grid-cols-3">
          {STEPS.map((step) => (
            <li key={step.n} className="flex flex-col bg-[hsl(var(--surface-1))] px-5 py-6 sm:px-6">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[0.75rem] tabular-nums text-[hsl(var(--violet-text))]">
                  {step.n}
                </span>
                <h3 className="font-display text-[1.25rem] font-medium tracking-[-0.02em]">
                  {t(`c.${step.key}Title`)}
                </h3>
              </div>
              <p className="mt-3 flex-1 text-[0.875rem] leading-relaxed text-muted-foreground">
                {t(`c.${step.key}Body`)}
              </p>
              <div className="mt-5">
                <Artifact kind={step.artifact} t={t} />
              </div>
            </li>
          ))}
        </ol>

        {/* Haqiqiy imtiyoz — o'ylab topilgan aksiya emas: birinchi agentning
            yaratish narxi kodda kechiriladi (`priceForAgent`, UI-2 qarori). */}
        <p className="mt-8 font-mono text-[0.75rem] text-muted-foreground">{t("c.freeNote")}</p>
      </div>
    </section>
  );
}
