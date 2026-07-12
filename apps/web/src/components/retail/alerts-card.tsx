"use client";
import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { AlertTriangle, BellRing } from "lucide-react";

export function AlertsCard() {
  const api = useApiClient();
  const { t } = useT();
  const { data: alerts } = useQuery({ queryKey: ["retail-alerts"], queryFn: () => api.get<any[]>("/retail/alerts"), refetchInterval: 5000 });

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-soft">
      <h2 className="mb-3 inline-flex items-center gap-2 font-semibold"><BellRing className="h-4 w-4 text-primary" /> {t("retail.alerts")}</h2>
      {!alerts?.length ? (
        <p className="py-6 text-center text-sm text-muted-foreground">—</p>
      ) : (
        <div className="space-y-3">
          {alerts.map((a) => (
            <div key={a.id} className="flex items-start gap-3 rounded-xl border p-3">
              <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${a.severity === "critical" ? "text-destructive" : a.severity === "warning" ? "text-amber-500" : "text-primary"}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{a.title}</span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{a.kind}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${a.delivery === "sent" ? "bg-emerald-500/15 text-emerald-500" : "bg-secondary text-muted-foreground"}`}>
                    {a.channel}: {a.delivery}
                  </span>
                  {a.method && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs opacity-60">{a.method}</span>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{a.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
