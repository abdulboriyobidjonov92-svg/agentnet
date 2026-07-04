"use client";
import { useState } from "react";
import { Menu, X, Sparkles } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { BalanceWidget } from "@/components/billing/balance-widget";

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
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar email={email} name={name} />
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
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

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b glass px-4 sm:px-6">
          <div className="flex items-center gap-2 font-bold lg:hidden">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            AgentNet
          </div>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-2">
            <BalanceWidget />
            <ThemeToggle />
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setOpen(true)}
              className="lg:hidden"
              aria-label="Menu"
            >
              <Menu className="!h-5 !w-5" />
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-auto scroll-thin">
          <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
