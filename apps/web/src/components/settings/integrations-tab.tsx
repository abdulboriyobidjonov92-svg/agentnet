"use client";
import { useState } from "react";
import { useApiClient, apiErrorMessage } from "@/lib/api-client";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";

export function TelegramIntegrationRow({ connected }: { connected: boolean }) {
  const { t } = useT();
  const api = useApiClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const connect = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.post<{ url: string | null }>("/telegram/link-code", {});
      if (res.url) {
        window.open(res.url, "_blank");
      } else {
        setError(t("integrations.telegramNotConfigured"));
      }
    } catch (err) {
      setError(apiErrorMessage(err, t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Telegram Bot</p>
          <p className="text-xs text-muted-foreground">{t("integrations.telegramDesc")}</p>
        </div>
        {connected ? (
          <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            {t("integrations.connected")}
          </span>
        ) : (
          <Button size="sm" variant="outline" onClick={connect} disabled={loading} className="shrink-0">
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t("integrations.connect")}
          </Button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function IntegrationsTab({ profile }: { profile: any }) {
  const items = [
    { name: "Google Calendar", desc: "Events and reminders", status: "soon", color: "text-muted-foreground bg-muted" },
    { name: "Payme", desc: "Uzbekistan payments", status: "sandbox", color: "text-gold bg-gold/10" },
    { name: "Click", desc: "Uzbekistan payments", status: "sandbox", color: "text-gold bg-gold/10" },
    { name: "Stripe", desc: "Global payments", status: "soon", color: "text-muted-foreground bg-muted" },
  ];
  return (
    <div className="space-y-3">
      <TelegramIntegrationRow connected={!!profile?.telegramChatId} />
      {items.map((i) => (
        <div key={i.name} className="flex items-center justify-between rounded-2xl border bg-card p-4 shadow-soft">
          <div>
            <p className="text-sm font-medium">{i.name}</p>
            <p className="text-xs text-muted-foreground">{i.desc}</p>
          </div>
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", i.color)}>{i.status}</span>
        </div>
      ))}
    </div>
  );
}
