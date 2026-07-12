"use client";
import { Shield } from "lucide-react";
import { useT } from "@/lib/i18n/client";

export function SecurityTab() {
  const { t } = useT();
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-soft">
      <h2 className="mb-4 font-semibold">{t("settings.security")}</h2>
      <div className="flex items-center gap-3 rounded-xl bg-secondary p-4">
        <Shield className="h-5 w-5 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">2FA (TOTP)</p>
          <p className="text-xs text-muted-foreground">Google Authenticator · coming soon</p>
        </div>
      </div>
    </div>
  );
}
