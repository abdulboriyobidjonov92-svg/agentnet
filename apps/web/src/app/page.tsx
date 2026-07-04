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
import { Reveal, Tilt, Counter } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { CinematicHero } from "@/components/hero/CinematicHero";
import { HalalBadge } from "@/components/hero/HalalBadge";

export default async function HomePage() {
  const store = await cookies();
  if (decodeSession(store.get(SESSION_COOKIE)?.value)) redirect("/dashboard");
  const { t } = await getT();

  return (
    <main className="min-h-screen overflow-x-hidden bg-background">
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

      {/* ===== Hero — ultra-cinematic sahna: MacBook + iPhone + iPad, hologram
           agentlar; markaziy shar YO'Q (reference kompozitsiyasi) ===== */}
      <section className="hero-cinematic relative overflow-hidden">
        {/* Halal belgisi — yuqori chap */}
        <div className="absolute left-4 top-4 z-20 sm:left-8 sm:top-6">
          <HalalBadge />
        </div>

        <div className="relative z-10 mx-auto max-w-4xl px-4 pt-14 text-center sm:px-6 sm:pt-16">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--cta-gold)/0.45)] bg-[hsl(var(--cta-gold)/0.1)] px-4 py-1.5 text-sm font-medium text-[hsl(var(--cta-gold))] animate-in-up">
            <Shield className="h-4 w-4" /> {t("landing.badge")}
          </div>
          <h1 className="type-display animate-in-up">
            {t("landing.heroTitle1")}{" "}
            <span className="text-gradient-animated">{t("landing.heroTitleAccent")}</span>{" "}
            {t("landing.heroTitle2")}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-white/60 animate-in-up delay-100 sm:text-lg">
            {t("landing.heroSubtitle")}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 animate-in-up delay-200 sm:flex-row">
            <Button asChild size="lg" className="cta-gold group w-full border-0 px-8 sm:w-auto">
              <Link href="/sign-up">
                {t("landing.ctaPrimary")}
                <ArrowRight className="transition group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="w-full border-white/20 bg-white/5 px-8 text-white hover:bg-white/10 sm:w-auto"
            >
              <Link href="/sign-in">{t("landing.ctaSecondary")}</Link>
            </Button>
          </div>
        </div>

        {/* 3D sahna — qurilmalar + hologramlar (lazy, reduced-motion fallback) */}
        <CinematicHero className="relative z-10 mx-auto h-[380px] w-full max-w-6xl sm:h-[480px] lg:h-[560px]" />

        {/* Stats — sahna ostida */}
        <div className="relative z-10 mx-auto grid max-w-3xl grid-cols-3 border-t border-white/10 px-4 pb-10 pt-6 sm:px-6">
          {[
            { v: <Counter to={1200} suffix="+" />, l: t("landing.stat1") },
            { v: "3", l: t("landing.stat2") },
            { v: "99.9%", l: t("landing.stat3") },
          ].map((s, i) => (
            <div key={s.l} className={i > 0 ? "border-l border-white/10 pl-4 sm:pl-6" : "pr-2"}>
              <p className="nums text-2xl font-semibold tracking-tight text-white sm:text-3xl">{s.v}</p>
              <p className="mt-1 text-[0.7rem] font-medium uppercase tracking-[0.14em] text-white/50">{s.l}</p>
            </div>
          ))}
        </div>
        <div className="relative z-10 pb-8 text-center text-xs text-white/40">{t("landing.trusted")}</div>
      </section>

      {/* ===== Audience: individuals + business ===== */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <Reveal className="mb-10 text-center">
          <div className="mb-4 flex items-center justify-center gap-2.5">
            <span className="h-px w-8 bg-gradient-to-r from-transparent to-[hsl(var(--accent-line))]" />
            <span className="nums text-[0.7rem] font-medium uppercase tracking-[0.24em] text-line">
              01
            </span>
            <span className="h-px w-8 bg-gradient-to-l from-transparent to-[hsl(var(--accent-line))]" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("landing.audienceTitle")}</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">{t("landing.audienceSub")}</p>
        </Reveal>
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
