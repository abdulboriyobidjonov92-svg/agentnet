"use client";
import { useState } from "react";
import { useApiClient } from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";
import { Check, Gift, Copy } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";

// Referral (taklif) kartasi — kod + havola + statistika (PLG)
export function ReferralCard() {
  const { t } = useT();
  const api = useApiClient();
  const [copied, setCopied] = useState(false);

  const { data } = useQuery({
    queryKey: ["referral-me"],
    queryFn: () => api.get<{ code: string | null; invitedCount: number; bonusSom: number; earnedSom: number }>("/referral/me"),
  });

  const link = data?.code ? `${typeof window !== "undefined" ? window.location.origin : ""}/sign-up?ref=${data.code}` : null;

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard yopiq */
    }
  };

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-soft">
      <div className="mb-1 flex items-center gap-2">
        <Gift className="h-4 w-4 text-primary" />
        <h2 className="font-semibold">{t("referral.title")}</h2>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        {t("referral.desc").replace("{bonus}", data ? data.bonusSom.toLocaleString("ru-RU") : "…")}
      </p>
      {link ? (
        <div className="flex items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2">
          <span className="flex-1 truncate font-mono text-xs text-muted-foreground">{link}</span>
          <Button size="icon-sm" variant="outline" onClick={copy} aria-label={t("referral.copy")}>
            {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-3 text-center">
        <div className="rounded-xl border p-3">
          <p className="text-2xl font-bold">{data?.invitedCount ?? "…"}</p>
          <p className="text-xs text-muted-foreground">{t("referral.invited")}</p>
        </div>
        <div className="rounded-xl border p-3">
          <p className="text-2xl font-bold">{data ? `${data.earnedSom.toLocaleString("ru-RU")}` : "…"}</p>
          <p className="text-xs text-muted-foreground">{t("referral.earned")}</p>
        </div>
      </div>
    </div>
  );
}
