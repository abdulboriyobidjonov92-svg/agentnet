"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Bot, Store, Settings, LogOut, Sparkles, Plus, CircleUserRound, Target, Users, Zap, Building2, Globe, Plug, Camera, CalendarClock, Ship, Landmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { clearClientSession } from "@/lib/session";
import { useT } from "@/lib/i18n/client";
import { LanguageSwitcher } from "@/components/language-switcher";

export function Sidebar({ email, name, onNavigate }: { email?: string; name?: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useT();

  const NAV = [
    { href: "/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
    { href: "/agents", label: t("nav.agents"), icon: Bot },
    { href: "/twin", label: t("nav.twin"), icon: CircleUserRound },
    { href: "/goals", label: t("nav.goals"), icon: Target },
    { href: "/fusion", label: t("nav.fusion"), icon: Users },
    { href: "/supermode", label: t("nav.supermode"), icon: Zap },
    { href: "/agentos", label: t("nav.agentos"), icon: Building2, enterprise: true },
    { href: "/automation", label: t("nav.automation"), icon: Globe },
    { href: "/connectors", label: t("nav.connectors"), icon: Plug },
    { href: "/retail", label: t("nav.retail"), icon: Camera },
    { href: "/operations", label: t("nav.operations"), icon: CalendarClock },
    { href: "/trade", label: t("nav.trade"), icon: Ship },
    { href: "/govtech", label: t("nav.govtech"), icon: Landmark },
    { href: "/marketplace", label: t("nav.marketplace"), icon: Store },
    { href: "/settings", label: t("nav.settings"), icon: Settings },
  ];

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
        <Link
          onClick={onNavigate}
          href="/agents/new"
          className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition hover:brightness-110"
        >
          <Plus className="h-4 w-4" /> {t("nav.newAgent")}
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-3">
        {NAV.map(({ href, label, icon: Icon, enterprise }) => {
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
                <span className="ml-auto rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary">
                  Pro
                </span>
              )}
            </Link>
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
          <button
            onClick={signOut}
            title={t("nav.signOut")}
            aria-label={t("nav.signOut")}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
