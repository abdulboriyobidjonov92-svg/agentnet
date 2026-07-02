"use client";
import { Shield, Bot, Sparkles } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { LanguageSwitcher } from "@/components/language-switcher";

// Chap tomonda brend paneli (emerald gradient + Islom geometriyasi), o'ngda forma.
export function AuthShell({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  return (
    <div className="flex min-h-screen">
      {/* Brend paneli */}
      <div className="relative hidden w-1/2 overflow-hidden bg-primary lg:block">
        <div className="absolute inset-0 bg-dot-grid opacity-40" />
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, hsl(var(--accent-gold)), transparent 70%)" }} />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, hsl(var(--accent-gold)), transparent 70%)" }} />

        <div className="relative flex h-full flex-col justify-between p-12 text-primary-foreground">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold">
              <Sparkles className="h-5 w-5 text-gold-foreground" />
            </div>
            <span className="text-xl font-bold">AgentNet</span>
          </div>

          <div className="space-y-8">
            <h2 className="max-w-md text-4xl font-bold leading-tight">{t("auth.brandTitle")}</h2>
            <div className="space-y-5">
              {[
                { icon: Shield, t: t("auth.brandF1"), d: t("auth.brandF1d") },
                { icon: Bot, t: t("auth.brandF2"), d: t("auth.brandF2d") },
                { icon: Sparkles, t: t("auth.brandF3"), d: t("auth.brandF3d") },
              ].map(({ icon: Icon, t: tt, d }) => (
                <div key={tt} className="flex items-start gap-3.5">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 backdrop-blur">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">{tt}</p>
                    <p className="text-sm text-primary-foreground/70">{d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-sm text-primary-foreground/60">{t("auth.brandFooter")}</p>
        </div>
      </div>

      {/* Forma */}
      <div className="relative flex w-full items-center justify-center bg-background px-6 lg:w-1/2">
        <div className="absolute right-6 top-6">
          <LanguageSwitcher />
        </div>
        {children}
      </div>
    </div>
  );
}
