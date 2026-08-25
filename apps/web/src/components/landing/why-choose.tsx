import { Section, SectionHead } from "./ui";

/**
 * NAZORAT QATLAMI — ataylab KARTA EMAS.
 *
 * Sahifada uchta ketma-ket bo'lim bor edi va uchalasi ham bir xil ritmda
 * ishlangan: markazlashtirilgan sarlavha -> bir xil kartalar to'ri. Jami
 * o'n ikkita bir xil karta — ko'z ular orasidagi farqni ko'rmay qolardi.
 *
 * Shuning uchun bu bo'lim boshqacha: ikki ustun (chapda sarlavha, o'ngda
 * ro'yxat), kartasiz, faqat gorizontal ajratgich chiziqlar bilan. Kontent
 * o'zgarmadi — ritm o'zgardi.
 *
 * TAKRORLANISH OLIB TASHLANDI: ilgari bu yerda "policy" bandi turardi,
 * lekin "Qanday ishlaydi" bo'limining uchinchi qadami ham aynan tasdiq
 * haqida edi. Endi bu bo'lim tasdiqdan KEYIN nima qolishini aytadi:
 * yozuv, to'xtatish tugmasi va sarf hisobi.
 */

const POINTS = [
  { id: "audit", body: "g.g1Body" },
  { id: "stop", body: "g.g3Body" },
  { id: "cost", body: "g.g4Body" },
] as const;

export function WhyChoose({ t }: { t: (key: string) => string }) {
  return (
    <Section id="why" labelledBy="why-title" tinted>
      <div className="grid gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-20">
        <SectionHead
          eyebrow={t("why.eyebrow")}
          title={t("why.title")}
          sub={t("why.sub")}
          align="left"
        />

        <dl className="lg:pt-1">
          {POINTS.map((p, i) => (
            <div
              key={p.id}
              className={`grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 py-7 sm:gap-x-8 ${
                i > 0 ? "border-t border-white/[0.07]" : "lg:pt-0"
              }`}
            >
              <dt className="font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-[hsl(220_95%_76%)]">
                {t(`g.${p.id}`)}
              </dt>
              <dd className="col-start-2 row-start-1">
                <p className="font-display text-[1.25rem] font-medium leading-tight tracking-[-0.02em] text-white">
                  {t(`g.${p.id === "audit" ? "g1Value" : p.id === "stop" ? "g3Value" : "g4Value"}`)}
                </p>
                <p className="mt-2.5 max-w-md text-[0.9375rem] leading-relaxed text-white/55">
                  {t(p.body)}
                </p>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </Section>
  );
}
