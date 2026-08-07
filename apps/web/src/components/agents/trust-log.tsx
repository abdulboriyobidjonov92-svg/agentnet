"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";
import { ErrorState } from "@/components/ui/error-state";
import { isPositiveTiyin, tiyinToSom, type TiyinValue } from "@/lib/money";

interface TrustLogEntry {
  action: string;
  metadata: Record<string, any> | null;
  createdAt: string;
}

function describeEntry(entry: TrustLogEntry, t: (k: string) => string, som: (n: number) => string): string {
  const m = entry.metadata ?? {};
  // A13: audit metadata'da pul SATR sifatida saqlanadi (Json BigInt ni
  // qabul qilmaydi) — umumiy helper ikkala shaklni ham to'g'ri o'qiydi.
  const price = (v: unknown) => som(tiyinToSom(v as TiyinValue));

  switch (entry.action) {
    case "agent.create": {
      let text = t("trust.created").replace("{price}", price(m.creationPriceTiyin));
      if (isPositiveTiyin(m.monthlyPriceTiyin)) {
        text += t("trust.createdMonthly").replace("{price}", price(m.monthlyPriceTiyin));
      }
      return text;
    }
    case "agent.delete":
      return t("trust.deleted");
    case "agent.monthly_charge":
      return t("trust.monthlyCharge").replace("{price}", price(m.amountTiyin));
    case "agent.frozen":
      return t("trust.frozen").replace("{retries}", String(m.retries ?? 0)).replace("{price}", price(m.amountTiyin));
    case "agent.charge_retry":
      return t("trust.chargeRetry").replace("{retries}", String(m.retries ?? 0));
    case "marketplace.publish":
      return t("trust.published");
    case "marketplace.install":
      return t("trust.installedByOther").replace("{price}", price(m.pricePaid));
    case "agent.install_recommended":
      return t("trust.installRecommended").replace("{domain}", String(m.domain ?? ""));
    default:
      return entry.action;
  }
}

export function TrustLog({ agentId }: { agentId: string }) {
  const { t } = useT();
  const api = useApiClient();
  const [open, setOpen] = useState(false);
  const { data, isError, refetch } = useQuery({
    queryKey: ["trust-log", agentId],
    queryFn: () => api.get<TrustLogEntry[]>(`/agents/${agentId}/trust-log`),
    enabled: open,
  });
  const som = (n: number) => n.toLocaleString("ru-RU");

  return (
    <div className="shrink-0 rounded-xl border bg-card">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm font-medium"
      >
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-primary" /> {t("trust.title")}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="max-h-56 overflow-y-auto border-t p-3">
          {isError ? (
            <ErrorState onRetry={() => refetch()} className="p-2" />
          ) : !data?.length ? (
            <p className="text-sm text-muted-foreground">{t("trust.empty")}</p>
          ) : (
            <ol className="space-y-2.5">
              {data.map((entry, i) => (
                <li key={i} className="flex flex-col gap-0.5 text-sm sm:flex-row sm:gap-2">
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleString()}
                  </span>
                  <span>{describeEntry(entry, t, som)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
