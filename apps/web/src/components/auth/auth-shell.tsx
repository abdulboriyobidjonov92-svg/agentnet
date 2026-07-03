"use client";
import dynamic from "next/dynamic";
import { useT } from "@/lib/i18n/client";
import { LanguageSwitcher } from "@/components/language-switcher";

// Yagona 3D lahza — sahnaga qo'yilgan obyekt (faqat klientda)
const Monolith = dynamic(() => import("@/components/three/monolith"), {
  ssr: false,
  loading: () => <div className="h-full w-full" />,
});

/**
 * Auth — birinchi taassurot (eng yuqori ta'sir). Obsidian keynote sahna:
 * chapda Monolith, o'ngda editorial forma. Imzo: Filament (arctic hairline)
 * — panellar orasidagi spine va sarlavha ostidagi chizilib keluvchi chiziq.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  return (
    <div className="relative flex min-h-screen bg-background text-foreground">
      {/* Chap — keynote sahna (yagona 3D obyekt, ko'p bo'sh joy) */}
      <div className="relative hidden w-[54%] flex-col overflow-hidden lg:flex">
        {/* Brend — kichik, yuqori chap */}
        <div className="relative z-10 flex items-center gap-2.5 px-12 pt-12">
          <div className="h-6 w-6 rounded-md border border-foreground/15 bg-surface-2" />
          <span className="text-sm font-medium tracking-tight">AgentNet</span>
        </div>

        {/* Monolith — markazda, yumshoq "prожektor" sahnasida */}
        <div className="relative flex flex-1 items-center justify-center">
          {/* Studio spotlight backdrop — obyektni sahnaga qo'yadi */}
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 h-[80%] w-[80%] max-w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ background: "radial-gradient(circle, hsl(220 20% 18% / 0.55), transparent 62%)" }}
          />
          <div className="relative h-[74%] w-[74%] max-w-[520px]">
            <Monolith className="!h-full !w-full" />
          </div>
        </div>

        {/* Bir qatorli tinch bayonot + Filament (chizilib keladi) */}
        <div className="relative z-10 px-12 pb-14">
          <div className="mb-4 h-px w-16 origin-left bg-line draw-x" />
          <p className="max-w-sm text-lg font-medium leading-snug tracking-tight text-foreground/90">
            {t("auth.brandTitle")}
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">{t("auth.brandFooter")}</p>
        </div>
      </div>

      {/* Vertikal spine — imzo urg'u chizig'i (panellar orasida) */}
      <div className="spine relative hidden lg:block" aria-hidden />

      {/* O'ng — editorial forma */}
      <div className="relative flex w-full flex-col lg:w-[46%]">
        <div className="absolute right-6 top-6 z-10">
          <LanguageSwitcher />
        </div>
        <div className="flex flex-1 items-center px-6 sm:px-10 lg:px-16">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>
    </div>
  );
}
