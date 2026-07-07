"use client";
// NAV RAIL — Liquid Obsidian navigatsiyasi. Og'ir panel emas: qorong'uda
// suzayotgan shisha qirra. Aktiv yo'l — chapdagi tirik vena chizig'i.

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Bot, Store, Settings, LogOut, Plus, CircleUserRound, Target, Users, Zap, Building2, Globe, Plug, Camera, CalendarClock, Ship, Landmark, ChevronDown, Gem, LayoutTemplate } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { clearClientSession } from "@/lib/session";
import { useT } from "@/lib/i18n/client";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Magnetic } from "@/components/neuro/magnetic";

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
        { href: "/templates", label: t("nav.templates"), icon: LayoutTemplate },
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
        { href: "/pricing", label: t("nav.pricing"), icon: Gem },
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
    <aside className="glass-dark flex h-screen w-60 shrink-0 flex-col border-r border-white/[0.06]">
      {/* Brend — mono, tirik nuqta bilan */}
      <div className="flex h-16 items-center gap-3 px-5">
        <span
          className="heartbeat inline-block h-2 w-2 rounded-full"
          style={{
            background: "linear-gradient(135deg, hsl(var(--vein-cyan)), hsl(var(--vein-violet)))",
            boxShadow: "0 0 12px hsl(var(--vein-cyan) / 0.6)",
          }}
        />
        <span className="font-mono text-xs font-semibold uppercase tracking-[0.3em] text-foreground/90">
          AgentNet
        </span>
      </div>

      <div className="px-3 pb-3 pt-1">
        <Magnetic className="w-full">
          <Link
            onClick={onNavigate}
            href="/agents/new"
            className="mercury flex h-10 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold"
          >
            <Plus className="h-4 w-4" /> {t("nav.newAgent")}
          </Link>
        </Magnetic>
      </div>

      <nav className="scroll-thin flex-1 space-y-4 overflow-y-auto px-3 py-3">
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
                className="label-mono flex w-full items-center justify-between rounded-lg px-3 py-1.5 transition hover:text-foreground"
              >
                {group.label}
                <ChevronDown className={cn("h-3 w-3 transition-transform", !isOpen && "-rotate-90")} />
              </button>
              {isOpen && (
                <div className="mt-1 space-y-0.5">
                  {group.items.map(({ href, label, icon: Icon, enterprise }) => {
                    const active = pathname === href || pathname.startsWith(href + "/");
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={onNavigate}
                        className={cn(
                          "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                          active
                            ? "bg-white/[0.05] text-foreground"
                            : "text-muted-foreground hover:bg-white/[0.03] hover:text-foreground",
                        )}
                      >
                        {/* Tirik vena — aktiv yo'l belgisi */}
                        <span
                          aria-hidden
                          className={cn(
                            "absolute left-0 top-1/2 h-5 w-px -translate-y-1/2 rounded-full transition-opacity",
                            active ? "opacity-100" : "opacity-0 group-hover:opacity-40",
                          )}
                          style={{
                            background:
                              "linear-gradient(to bottom, hsl(var(--vein-cyan)), hsl(var(--vein-violet)))",
                            boxShadow: active ? "0 0 8px hsl(var(--vein-cyan) / 0.55)" : undefined,
                          }}
                        />
                        <Icon
                          className={cn(
                            "h-[17px] w-[17px] shrink-0 transition",
                            active ? "text-foreground" : "text-muted-foreground/70 group-hover:text-foreground/80",
                          )}
                        />
                        {label}
                        {enterprise && (
                          <span
                            role="link"
                            tabIndex={0}
                            title={t("pricing.title")}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              onNavigate?.();
                              router.push("/pricing");
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                e.stopPropagation();
                                onNavigate?.();
                                router.push("/pricing");
                              }
                            }}
                            className="vein-text ml-auto font-mono text-[10px] font-bold uppercase tracking-widest transition hover:opacity-80"
                          >
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

      <div className="space-y-2 border-t border-white/[0.06] p-3">
        <LanguageSwitcher />
        <div className="flex items-center gap-3 rounded-xl px-2 py-1">
          <div className="liquid-glass flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-foreground/90">
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
