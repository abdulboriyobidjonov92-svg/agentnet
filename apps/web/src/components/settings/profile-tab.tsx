"use client";
import { useEffect, useState } from "react";
import { useApiClient } from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { Globe, Check, Loader2, Compass } from "lucide-react";
import { TOUR_EVENT } from "@/components/onboarding/product-tour";
import { cn } from "@/lib/utils";
import { useT, LOCALES } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getClientSession, setClientSession } from "@/lib/session";
import { ReferralCard } from "./referral-card";
import { BriefingToggle } from "./briefing-toggle";

// Faqat jamoa (org) ichidagi foydalanuvchiga ma'noli — yakka foydalanuvchida ko'rsatilmaydi
const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
  VIEWER: "Viewer",
};

export function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

export function ProfileTab({ profile }: { profile: any }) {
  const { t, locale, setLocale } = useT();
  const api = useApiClient();
  const queryClient = useQueryClient();
  const [name, setName] = useState(profile?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => setName(profile?.name ?? ""), [profile?.name]);

  const saveName = async () => {
    setSaving(true);
    try {
      await api.patch("/users/me", { name: name.trim() });
      const session = getClientSession();
      if (session) setClientSession({ ...session, name: name.trim() || undefined });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-6 shadow-soft">
        <h2 className="mb-4 font-semibold">{t("settings.profile")}</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 border-b py-2">
            <span className="text-sm text-muted-foreground">{t("settings.name")}</span>
            <div className="flex items-center gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("settings.namePh")}
                className="h-8 w-44 text-right text-sm"
              />
              <Button
                size="icon-sm"
                variant="outline"
                onClick={saveName}
                disabled={saving || name.trim() === (profile?.name ?? "")}
                aria-label={t("common.save")}
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
          {saved && <p className="text-right text-xs text-primary">{t("settings.nameSaved")}</p>}
          <Row label={t("settings.email")} value={profile?.email ?? "…"} />
          {profile?.orgId && <Row label={t("settings.role")} value={ROLE_LABELS[profile.role] ?? profile.role} />}
          <Row label={t("settings.businessAccount")} value={profile?.isBusinessAccount ? "✓" : "—"} />
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-soft">
        <div className="mb-4 flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">{t("settings.language")}</h2>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {LOCALES.map((l) => (
            <button
              key={l.code}
              onClick={() => setLocale(l.code)}
              className={cn(
                "flex items-center gap-2.5 rounded-xl border p-3 text-left transition",
                l.code === locale ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "hover:bg-muted",
              )}
            >
              <span className="text-xl">{l.flag}</span>
              <span className="flex-1 text-sm font-medium">{l.label}</span>
              {l.code === locale && <Check className="h-4 w-4 text-primary" />}
            </button>
          ))}
        </div>
      </div>

      <ReferralCard />

      <BriefingToggle profile={profile} />

      <div className="rounded-2xl border bg-card p-6 shadow-soft">
        <div className="mb-1 flex items-center gap-2">
          <Compass className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">{t("tour.replayTitle")}</h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">{t("tour.replayDesc")}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.dispatchEvent(new Event(TOUR_EVENT))}
        >
          {t("tour.replay")}
        </Button>
      </div>
    </div>
  );
}
