import { Check } from "lucide-react";
import { Section, SectionHead, GlowCard } from "./ui";
import { ExecutionLedger } from "./execution-ledger";

/**
 * WHY CHOOSE US — chapda artefakt, o'ngda afzalliklar.
 *
 * CHAPDAGI PANEL SOXTA GRAFIK EMAS. Referens shablon bu joyga o'ylab
 * topilgan "$2755.00" va "26.3% bounce rate" qo'yadi. Bizda esa haqiqiy
 * ijro izi turadi: konnektor nomlari registrdan, risk darajalari policy
 * jadvalidan. Ya'ni "nega bizni tanlang" savoliga javob rasm bilan emas,
 * mahsulotning o'zi bilan beriladi.
 *
 * O'NGDAGI UCH BAND `g.*` kalitlaridan — kafolatlar bo'limi bilan bir
 * xil manba, ya'ni ikki joyda ikki xil va'da bo'lib qolmaydi.
 */

const POINTS = ["policy", "stop", "audit"] as const;
const VALUE_KEY: Record<(typeof POINTS)[number], string> = {
  policy: "g.g2Body",
  stop: "g.g3Body",
  audit: "g.g1Body",
};

export function WhyChoose({ t }: { t: (key: string) => string }) {
  return (
    <Section id="why" labelledBy="why-title">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        {/* Artefakt */}
        <GlowCard interactive={false} className="order-2 !p-0 lg:order-1">
          <ExecutionLedger />
        </GlowCard>

        {/* Afzalliklar */}
        <div className="order-1 lg:order-2">
          <SectionHead
            eyebrow={t("why.eyebrow")}
            title={t("why.title")}
            sub={t("why.sub")}
            align="left"
          />

          <ul className="mt-9 space-y-6">
            {POINTS.map((p) => (
              <li key={p} className="flex gap-4">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[hsl(225_90%_78%/0.3)] bg-[hsl(228_70%_16%/0.9)]">
                  <Check className="h-3.5 w-3.5 text-[hsl(215_95%_86%)]" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h3 className="font-display text-[1.0625rem] font-medium tracking-[-0.015em] text-white">
                    {t(`g.${p}`)}
                  </h3>
                  <p className="mt-1.5 text-[0.875rem] leading-relaxed text-white/55">
                    {t(VALUE_KEY[p])}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}
