import { Brain, Code2, BarChart3, Cog, Eye, Link2, type LucideIcon } from "lucide-react";
import { Section, SectionHead, GlowCard, IconChip } from "./ui";

/**
 * OUR SOLUTIONS — olti karta.
 *
 * KONTENT O'YLAB TOPILMAGAN: oltita karta hero'dagi orbitaning aynan
 * o'sha oltita imkoniyati (AQL, KOD, TAHLIL, AVTOMATLASHTIRISH, KO'RISH,
 * ULANISHLAR) va matnlari ham o'sha `orb.*` kalitlaridan. Ya'ni
 * tashrifchi orbitada sferaga bosib o'qigan izohni bu yerda kengaytirilgan
 * holda ko'radi — ikkita alohida ro'yxat emas, bitta g'oyaning ikki
 * ko'rinishi.
 */

const ITEMS: { id: string; Icon: LucideIcon }[] = [
  { id: "intelligence", Icon: Brain },
  { id: "connectors", Icon: Link2 },
  { id: "code", Icon: Code2 },
  { id: "analytics", Icon: BarChart3 },
  { id: "automation", Icon: Cog },
  { id: "vision", Icon: Eye },
];

export function Solutions({ t }: { t: (key: string) => string }) {
  return (
    <Section id="solutions" labelledBy="solutions-title">
      <SectionHead
        eyebrow={t("sol.eyebrow")}
        title={t("sol.title")}
        sub={t("sol.sub")}
      />

      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map(({ id, Icon }) => (
          <GlowCard key={id}>
            <IconChip>
              <Icon className="h-5 w-5" aria-hidden />
            </IconChip>
            <h3 className="mt-5 font-display text-[1.1875rem] font-medium tracking-[-0.02em] text-white">
              {t(`orb.${id}`)}
            </h3>
            <p className="mt-2.5 text-[0.875rem] leading-relaxed text-white/55">
              {t(`orb.${id}Desc`)}
            </p>
          </GlowCard>
        ))}
      </div>
    </Section>
  );
}
