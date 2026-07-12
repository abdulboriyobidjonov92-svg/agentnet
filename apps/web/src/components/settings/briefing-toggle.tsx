"use client";
import { useState } from "react";
import { useApiClient } from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";

// Haftalik Telegram-brifing opt-in/out (PLG retention)
export function BriefingToggle({ profile }: { profile: any }) {
  const { t } = useT();
  const api = useApiClient();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const enabled = profile?.briefingOptIn !== false;

  const toggle = async () => {
    setSaving(true);
    try {
      await api.patch("/users/me", { briefingOptIn: !enabled });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-soft">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold">{t("briefing.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("briefing.desc")}
            {!profile?.telegramChatId && <span className="block text-xs text-amber-500/90">{t("briefing.needTelegram")}</span>}
          </p>
        </div>
        <Button size="sm" variant={enabled ? "default" : "outline"} onClick={toggle} disabled={saving || !profile}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : enabled ? t("briefing.on") : t("briefing.off")}
        </Button>
      </div>
    </div>
  );
}
