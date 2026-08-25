import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { OrbitCore } from "./orbit-core";

/**
 * HERO — orbital kompozitsiya.
 *
 * TARTIB brend tasviridan olindi: tepada orbita, markazda AgentNet
 * belgisi, ostida sarlavha va amal tugmalari. Ya'ni birinchi ko'rinadigan
 * narsa — mahsulot nomi va uning oltita imkoniyati.
 *
 * YORUG'LIK QOIDASI: sahifada yagona manba — orbita yadrosi. Shu sababli
 * fon nuri hero'ning MARKAZIDAN taraladi va pastga tushib so'nadi;
 * burchaklarga tasodifiy binafsha dog'lar QO'YILMAYDI (shablonlarni arzon
 * ko'rsatadigan narsa aynan o'sha).
 */
export function HeroOrbit({ t }: { t: (key: string) => string }) {
  return (
    <section
      id="hero"
      aria-labelledby="hero-title"
      className="relative overflow-hidden border-b border-white/[0.06] bg-[#050A1C]"
    >
      {/* Markazdan tarqaladigan yagona nur — referensdagi qora kosmos */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 54% 44% at 50% 34%, hsl(228 100% 42% / 0.25) 0%, transparent 70%)",
        }}
      />
      {/* Yulduz changi — juda past kontrastli nuqtalar to'ri */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:radial-gradient(hsl(240_60%_80%/0.16)_1px,transparent_1px)] [background-size:34px_34px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_35%,black,transparent)]"
      />

      <div className="relative mx-auto max-w-[1180px] px-5 pb-14 pt-6 sm:px-8 sm:pb-18 sm:pt-8">
        {/* Kategoriya belgisi — gradient qirra, tepasidan yorug' */}
        <div className="flex justify-center">
          <span className="rounded-full bg-gradient-to-b from-white/20 to-white/[0.04] p-px">
            <span className="flex items-center gap-2 rounded-full bg-[hsl(230_45%_7%)] px-4 py-1.5 font-mono text-[0.625rem] uppercase tracking-[0.24em] text-white/60">
              <span className="h-1 w-1 rounded-full bg-[hsl(190_100%_60%)]" aria-hidden />
              {t("h5.eyebrow")}
            </span>
          </span>
        </div>

        <OrbitCore className="mt-6 sm:mt-8" />

        <div className="relative z-10 mx-auto mt-6 max-w-3xl text-center sm:mt-8">
          <h1
            id="hero-title"
            className="font-display text-[clamp(2.25rem,5vw,3.75rem)] font-semibold leading-[1.06] tracking-[-0.035em] text-white"
          >
            {t("h5.title")}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[1rem] leading-relaxed text-white/55 sm:text-[1.0625rem]">
            {t("h5.sub")}
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[hsl(258_100%_68%)] to-[hsl(248_92%_54%)] px-7 text-[0.9375rem] font-medium text-white shadow-[0_8px_32px_hsl(250_100%_55%/0.35)] transition-shadow duration-300 hover:shadow-[0_10px_40px_hsl(250_100%_60%/0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(190_100%_70%)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(230_50%_4%)] sm:w-auto"
            >
              {t("cta.start")}
              <ArrowRight
                className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
                aria-hidden
              />
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex h-12 w-full items-center justify-center rounded-full bg-gradient-to-b from-white/[0.14] to-white/[0.03] p-px text-[0.9375rem] font-medium sm:w-auto"
            >
              <span className="flex h-full w-full items-center justify-center rounded-full bg-[hsl(230_45%_7%)] px-7 text-white/85 transition-colors duration-300 hover:text-white">
                {t("cta.signIn")}
              </span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
