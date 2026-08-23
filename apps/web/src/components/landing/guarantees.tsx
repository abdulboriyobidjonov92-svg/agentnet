import { SectionMark } from "./section-mark";

/**
 * 02 — ISHONCH BO'LIMI.
 *
 * NEGA MIJOZ LOGOTIPI VA RAQAM YO'Q: bugun ularning ikkalasi ham yolg'on
 * bo'lardi (mahsulot hali ochiq ishga tushmagan). "1200+ agent · 99.9%
 * uptime" bandi aynan shu sababdan olib tashlangan edi — uni boshqa
 * shaklda qaytarish o'sha qarorni bekor qilardi.
 *
 * O'RNIGA: to'rtta MEXANIZM. Har biri bugun kodda mavjud va tekshirilishi
 * mumkin — audit zanjiri (ADR-008), policy darvozasi va kill switch
 * (P0-6), sarf o'lchovi (P0-5). Ya'ni "bizga ishoning" emas, "mana nima
 * qilib qo'yilgan".
 */

const ITEMS = [
  { key: "audit", value: "g1Value", body: "g1Body" },
  { key: "policy", value: "g2Value", body: "g2Body" },
  { key: "stop", value: "g3Value", body: "g3Body" },
  { key: "cost", value: "g4Value", body: "g4Body" },
] as const;

export function Guarantees({ t }: { t: (key: string) => string }) {
  return (
    <section
      id="guarantees"
      aria-labelledby="guarantees-title"
      className="border-b border-border"
    >
      <div className="mx-auto max-w-[1240px] px-5 py-16 sm:px-8 sm:py-24">
        <SectionMark id="guarantees" t={t} />

        <h2
          id="guarantees-title"
          className="mt-6 max-w-2xl font-display text-[clamp(1.75rem,3.4vw,2.5rem)] font-semibold leading-[1.1] tracking-[-0.03em]"
        >
          {t("g.title")}
        </h2>

        {/* To'rt ustun, faqat 1px chiziq bilan ajratilgan — karta, soya va
            ikonka yo'q. Bu bo'lim "sotmaydi", u ro'yxat qiladi. */}
        <dl className="mt-12 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {ITEMS.map((item) => (
            <div key={item.key} className="bg-[hsl(var(--surface-1))] px-5 py-6 sm:px-6 sm:py-7">
              <dt className="font-mono text-[0.625rem] uppercase tracking-[0.2em] text-muted-foreground">
                {t(`g.${item.key}`)}
              </dt>
              <p className="mt-3 font-display text-[1.375rem] font-medium leading-tight tracking-[-0.02em] text-[hsl(var(--cta-strong))]">
                {t(`g.${item.value}`)}
              </p>
              <dd className="mt-3 text-[0.875rem] leading-relaxed text-muted-foreground">
                {t(`g.${item.body}`)}
              </dd>
            </div>
          ))}
        </dl>

        {/* Model manbai — bitta jim qator. Bu ham da'vo emas, fakt. */}
        <p className="mt-8 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted-foreground/70">
          {t("landing.trusted")}
        </p>
      </div>
    </section>
  );
}
