import Link from "next/link";
import { Sparkles } from "lucide-react";

/**
 * FOOTER.
 *
 * ⚠️ YORLIQLAR SAHIFA BO'YLAB BIR XIL: hisob yaratish havolasi bu yerda
 * ham "Bepul boshlash" deb ataladi. Ilgari u "Hisob yaratish" edi, ya'ni
 * bitta amalning ikkinchi nomi paydo bo'lgandi.
 *
 * ⚠️ HAVOLALAR FAQAT MAVJUD SAHIFALARGA. Referens shablonda "Careers",
 * "E-books", "Education" kabi ustunlar bor — ularning ortida hech narsa
 * yo'q. O'lik havola birinchi bosishdayoq ishonchni buzadi, shuning uchun
 * bu yerda faqat haqiqatan ochiladigan yo'llar sanaladi.
 */

const COLUMNS: { key: string; links: { href: string; key: string }[] }[] = [
  {
    key: "product",
    links: [
      { href: "/marketplace", key: "foot.agents" },
      { href: "/connectors", key: "foot.connectors" },
      { href: "/design-system", key: "foot.design" },
    ],
  },
  {
    key: "start",
    links: [
      { href: "/sign-up", key: "cta.start" },
      { href: "/sign-in", key: "cta.signIn" },
      { href: "/onboarding", key: "foot.onboarding" },
    ],
  },
];

export function SiteFooter({ t }: { t: (key: string) => string }) {
  return (
    <footer className="bg-[hsl(228_60%_6%)]">
      <div className="mx-auto max-w-[1180px] px-5 py-14 sm:px-8 sm:py-16">
        <div className="grid gap-12 md:grid-cols-[1.5fr_1fr_1fr]">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-b from-[hsl(258_100%_68%)] to-[hsl(248_92%_54%)]">
                <Sparkles className="h-4 w-4 text-white" aria-hidden />
              </span>
              <span className="font-display text-[1.0625rem] font-semibold tracking-tight text-white">
                AgentNet
              </span>
            </div>
            <p className="mt-4 text-[0.875rem] leading-relaxed text-white/45">
              {t("foot.tagline")}
            </p>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.key} aria-label={t(`foot.${col.key}`)}>
              <h2 className="font-mono text-[0.625rem] uppercase tracking-[0.24em] text-white/40">
                {t(`foot.${col.key}`)}
              </h2>
              <ul className="mt-5 space-y-2">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="-my-1 inline-block py-1.5 text-[0.875rem] text-white/60 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(220_100%_75%)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(228_60%_6%)]"
                    >
                      {t(l.key)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-14 border-t border-white/[0.07] pt-7">
          <p className="text-[0.8125rem] text-white/35">{t("foot.copy")}</p>
        </div>
      </div>
    </footer>
  );
}
