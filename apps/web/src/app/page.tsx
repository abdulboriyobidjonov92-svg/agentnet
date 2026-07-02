import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Sparkles, Shield, Bot, Zap, ArrowRight, Check,
  Moon, HeartPulse, Wallet, CalendarDays, Brain, Store,
  User, Building2, BarChart3, TrendingUp,
} from "lucide-react";
import { decodeSession, SESSION_COOKIE } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Reveal, Tilt, Counter } from "@/components/motion";
import { HeroSphere, HeroWordmark } from "@/components/three/hero-visual";

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
            <Link href="/sign-in" className="hidden rounded-xl px-4 py-2 text-sm font-medium transition hover:bg-muted sm:block">
              {t("landing.ctaSecondary")}
            </Link>
            <Link href="/sign-up" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft transition hover:brightness-110">
              {t("common.signUp")}
            </Link>
          </div>
        </div>
      </header>

      {/* ===== Hero — kirish ekrani: neyron sfera + zarrachali logotip ===== */}
      <section className="aurora relative">
        <div className="absolute inset-0 bg-grid-lines opacity-[0.5]" />
        {/* 3D neyron sfera — hero fonining o'ng qismida */}
        <HeroSphere className="pointer-events-none absolute right-[-10%] top-1/2 hidden h-[620px] w-[620px] -translate-y-1/2 lg:block" />
        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2 lg:gap-8">
          {/* Left */}
          <div className="text-center lg:text-left">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-gold bg-gold/10 px-4 py-1.5 text-sm font-medium text-gold animate-in-up">
              <Shield className="h-4 w-4" /> {t("landing.badge")}
            </div>
            <HeroWordmark className="mx-auto h-[110px] w-full max-w-[520px] lg:mx-0" />
            <h1 className="animate-in-up text-3xl font-bold leading-[1.08] tracking-tight sm:text-4xl lg:text-5xl">
              {t("landing.heroTitle1")}{" "}
              <span className="text-gradient-animated">{t("landing.heroTitleAccent")}</span>{" "}
              {t("landing.heroTitle2")}
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground animate-in-up delay-100 sm:text-lg lg:mx-0">
              {t("landing.heroSubtitle")}
            </p>
            <div className="mt-9 flex flex-col items-center gap-3 animate-in-up delay-200 sm:flex-row lg:justify-start">
              <Link href="/sign-up" className="group flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-7 py-3.5 text-base font-semibold text-primary-foreground shadow-glow transition hover:brightness-110 sm:w-auto">
                {t("landing.ctaPrimary")}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </Link>
              <Link href="/sign-in" className="flex w-full items-center justify-center rounded-xl border bg-card px-7 py-3.5 text-base font-semibold shadow-soft transition hover:bg-muted sm:w-auto">
                {t("landing.ctaSecondary")}
              </Link>
            </div>
            {/* Stats */}
            <div className="mt-10 grid grid-cols-3 gap-4 border-t pt-6 animate-in-up delay-300">
              <div>
                <p className="text-2xl font-bold text-primary sm:text-3xl"><Counter to={1200} suffix="+" /></p>
                <p className="text-xs text-muted-foreground">{t("landing.stat1")}</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-primary sm:text-3xl">3</p>
                <p className="text-xs text-muted-foreground">{t("landing.stat2")}</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-primary sm:text-3xl">99.9%</p>
                <p className="text-xs text-muted-foreground">{t("landing.stat3")}</p>
              </div>
            </div>
          </div>

          {/* Right — floating 3D chat mockup */}
          <div className="relative mx-auto hidden w-full max-w-md lg:block">
            <div className="animate-float">
              <Tilt max={8} className="rounded-3xl">
                <div className="glass-panel rounded-3xl p-5 shadow-glow">
                  <div className="mb-4 flex items-center gap-3 border-b pb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Moon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Namoz & Quran</p>
                      <p className="flex items-center gap-1 text-xs text-primary">
                        <Shield className="h-3 w-3" /> Halal
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">
                      Toshkentda namoz vaqti?
                    </div>
                    <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-secondary px-3.5 py-2 text-sm">
                      📿 Bomdod 04:12 · Peshin 12:38 · Asr 17:05 · Shom 19:44 · Xufton 21:10
                    </div>
                    <div className="flex items-center gap-1 text-xs text-primary">
                      <Check className="h-3 w-3" /> Halal check passed
                    </div>
                  </div>
                </div>
              </Tilt>
            </div>
            {/* floating badges */}
            <div className="absolute -left-8 top-8 animate-float-slow rounded-2xl border bg-card px-3 py-2 text-xs font-medium shadow-lift">
              💱 UZS 12,650
            </div>
            <div className="absolute -right-6 bottom-10 animate-float rounded-2xl border bg-card px-3 py-2 text-xs font-medium shadow-lift delay-300">
              🌤️ +24°C
            </div>
          </div>
        </div>
        <div className="relative z-10 pb-10 text-center text-xs text-muted-foreground">{t("landing.trusted")}</div>
      </section>

      {/* ===== Audience: individuals + business ===== */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <Reveal className="mb-10 text-center">
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
              <div className="group h-full rounded-2xl border bg-card p-6 shadow-soft tilt-hover hover:shadow-lift">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
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
              { icon: Moon, name: t("landing.a1"), d: t("landing.a1d"), c: "text-primary bg-primary/10" },
              { icon: HeartPulse, name: t("landing.a2"), d: t("landing.a2d"), c: "text-rose-600 bg-rose-500/10" },
              { icon: Wallet, name: t("landing.a3"), d: t("landing.a3d"), c: "text-gold bg-gold/10" },
              { icon: CalendarDays, name: t("landing.a4"), d: t("landing.a4d"), c: "text-blue-600 bg-blue-500/10" },
              { icon: Brain, name: t("landing.a5"), d: t("landing.a5d"), c: "text-purple-600 bg-purple-500/10" },
              { icon: Bot, name: t("landing.a6"), d: t("landing.a6d"), c: "text-teal-600 bg-teal-500/10" },
            ].map(({ icon: Icon, name, d, c }, i) => (
              <Reveal key={name} delay={i * 60}>
                <div className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-soft tilt-hover hover:shadow-lift">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${c}`}>
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
              <Link href="/sign-up" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gold px-8 py-3.5 font-semibold text-gold-foreground shadow-gold-glow transition hover:brightness-110">
                {t("landing.ctaButton")} <ArrowRight className="h-4 w-4" />
              </Link>
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
