"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/api-client";
import { Bot, Download, Search, Sparkles, Check } from "lucide-react";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";

export default function MarketplacePage() {
  const api = useApiClient();
  const qc = useQueryClient();
  const { t } = useT();
  const [search, setSearch] = useState("");
  const [installing, setInstalling] = useState<string | null>(null);
  const [installed, setInstalled] = useState<string[]>([]);

  const { data: agents } = useQuery({
    queryKey: ["marketplace", search],
    queryFn: () => api.getPublic<any[]>(`/marketplace${search ? `?search=${search}` : ""}`),
  });

  const installMutation = useMutation({
    mutationFn: (agentId: string) => api.post<any>(`/marketplace/${agentId}/install`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents"] }),
  });

  const handleInstall = async (id: string) => {
    setInstalling(id);
    await installMutation.mutateAsync(id).catch(() => {}).finally(() => setInstalling(null));
    setInstalled((p) => [...p, id]);
  };

  const BUILTIN = [
    { id: "builtin-namoz", name: t("landing.a1"), description: t("landing.a1d"), tools: ["islam.prayer_times", "islam.quran_surah"] },
    { id: "builtin-health", name: t("landing.a2"), description: t("landing.a2d"), tools: ["health.symptom_check", "health.calorie_estimate"] },
    { id: "builtin-finance", name: t("landing.a3"), description: t("landing.a3d"), tools: ["finance.get_transactions", "finance.currency_rates"] },
    { id: "builtin-assistant", name: t("landing.a4"), description: t("landing.a4d"), tools: ["calendar.get_events", "utility.weather"] },
    { id: "builtin-mental", name: t("landing.a5"), description: t("landing.a5d"), tools: [] },
    { id: "builtin-business", name: t("landing.a6"), description: t("landing.a6d"), tools: ["finance.get_transactions"] },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("market.title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("market.subtitle")}</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder={t("common.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border bg-card py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
        />
      </div>

      {!search && (
        <div>
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold" />
            <h2 className="font-semibold">{t("market.builtin")}</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {BUILTIN.map((agent) => (
              <Card
                key={agent.id}
                agent={agent}
                onInstall={handleInstall}
                installing={installing === agent.id}
                done={installed.includes(agent.id)}
                installLabel={t("market.install")}
                installedLabel={t("market.installed")}
              />
            ))}
          </div>
        </div>
      )}

      {!!agents?.length && (
        <div>
          <h2 className="mb-4 font-semibold">{t("market.community")}</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent: any) => (
              <Card
                key={agent.id}
                agent={agent}
                onInstall={handleInstall}
                installing={installing === agent.id}
                done={installed.includes(agent.id)}
                installLabel={t("market.install")}
                installedLabel={t("market.installed")}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ agent, onInstall, installing, done, installLabel, installedLabel }: any) {
  return (
    <div className="flex flex-col rounded-2xl border bg-card p-5 shadow-soft transition hover:shadow-lift">
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Bot className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{agent.name}</h3>
          {agent.user?.email && <p className="truncate text-xs text-muted-foreground">by {agent.user.email}</p>}
        </div>
      </div>
      {agent.description && <p className="mb-3 flex-1 text-sm text-muted-foreground">{agent.description}</p>}
      {agent.tools?.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {agent.tools.map((tool: string) => (
            <span key={tool} className="rounded-full bg-secondary px-2 py-0.5 text-xs">{tool.split(".")[1]}</span>
          ))}
        </div>
      )}
      <button
        onClick={() => onInstall(agent.id)}
        disabled={installing || done}
        className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition hover:brightness-110 disabled:opacity-60"
      >
        {done ? <><Check className="h-4 w-4" /> {installedLabel}</> : <><Download className="h-4 w-4" /> {installLabel}</>}
      </button>
    </div>
  );
}
