import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * YAKUNIY CTA — narx jadvali O'RNIGA.
 *
 * ⚠️ NARX RAQAMI ATAYLAB YO'Q (founder qarori, ikki marta tasdiqlangan).
 * Ikki sabab: (1) to'lov provayderi hali ulanmagan, ya'ni "$56.99" yozish
 * bosilganda hech qayerga olib bormasdi; (2) korporativ xaridor uchun
 * tarif jadvali emas, suhbat kerak.
 *
 * Shuning uchun bu yerda bitta aniq taklif turadi va ikki yo'l: hoziroq
 * boshlash yoki demo so'rash.
 */
export function EnterpriseCta({ t }: { t: (key: string) => string }) {
  return (
    <section id="enterprise" aria-labelledby="ent-title" className="border-b border-white/[0.06]">
      <div className="mx-auto max-w-[1180px] px-5 py-20 sm:px-8 sm:py-28">
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-white/[0.01] px-6 py-14 text-center shadow-[inset_0_1px_0_hsl(220_100%_90%/0.1)] sm:px-14 sm:py-20">
          {/* Yagona nur — pastdan yuqoriga, kartani "yoritilgan" qiladi */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3"
            style={{
              background:
                "radial-gradient(ellipse 60% 100% at 50% 100%, hsl(230 100% 50% / 0.22) 0%, transparent 72%)",
            }}
          />

          <div className="relative">
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.28em] text-[hsl(220_95%_76%)]">
              {t("ent.eyebrow")}
            </p>
            <h2
              id="ent-title"
              className="mx-auto mt-5 max-w-3xl font-display text-[clamp(1.875rem,4vw,3rem)] font-semibold leading-[1.06] tracking-[-0.035em] text-white"
            >
              {t("ent.title")}
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-[1rem] leading-relaxed text-white/55">
              {t("ent.sub")}
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/sign-up"
                className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[hsl(258_100%_68%)] to-[hsl(248_92%_54%)] px-7 text-[0.9375rem] font-medium text-white shadow-[0_8px_32px_hsl(250_100%_55%/0.35)] transition-shadow duration-300 hover:shadow-[0_10px_40px_hsl(250_100%_60%/0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(190_100%_70%)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(230_50%_5%)] sm:w-auto"
              >
                {t("ent.primary")}
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
                  aria-hidden
                />
              </Link>
              <Link
                href="/sign-in"
                className="inline-flex h-12 w-full items-center justify-center rounded-full bg-gradient-to-b from-white/[0.14] to-white/[0.03] p-px text-[0.9375rem] font-medium sm:w-auto"
              >
                <span className="flex h-full w-full items-center justify-center rounded-full bg-[hsl(230_45%_8%)] px-7 text-white/85 transition-colors duration-300 hover:text-white">
                  {t("ent.secondary")}
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
