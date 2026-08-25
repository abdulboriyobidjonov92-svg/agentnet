import { ShieldCheck, Hand, ScrollText, type LucideIcon } from "lucide-react";
import { Section, SectionHead, GlowCard, IconChip } from "./ui";

/**
 * WHY CHOOSE US — uchta nazorat mexanizmi.
 *
 * Ilgari chapda ijro daftari paneli turardi; u founder qarori bilan olib
 * tashlandi. Endi bo'lim to'liq kenglikda: sarlavha markazda, ostida uch
 * karta.
 *
 * MATNLAR `g.*` kalitlaridan — bu kafolatlar ro'yxati bilan bir xil
 * manba, ya'ni sahifada ikki xil va'da paydo bo'lmaydi.
 */

const POINTS: { id: string; body: string; Icon: LucideIcon }[] = [
  { id: "policy", body: "g.g2Body", Icon: ShieldCheck },
  { id: "stop", body: "g.g3Body", Icon: Hand },
  { id: "audit", body: "g.g1Body", Icon: ScrollText },
];

export function WhyChoose({ t }: { t: (key: string) => string }) {
  return (
    <Section id="why" labelledBy="why-title">
      <SectionHead eyebrow={t("why.eyebrow")} title={t("why.title")} sub={t("why.sub")} />

      <div className="mt-14 grid gap-5 md:grid-cols-3">
        {POINTS.map(({ id, body, Icon }) => (
          <GlowCard key={id} className="h-full">
            <IconChip>
              <Icon className="h-5 w-5" aria-hidden />
            </IconChip>
            <h3 className="mt-5 font-display text-[1.1875rem] font-medium tracking-[-0.02em] text-white">
              {t(`g.${id}`)}
            </h3>
            <p className="mt-2.5 text-[0.875rem] leading-relaxed text-white/55">{t(body)}</p>
          </GlowCard>
        ))}
      </div>
    </Section>
  );
}
