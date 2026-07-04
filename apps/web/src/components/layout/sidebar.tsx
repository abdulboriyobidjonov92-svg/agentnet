"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Bot, Store, Settings, LogOut, Sparkles, Plus, CircleUserRound, Target, Users, Zap, Building2, Globe, Plug, Camera, CalendarClock, Ship, Landmark, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { clearClientSession } from "@/lib/session";
import { useT } from "@/lib/i18n/client";
import { LanguageSwitcher } from "@/components/language-switcher";

const COLLAPSE_KEY = "agentnet_nav_collapsed";

export function Sidebar({ email, name, onNavigate }: { email?: string; name?: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useT();

  // 15 band -> 4 mantiqiy guruh; yig'ilish holati localStorage'da saqlanadi
  const GROUPS = [
    {
      id: "main",
      label: t("nav.groupMain"),
      items: [
        { href: "/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
        { href: "/agents", label: t("nav.agents"), icon: Bot },
        { href: "/twin", label: t("nav.twin"), icon: CircleUserRound },
        { href: "/goals", label: t("nav.goals"), icon: Target },
      ],
    },
    {
      id: "power",
      label: t("nav.groupPower"),
      items: [
        { href: "/fusion", label: t("nav.fusion"), icon: Users },
        { href: "/supermode", label: t("nav.supermode"), icon: Zap },
        { href: "/automation", label: t("nav.automation"), icon: Globe },
        { href: "/connectors", label: t("nav.connectors"), icon: Plug },
      ],
    },
    {
      id: "industries",
      label: t("nav.groupIndustries"),
      items: [
        { href: "/agentos", label: t("nav.agentos"), icon: Building2, enterprise: true },
        { href: "/retail", label: t("nav.retail"), icon: Camera },
        { href: "/operations", label: t("nav.operations"), icon: CalendarClock },
        { href: "/trade", label: t("nav.trade"), icon: Ship },
        { href: "/govtech", label: t("nav.govtech"), icon: Landmark },
      ],
    },
    {
      id: "system",
      label: t("nav.groupSystem"),
      items: [
        { href: "/marketplace", label: t("nav.marketplace"), icon: Store },
        { href: "/settings", label: t("nav.settings"), icon: Settings },
      ],
    },
  ];

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem(COLLAPSE_KEY) ?? "{}");
    } catch {
      return {};
    }
  });

  const toggleGroup = (id: string) =>
    setCollapsed((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });

  const signOut = () => {
    clearClientSession();
    router.push("/sign-in");
    router.refresh();
  };

  const initial = (name || email || "?").charAt(0).toUpperCase();

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r bg-card">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
          <Sparkles className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="text-lg font-bold tracking-tight">AgentNet</span>
      </div>

      <div className="px-3 pb-2 pt-1">
        <Button asChild className="w-full">
          <Link onClick={onNavigate} href="/agents/new">
            <Plus /> {t("nav.newAgent")}
          </Link>
        </Button>
      </div>

      <nav className="scroll-thin flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {GROUPS.map((group) => {
          const hasActive = group.items.some(
            ({ href }) => pathname === href || pathname.startsWith(href + "/"),
          );
          // Aktiv sahifa guruh ichida bo'lsa — yig'ilgan bo'lsa ham ochib ko'rsatiladi
          const isOpen = !collapsed[group.id] || hasActive;
          return (
            <div key={group.id}>
              <button
                onClick={() => toggleGroup(group.id)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground transition hover:text-foreground"
              >
                {group.label}
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !isOpen && "-rotate-90")} />
              </button>
              {isOpen && (
                <div className="mt-0.5 space-y-1">
                  {group.items.map(({ href, label, icon: Icon, enterprise }) => {
                    const active = pathname === href || pathname.startsWith(href + "/");
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={onNavigate}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition glow-ring",
                          active
                            ? "bg-accent text-accent-foreground shadow-glow"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                          enterprise && !active && "border border-primary/20 bg-primary/[0.04]",
                        )}
                      >
                        <Icon className={cn("h-[18px] w-[18px] shrink-0", (active || enterprise) && "text-primary")} />
                        {label}
                        {enterprise && (
                          <span className="ml-auto rounded-full bg-primary/15 px-1.5 py-0.5 text-[11px] font-bold uppercase text-primary">
                            Pro
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="space-y-2 border-t p-3">
        <LanguageSwitcher />
        <div className="flex items-center gap-3 rounded-xl px-2 py-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{name || t("nav.user")}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={signOut}
            title={t("nav.signOut")}
            aria-label={t("nav.signOut")}
            className="hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut />
          </Button>
        </div>
      </div>
    </aside>
  );
}
