"use client";
// SHELL — Liquid Obsidian qobig'i. Barcha dashboard sahifalari mutlaq qora
// bo'shliq (SceneCanvas tumani) ustida suzadi; pastda Waveform "tinglaydi".

import { useState } from "react";
import dynamic from "next/dynamic";
import { Menu, X } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { BalanceWidget } from "@/components/billing/balance-widget";
import { Waveform } from "@/components/neuro/waveform";
import { ProductTour } from "@/components/onboarding/product-tour";
import { HelpWidget } from "@/components/help/help-widget";

// Tuman — faqat klientda; SSR paytida sof qora bo'shliq qoladi
const SceneCanvas = dynamic(() => import("@/components/neuro/scene-canvas"), {
  ssr: false,
});

export function DashboardShell({
  email,
  name,
  children,
}: {
  email?: string;
  name?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    // `h-full` (`h-screen` emas): balandlikni layout beradi. SEC-12 banneri
    // qo'shilganda qobiq QOLGAN joyni egallaydi, bannersiz esa layout'ning
    // `h-screen` konteyneri to'liq oynani beradi — ko'rinish o'zgarmaydi.
    <div className="relative flex h-full bg-black">
      <SceneCanvas />

      {/* Desktop rail */}
      <div className="relative z-10 hidden lg:block">
        <Sidebar email={email} name={name} />
      </div>

      {/* Mobil drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full">
            <Sidebar email={email} name={name} onNavigate={() => setOpen(false)} />
          </div>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setOpen(false)}
            className="absolute right-4 top-4 z-[60] shadow-lift"
            aria-label="Close"
          >
            <X className="!h-5 !w-5" />
          </Button>
        </div>
      )}

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        {/* Yuqori chiziq — minimal, shaffof shisha */}
        {/* Menyu tugmasi CHAPDA — drawer ham chapdan ochiladi, ya'ni tugma
            va u ochadigan panel bir tomonda (mobil navigatsiyaning standart
            naqshi). Ilgari tugma o'ngda edi: bosilganda panel qarama-qarshi
            tomondan chiqib, yo'nalish sezgisini buzardi. */}
        <header className="glass-dark flex h-14 shrink-0 items-center justify-between gap-2 border-b border-white/[0.06] px-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setOpen(true)}
              className="lg:hidden"
              aria-label="Menu"
            >
              <Menu className="!h-5 !w-5" />
            </Button>
            <div className="label-mono flex min-w-0 items-center gap-2 lg:hidden">
              <span
                className="heartbeat inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: "hsl(var(--vein-cyan))", boxShadow: "0 0 10px hsl(var(--vein-cyan) / 0.6)" }}
              />
              <span className="truncate">AgentNet</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <BalanceWidget />
          </div>
        </header>

        <main className="scroll-thin flex-1 overflow-auto">
          <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</div>
        </main>

        {/* AI tinglayapti — doim harakatdagi chiziq */}
        <div className="pointer-events-none relative z-10 -mt-12 shrink-0">
          <Waveform />
        </div>
      </div>

      {/* Yangi foydalanuvchi tanishtiruvi — birinchi kirishda avtomatik ochiladi */}
      <ProductTour />

      {/* Har sahifada — Yordam / FAQ / Fikr bildirish */}
      <HelpWidget />
    </div>
  );
}
