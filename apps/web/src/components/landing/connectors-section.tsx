import { SectionMark } from "./section-mark";

/**
 * 06 — KONNEKTORLAR.
 *
 * SECTIONNING TEZISI: raqobatchining slaydida Slack va Notion bor.
 * Bu yerda soliq.uz, my.gov.uz va Didox bor — va aynan shular
 * O'zbekistondagi biznesning kunini o'tkazadi.
 *
 * RO'YXAT REGISTRDAN: quyidagi 17 ta id `apps/api/src/connectors/
 * connectors/` katalogidagi fayllar bilan BIR XIL. Bittasi ham
 * "tez orada" emas — hammasi bugun chaqirilishi mumkin. Registrga
 * yangi konnektor qo'shilsa, bu ro'yxat ham yangilanishi kerak
 * (shuning uchun guruhlar qo'lda, generatsiya emas: landing API'ga
 * bog'lanmaydi).
 */

const GROUPS = [
  { key: "pay", ids: ["payme-merchant", "click-merchant"] },
  { key: "gov", ids: ["soliq-uz", "my-gov-uz", "didox-einvoice"] },
  {
    key: "msg",
    ids: ["telegram-bot", "whatsapp-business", "eskiz-sms", "playmobile-sms", "smtp-email"],
  },
  { key: "commerce", ids: ["uzum-market", "shopify", "woocommerce", "aftership"] },
  { key: "crm", ids: ["bitrix24", "amocrm"] },
  { key: "data", ids: ["google-sheets"] },
] as const;

export function ConnectorsSection({ t }: { t: (key: string) => string }) {
  return (
    <section id="connectors" aria-labelledby="connectors-title" className="border-b border-border">
      <div className="mx-auto max-w-[1240px] px-5 py-16 sm:px-8 sm:py-24">
        <SectionMark id="connectors" t={t} />

        <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <h2
            id="connectors-title"
            className="max-w-2xl font-display text-[clamp(1.75rem,3.4vw,2.5rem)] font-semibold leading-[1.1] tracking-[-0.03em]"
          >
            {t("k.title")}
          </h2>
          <p className="max-w-md text-[0.9375rem] leading-relaxed text-muted-foreground">
            {t("k.sub")}
          </p>
        </div>

        {/* A qatlam — native */}
        <div className="mt-12 border border-border">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-4 sm:px-6">
            <h3 className="font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-muted-foreground">
              {t("k.nativeLabel")}
            </h3>
            <span className="font-mono text-[0.6875rem] tabular-nums text-[hsl(var(--violet-text))]">
              17
            </span>
          </div>

          <dl className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
            {GROUPS.map((g) => (
              <div key={g.key} className="bg-[hsl(var(--surface-1))] px-5 py-5 sm:px-6">
                <dt className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-muted-foreground">
                  {t(`k.${g.key}`)}
                </dt>
                <dd className="mt-3">
                  <ul className="flex flex-wrap gap-1.5">
                    {g.ids.map((id) => (
                      <li
                        key={id}
                        className="rounded-[2px] border border-border px-2 py-1 font-mono text-[0.6875rem] text-foreground/85"
                      >
                        {id}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* B qatlam — brauzer */}
        <div className="mt-6 grid gap-px border border-border bg-border md:grid-cols-[1.1fr_1fr]">
          <div className="bg-[hsl(var(--surface-1))] px-5 py-6 sm:px-6">
            <h3 className="font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-muted-foreground">
              {t("k.browserLabel")}
            </h3>
            <p className="mt-3 font-display text-[1.375rem] font-medium leading-tight tracking-[-0.02em]">
              {t("k.browserTitle")}
            </p>
            <p className="mt-3 text-[0.875rem] leading-relaxed text-muted-foreground">
              {t("k.browserBody")}
            </p>
          </div>

          {/* Chegara ham xususiyat — shuning uchun u yashirilmaydi */}
          <div className="bg-[hsl(var(--surface-1))] px-5 py-6 sm:px-6">
            <h3 className="font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-muted-foreground">
              {t("k.limitLabel")}
            </h3>
            <p className="mt-3 text-[0.875rem] leading-relaxed text-muted-foreground">
              {t("k.limitBody")}
            </p>
            <p className="mt-4 rounded-[2px] border border-border px-3 py-2 font-mono text-[0.6875rem] text-foreground/80">
              AGENT_DOMAIN_ALLOWLIST=&quot;soliq.uz, my.gov.uz, uzum.uz&quot;
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
