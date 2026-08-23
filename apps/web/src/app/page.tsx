import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Sparkles, Shield, Bot, Zap, ArrowRight, Check,
  Scale, Wallet, CalendarDays, Globe, Store,
  User, Building2, BarChart3, TrendingUp,
} from "lucide-react";
import { decodeSession, SESSION_COOKIE } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Reveal, Tilt } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Hero } from "@/components/landing/hero";
import { Guarantees } from "@/components/landing/guarantees";
import { BuildSection } from "@/components/landing/build-section";
import { CreateFlow } from "@/components/landing/create-flow";
import { MarketplaceSection } from "@/components/landing/marketplace-section";
import { ConnectorsSection } from "@/components/landing/connectors-section";
import { ExecutionSection } from "@/components/landing/execution-section";
import { ScenariosSection } from "@/components/landing/scenarios-section";
import { RunSpine } from "@/components/landing/run-spine";

export default async function HomePage() {
  const store = await cookies();
  if (decodeSession(store.get(SESSION_COOKIE)?.value)) redirect("/dashboard");
  const { t } = await getT();

  return (
    <main className="min-h-screen overflow-x-hidden bg-background">
      <RunSpine />

      {/* ===== Nav ===== */}
      <header className="sticky top-0 z-30 border-b glass">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5 text-lg font-bold">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary shadow-glow">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            AgentNet
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <ThemeToggle />
            <LanguageSwitcher />
            <Button asChild variant="ghost" size="sm" className="hidden text-foreground sm:inline-flex">
              <Link href="/sign-in">{t("landing.ctaSecondary")}</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/sign-up">{t("common.signUp")}</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ===== Hero — V4 "Obsidian Instrument" =====
           Eski kinematik sahna (CinematicHero: MacBook + iPhone + obsidian
           shar) ALMASHTIRILDI. Sabab: u mahsulot haqida hech narsa
           ko'rsatmasdi — qurilma rasmlari va soxta dashboard edi. O'rniga
           haqiqiy ijro izi turadi (`landing/execution-ledger.tsx`).
           Eski komponentlar `components/hero/` da qoladi: ular hali
           `/agentos` va `/twin` sahifalarida ishlatiladi. */}
      <Hero t={t} />

      <Guarantees t={t} />

      <BuildSection t={t} />

      <CreateFlow t={t} />

      <MarketplaceSection t={t} />

      <ConnectorsSection t={t} />

      <ExecutionSection t={t} />

      <ScenariosSection t={t} />

      {/* ===== Audience: individuals + business ===== */}
      {/* Sarlavha bloki ("01 · Har kim uchun qurilgan" + tavsif) ATAYLAB olib
          tashlandi (founder qarori, 2026-08-22): ikkita karta o'zini o'zi
          tushuntiradi, sarlavha esa faqat takrorlardi. */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="grid gap-5 md:grid-cols-2">
          <Reveal delay={80}>
            <Tilt max={6} className="h-full">
              <div className="h-full rounded-3xl border bg-card p-7 shadow-soft transition hover:shadow-lift">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <User className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-semibold">{t("landing.indTitle")}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("landing.indDesc")}</p>
                <div className="mt-5 space-y-2">
                  {[t("landing.indP1"), t("landing.indP2"), t("landing.indP3")].map((x) => (
                    <div key={x} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary" /> {x}
                    </div>
                  ))}
                </div>
              </div>
            </Tilt>
          </Reveal>
          <Reveal delay={160}>
            <Tilt max={6} className="h-full">
              <div className="relative h-full overflow-hidden rounded-3xl border-2 border-gold/40 bg-card p-7 shadow-soft transition hover:shadow-gold-glow">
                <div className="absolute right-5 top-5 rounded-full bg-gold/15 px-2.5 py-1 text-xs font-semibold text-gold">PRO</div>
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gold/10 text-gold">
                  <Building2 className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-semibold">{t("landing.bizTitle")}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("landing.bizDesc")}</p>
                <div className="mt-5 space-y-2">
                  {[
                    { icon: BarChart3, x: t("landing.bizP1") },
                    { icon: Wallet, x: t("landing.bizP2") },
                    { icon: TrendingUp, x: t("landing.bizP3") },
                  ].map(({ icon: Icon, x }) => (
                    <div key={x} className="flex items-center gap-2 text-sm">
                      <Icon className="h-4 w-4 text-gold" /> {x}
                    </div>
                  ))}
                </div>
              </div>
            </Tilt>
          </Reveal>
        </div>
      </section>

      {/* ===== Features ===== */}
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            { icon: Shield, t: t("landing.f1Title"), d: t("landing.f1Desc") },
            { icon: Bot, t: t("landing.f2Title"), d: t("landing.f2Desc") },
            { icon: Zap, t: t("landing.f3Title"), d: t("landing.f3Desc") },
          ].map(({ icon: Icon, t: tt, d }, i) => (
            <Reveal key={tt} delay={i * 90}>
              <div className="filament group relative h-full overflow-hidden rounded-2xl border bg-card p-6 shadow-soft tilt-hover hover:border-foreground/16 hover:shadow-lift">
                <span className="nums absolute right-5 top-5 text-xs font-medium tracking-widest text-muted-foreground/50">
                  0{i + 1}
                </span>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border bg-secondary text-foreground transition group-hover:border-[hsl(var(--accent-line)/0.5)] group-hover:text-line">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mb-1.5 text-lg font-semibold">{tt}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===== Built-in agents ===== */}
      <section className="border-y bg-secondary/40 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal className="mb-10 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Store className="h-3.5 w-3.5" /> {t("landing.agentsBadge")}
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{t("landing.agentsTitle")}</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">{t("landing.agentsSubtitle")}</p>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: BarChart3, name: t("landing.a1"), d: t("landing.a1d") },
              { icon: Wallet, name: t("landing.a2"), d: t("landing.a2d") },
              { icon: Scale, name: t("landing.a3"), d: t("landing.a3d") },
              { icon: Globe, name: t("landing.a4"), d: t("landing.a4d") },
              { icon: CalendarDays, name: t("landing.a5"), d: t("landing.a5d") },
              { icon: Building2, name: t("landing.a6"), d: t("landing.a6d") },
            ].map(({ icon: Icon, name, d }, i) => (
              <Reveal key={name} delay={i * 60}>
                <div className="group flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-soft tilt-hover hover:border-foreground/16 hover:shadow-lift">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border bg-secondary text-foreground transition group-hover:border-[hsl(var(--accent-line)/0.5)] group-hover:text-line">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-semibold">{name}</p>
                    <p className="text-sm text-muted-foreground">{d}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="mx-auto max-w-4xl px-4 py-20 sm:px-6 sm:py-24">
        <Reveal>
          <div className="aurora relative overflow-hidden rounded-[2rem] bg-primary p-8 text-center text-primary-foreground shadow-glow sm:p-14">
            <div className="absolute inset-0 bg-dot-grid opacity-30" />
            <div className="relative">
              <h2 className="text-3xl font-bold sm:text-4xl">{t("landing.ctaTitle")}</h2>
              <p className="mx-auto mt-3 max-w-md text-primary-foreground/80">{t("landing.ctaDesc")}</p>
              <Button asChild size="lg" className="mt-8 bg-gold px-8 text-gold-foreground shadow-gold-glow">
                <Link href="/sign-up">
                  {t("landing.ctaButton")} <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        {t("landing.footer")} · 2026 ©
      </footer>
    </main>
  );
}
