"use client";
import { ShieldCheck, Blocks, Zap } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { LanguageSwitcher } from "@/components/language-switcher";

/**
 * Auth — birinchi taassurot (eng yuqori ta'sir). Obsidian editorial sahna:
 * chapda to'liq balandlikdagi bayonot paneli (brand → statement → imkoniyatlar),
 * o'ngda forma. Imzo: Filament (arctic hairline) — panellar orasidagi spine,
 * sarlavha ostidagi chizilib keluvchi chiziq. 3D obyekt yo'q — sof tipografik.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  const { t } = useT();

  const features = [
    { icon: ShieldCheck, title: t("auth.brandF1"), desc: t("auth.brandF1d") },
    { icon: Blocks, title: t("auth.brandF2"), desc: t("auth.brandF2d") },
    { icon: Zap, title: t("auth.brandF3"), desc: t("auth.brandF3d") },
  ];

  return (
    <div className="relative flex min-h-screen bg-background text-foreground">
      {/* ===== Chap — to'liq balandlikdagi editorial panel ===== */}
      <div className="relative hidden w-[54%] flex-col justify-between overflow-hidden px-14 py-12 lg:flex">
        {/* Fon qatlamlari — nozik grid + vignette (rangsiz chuqurlik) */}
        <div className="pointer-events-none absolute inset-0 bg-grid-lines opacity-[0.35]" />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 80% at 15% 0%, hsl(var(--foreground) / 0.05), transparent 55%), radial-gradient(100% 70% at 100% 100%, hsl(var(--accent-line) / 0.06), transparent 60%)",
          }}
        />

        {/* Yuqori — brand */}
        <div className="relative z-10 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-foreground/15 bg-surface-2">
            <span className="text-[15px] font-semibold tracking-tight">A</span>
          </div>
          <span className="text-[15px] font-semibold tracking-tight">AgentNet</span>
        </div>

        {/* O'rta — bayonot */}
        <div className="relative z-10 max-w-lg">
          <div className="mb-5 flex items-center gap-2.5">
            <span className="h-px w-8 bg-gradient-to-r from-transparent to-[hsl(var(--accent-line))]" />
            <span className="nums text-[0.7rem] font-medium uppercase tracking-[0.22em] text-line">
              {t("auth.brandEyebrow")}
            </span>
          </div>
          <h2 className="text-[2.6rem] font-semibold leading-[1.06] tracking-tight text-foreground">
            {t("auth.brandTitle")}
          </h2>

          {/* Imkoniyatlar — hairline bilan ajratilgan */}
          <div className="mt-10 space-y-5">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-foreground/10 bg-surface-2 text-foreground/80">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[15px] font-medium tracking-tight text-foreground">{title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quyi — ishonch qatori + footer */}
        <div className="relative z-10">
          <div className="mb-4 h-px w-16 origin-left bg-line draw-x" />
          <p className="nums text-[0.72rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            {t("auth.trust")}
          </p>
          <p className="mt-2 text-sm text-muted-foreground/70">{t("auth.brandFooter")}</p>
        </div>
      </div>

      {/* Vertikal spine — imzo urg'u chizig'i (panellar orasida) */}
      <div className="spine relative hidden lg:block" aria-hidden />

      {/* ===== O'ng — forma paneli (to'liq balandlik) ===== */}
      <div className="relative flex min-h-screen w-full flex-col lg:w-[46%]">
        <div className="absolute right-6 top-6 z-10">
          <LanguageSwitcher />
        </div>
        {/* Forma — vertikal markazda */}
        <div className="flex flex-1 items-center justify-center px-6 py-16 sm:px-10 lg:px-16">
          <div className="w-full max-w-md">{children}</div>
        </div>
        {/* Quyi footer bar — bo'shliqni to'ldiradi, kompozitsiyani yopadi */}
        <div className="relative z-10 px-6 pb-6 text-center text-xs text-muted-foreground/50 sm:px-10 lg:px-16">
          AgentNet · 2026 ©
        </div>
      </div>
    </div>
  );
}
