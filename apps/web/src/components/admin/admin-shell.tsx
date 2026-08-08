"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, ScrollText, MessageSquareWarning, ArrowLeft, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

/**
 * Phase 4 §6.2 — admin qobig'i.
 *
 * Dashboard'dan ATAYLAB farq qiladi: doim ko'rinadigan qizil "ADMIN REJIM"
 * chizig'i (operator qaysi kontekstda ekanini bir qarashda bilishi shart —
 * bu xavfli amallar kiritilganda (SEC-11) yanada muhim bo'ladi).
 *
 * Navigatsiya §6.3 dagi tartibda, LEKIN faqat shu birlikda qurilgan
 * ekranlar ko'rsatiladi — ishlamaydigan havolalar qo'yilmaydi (Rule #38:
 * "keyin kerak bo'ladi" o'lik kod taqiqlanadi).
 */
const NAV = [
  { href: "/admin/users", labelKey: "admin.navUsers", icon: Users },
  { href: "/admin/audit", labelKey: "admin.navAudit", icon: ScrollText },
  { href: "/admin/feedback", labelKey: "admin.navFeedback", icon: MessageSquareWarning },
] as const;

export function AdminShell({
  email,
  name,
  children,
}: {
  email: string;
  name?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { t } = useT();

  return (
    <div className="min-h-screen bg-background">
      {/* ADMIN REJIM indikatori — §6.2 talabi, doim ko'rinadi */}
      <div className="sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-danger/30 bg-danger/10 px-4 py-2 backdrop-blur">
        <div className="flex items-center gap-2 text-danger">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider">{t("admin.mode")}</span>
        </div>
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("admin.exit")}
        </Link>
      </div>

      <div className="mx-auto flex max-w-[1600px] gap-6 px-4 py-6 lg:px-6">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-20 space-y-1">
            <p className="px-3 pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("admin.title")}
            </p>
            <nav aria-label={t("admin.title")}>
              {NAV.map(({ href, labelKey, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition",
                      active
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {t(labelKey)}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-4 border-t pt-3">
              <p className="truncate px-3 text-xs text-muted-foreground" title={email}>
                {name || email}
              </p>
            </div>
          </div>
        </aside>

        {/* Mobil navigatsiya */}
        <div className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-surface-1/95 backdrop-blur lg:hidden">
          {NAV.map(({ href, labelKey, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {t(labelKey)}
              </Link>
            );
          })}
        </div>

        <main className="min-w-0 flex-1 pb-20 lg:pb-0">{children}</main>
      </div>
    </div>
  );
}
