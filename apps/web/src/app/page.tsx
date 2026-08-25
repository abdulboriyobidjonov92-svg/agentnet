import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { decodeSession, SESSION_COOKIE } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { AgentNetMark } from "@/components/brand/agentnet-mark";
import { HeroOrbit } from "@/components/landing/hero-orbit";
import { Solutions } from "@/components/landing/solutions";
import { WhyChoose } from "@/components/landing/why-choose";
import { HowItWorks } from "@/components/landing/how-it-works";
import { EnterpriseCta } from "@/components/landing/enterprise-cta";
import { SiteFooter } from "@/components/landing/site-footer";

export default async function HomePage() {
  const store = await cookies();
  if (decodeSession(store.get(SESSION_COOKIE)?.value)) redirect("/dashboard");
  const { t } = await getT();

  const navLinks = [
    { href: "#solutions", key: "nav.solutions" },
    { href: "#why", key: "nav.why" },
    { href: "#how", key: "nav.how" },
  ];

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#050A1C] text-white">
      {/* ===== 1. Navbar ===== */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#050A1C]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(220_100%_75%)]">
            <AgentNetMark size={30} id="an-nav" />
            <span className="font-display text-[1.0625rem] font-semibold tracking-tight">AgentNet</span>
          </Link>

          <nav aria-label="AgentNet" className="hidden items-center gap-8 lg:flex">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-[0.875rem] text-white/60 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(190_100%_75%)] focus-visible:ring-offset-0"
              >
                {t(l.key)}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSwitcher />
            <Link
              href="/sign-in"
              className="hidden text-[0.875rem] text-white/70 transition-colors hover:text-white sm:block"
            >
              {t("cta.signIn")}
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex h-10 items-center rounded-full bg-gradient-to-b from-[hsl(258_100%_68%)] to-[hsl(248_92%_54%)] px-4 text-[0.875rem] font-medium text-white shadow-[0_6px_20px_hsl(250_100%_55%/0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(190_100%_75%)] focus-visible:ring-offset-0"
            >
              {t("cta.start")}
            </Link>
          </div>
        </div>
      </header>

      {/* ===== 2. Hero ===== */}
      <HeroOrbit t={t} />

      {/* ===== 3. Imkoniyatlar ===== */}
      <Solutions t={t} />

      {/* ===== 4. Nega biz ===== */}
      <WhyChoose t={t} />

      {/* ===== 5. Qanday ishlaydi ===== */}
      <HowItWorks t={t} />

      {/* ===== 6. Korxona uchun CTA ===== */}
      <EnterpriseCta t={t} />

      {/* ===== 7. Footer ===== */}
      <SiteFooter t={t} />
    </main>
  );
}
