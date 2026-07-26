"use client";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2, LayoutDashboard, FolderTree, Package, Bot } from "lucide-react";
import { useApiClient } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

// Super-admin (User.role === "OWNER") gate. Haqiqiy himoya backend'da
// (AdminGuard, har bir /admin/* endpoint'ida) — bu shunchaki UI: OWNER
// bo'lmagan foydalanuvchi sahifani ko'rmaydi va /dashboard'ga qaytariladi.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const api = useApiClient();
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useT();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: () => api.get<{ role?: string }>("/users/me"),
  });

  const isOwner = profile?.role === "OWNER";

  useEffect(() => {
    if (!isLoading && profile && !isOwner) {
      router.replace("/dashboard");
    }
  }, [isLoading, profile, isOwner, router]);

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!isOwner) return null;

  const TABS = [
    { href: "/admin", label: t("admin.nav.dashboard"), icon: LayoutDashboard },
    { href: "/admin/categories", label: t("admin.nav.categories"), icon: FolderTree },
    { href: "/admin/products", label: t("admin.nav.products"), icon: Package },
    { href: "/admin/agents", label: t("admin.nav.agents"), icon: Bot },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("admin.title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("admin.subtitle")}</p>
      </div>

      <div className="flex gap-1 border-b">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" /> {label}
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}
