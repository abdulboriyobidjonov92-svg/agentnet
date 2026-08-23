import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ExecutionLedger } from "./execution-ledger";

/**
 * HERO — "Obsidian Instrument" yo'nalishining tezisi.
 *
 * TUZILISH QARORI: markazlashtirilgan matn + 3D sahna o'rniga CHAPGA
 * tekislangan matn va o'ngda ijro daftari. Sabab — markazlashtirilgan
 * hero har SaaS saytida bor va u "e'lon" kabi o'qiladi; chapga
 * tekislangan ustun esa hujjat/asbob kabi o'qiladi va uzun o'zbekcha
 * sarlavhalarni ham sindirmaydi.
 *
 * GRADIENT, GLOW VA 3D YO'Q (brif talabi). Chuqurlik faqat uch narsadan
 * keladi: 1px chegara, yuza qatlami (`--surface-1`) va bo'shliq.
 *
 * `t` server tomondan uzatiladi (`getT`) — hero'ning o'zi server
 * komponenti; faqat ijro daftari klient (animatsiya uchun).
 */
export function Hero({ t }: { t: (key: string) => string }) {
  return (
    <section aria-labelledby="hero-title" className="relative border-b border-border">
      {/* Nozik texnik to'r — 88px qadam, deyarli ko'rinmas.
          Bezak emas: sahifadagi barcha bo'shliq shu to'rga tekislanadi. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.55] [background-image:linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px)] [background-size:88px_100%] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
      />

      <div className="relative mx-auto grid max-w-[1240px] items-center gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16 lg:py-36">
        {/* --- Chap ustun: tezis --- */}
        <div className="max-w-xl">
          <p className="flex items-center gap-3 font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-muted-foreground">
            <span className="h-px w-6 bg-[hsl(var(--cta-strong))]" aria-hidden />
            {t("hx.eyebrow")}
          </p>

          <h1
            id="hero-title"
            className="mt-6 font-display text-[clamp(2.5rem,6.2vw,4.25rem)] font-semibold leading-[1.02] tracking-[-0.035em] text-foreground"
          >
            {/* Ikki jumla — IKKI QATOR. `block` ataylab: sarlavha ikki
                zarbli tezis ("agentlar ishlaydi" / "siz tasdiqlaysiz"),
                va uni ekran kengligiga qarab tasodifiy joyda sindirish
                ritmni buzardi (mobil'da "…ishlaydi. Siz" bo'lib qolardi). */}
            {t("hx.title1")}
            <span className="block text-[hsl(var(--cta-strong))]">{t("hx.title2")}</span>
          </h1>

          <p className="mt-6 max-w-[54ch] text-[1.0625rem] leading-relaxed text-muted-foreground">
            {t("hx.sub")}
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/sign-up"
              className="cta group inline-flex h-12 items-center justify-center gap-2 rounded-[3px] px-6 text-[0.9375rem] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--background))]"
            >
              {t("hx.ctaPrimary")}
              <ArrowRight
                className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
                aria-hidden
              />
            </Link>
            <Link
              href="/marketplace"
              className="inline-flex h-12 items-center justify-center rounded-[3px] border border-border px-6 text-[0.9375rem] font-medium text-foreground transition-colors hover:border-[hsl(var(--cta-strong)/0.5)] hover:bg-[hsl(var(--surface-1))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--background))]"
            >
              {t("hx.ctaSecondary")}
            </Link>
          </div>

          {/* Bitta halol fakt — "1200+ agent" turidagi tekshirib bo'lmaydigan
              da'vo emas: 17 ta konnektor registrda sanab qo'yilgan. */}
          <p className="mt-8 font-mono text-[0.75rem] leading-relaxed text-muted-foreground/80">
            {t("hx.factline")}
          </p>
        </div>

        {/* --- O'ng ustun: mahsulot vizualizatsiyasi --- */}
        <div className="lg:pl-4">
          <ExecutionLedger />
        </div>
      </div>
    </section>
  );
}
