import { Plug, MousePointerClick, ShieldCheck, type LucideIcon } from "lucide-react";
import { Section, SectionHead, GlowCard, IconChip } from "./ui";

/**
 * HOW IT WORKS — uch qadam.
 *
 * BU YERDA RAQAMLASH O'RINLI: uchta qadam haqiqiy ketma-ketlik
 * (birinchisisiz ikkinchisi ma'nosiz), ya'ni raqam ma'lumot beradi.
 * Sahifaning boshqa joyida dekorativ raqam ishlatilmaydi.
 *
 * Matnlar `c.*` kalitlaridan — onboarding oqimi bilan bir xil manba,
 * ya'ni sahifa va mahsulot bir xil gapni aytadi.
 */

const STEPS: { n: string; key: string; Icon: LucideIcon }[] = [
  { n: "01", key: "s1", Icon: Plug },
  { n: "02", key: "s2", Icon: MousePointerClick },
  { n: "03", key: "s3", Icon: ShieldCheck },
];

export function HowItWorks({ t }: { t: (key: string) => string }) {
  return (
    <Section id="how" labelledBy="how-title">
      <SectionHead eyebrow={t("how.eyebrow")} title={t("c.title")} sub={t("c.sub")} />

      <ol className="mt-14 grid gap-5 md:grid-cols-3">
        {STEPS.map(({ n, key, Icon }) => (
          <li key={n}>
            <GlowCard className="h-full">
              <div className="flex items-start justify-between gap-4">
                <IconChip>
                  <Icon className="h-5 w-5" aria-hidden />
                </IconChip>
                <span className="font-mono text-[0.75rem] tabular-nums tracking-[0.18em] text-white/25">
                  {n}
                </span>
              </div>
              <h3 className="mt-5 font-display text-[1.1875rem] font-medium tracking-[-0.02em] text-white">
                {t(`c.${key}Title`)}
              </h3>
              <p className="mt-2.5 text-[0.875rem] leading-relaxed text-white/55">
                {t(`c.${key}Body`)}
              </p>
            </GlowCard>
          </li>
        ))}
      </ol>
    </Section>
  );
}
