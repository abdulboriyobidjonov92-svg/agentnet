"use client";
import { useState } from "react";
import { useApiClient } from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";
import { Shield, Link2, User, Scale, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";
import { ErrorState } from "@/components/ui/error-state";
import { ProfileTab } from "@/components/settings/profile-tab";
import { ValuesTab } from "@/components/settings/values-tab";
import { SecurityTab } from "@/components/settings/security-tab";
import { IntegrationsTab } from "@/components/settings/integrations-tab";
import { AdminFeedbackTab } from "@/components/settings/admin-feedback-tab";

type Tab = "profile" | "values" | "security" | "integrations" | "admin";

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("profile");
  const api = useApiClient();
  const { t } = useT();

  const { data: profile, isError: profileError, refetch: refetchProfile } = useQuery({
    queryKey: ["profile"],
    queryFn: () => api.get<any>("/users/me"),
  });

  const isOwner = profile?.role === "OWNER";
  const TABS = [
    { id: "profile" as Tab, label: t("settings.profile"), icon: User },
    { id: "values" as Tab, label: t("values.title"), icon: Scale },
    { id: "security" as Tab, label: t("settings.security"), icon: Shield },
    { id: "integrations" as Tab, label: t("settings.integrations"), icon: Link2 },
    // Faqat admin (OWNER) — foydalanuvchi fikrlari shu yerga tushadi
    ...(isOwner ? [{ id: "admin" as Tab, label: t("admin.fb.tab"), icon: Inbox }] : []),
  ];

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("settings.title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("settings.subtitle")}</p>
      </div>

      <div className="flex gap-1 border-b">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "profile" &&
        (profileError ? <ErrorState onRetry={() => refetchProfile()} /> : <ProfileTab profile={profile} />)}
      {tab === "values" && <ValuesTab />}
      {tab === "security" && <SecurityTab />}
      {tab === "integrations" && <IntegrationsTab profile={profile} />}
      {tab === "admin" && isOwner && <AdminFeedbackTab />}
    </div>
  );
}
