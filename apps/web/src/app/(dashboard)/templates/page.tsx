"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { toast } from "@/components/ui/toast";
import { Search, TrendingUp, Zap, Check, Loader2, Wrench, Store } from "lucide-react";
import { TemplatePreviewStrip } from "@/components/templates/template-preview-strip";

interface TemplateCard {
  id: string;
  profession: string;
  domain: string;
  vertical: string | null;
  complexity: number;
  flagship: string;
  price: { createUsd: number; monthlyUsd: number; createSom: number; monthlySom: number };
  tools: string[];
  modules: string[];
  depth: { prediction: boolean; autonomous: boolean };
}

export default function TemplatesPage() {
  const api = useApiClient();
  const qc = useQueryClient();
  const router = useRouter();
  const { t, locale } = useT();
  const [q, setQ] = useState("");
  const [installing, setInstalling] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["templates", locale],
    queryFn: () => api.get<TemplateCard[]>(`/templates?language=${locale}`),
  });

  const install = useMutation({
    mutationFn: (id: string) => api.post<{ agent: { id: string } }>(`/templates/${id}/install`, {}),
    onMutate: (id) => setInstalling(id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      router.push(`/agents/${res.agent.id}`);
    },
    onError: () => {
      setInstalling(null);
      toast({ variant: "destructive", title: t("common.error") });
    },
  });

  const som = (n: number) => n.toLocaleString("ru-RU");

  const filtered = (data ?? []).filter((tpl) => {
    if (!q.trim()) return true;
    const hay = `${tpl.profession} ${tpl.flagship} ${tpl.modules.join(" ")}`.toLowerCase();
    return q.toLowerCase().split(/\s+/).some((w) => w && hay.includes(w));
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("templates.title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("templates.subtitle")}</p>
        <Link href="/marketplace" className="mt-1 inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
          <Store className="h-3.5 w-3.5" /> {t("templates.wantCommunity")}
        </Link>
      </div>

      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("templates.search")}
          className="h-11 w-full rounded-xl border border-white/10 bg-background/40 pl-10 pr-4 text-sm outline-none transition focus:border-primary/40"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-2xl border bg-card" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-14 text-center">
          <h3 className="mb-1 text-lg font-semibold">{t("templates.emptyTitle")}</h3>
          <p className="mb-6 text-muted-foreground">{t("templates.emptyDesc")}</p>
          <Button asChild>
            <Link href="/agents/new">{t("templates.buildCustom")}</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tpl) => (
            <div
              key={tpl.id}
              className="flex flex-col rounded-2xl border border-white/10 bg-card p-5 shadow-soft transition hover:shadow-lift"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="font-semibold leading-tight">{tpl.profession}</h3>
                <span className="shrink-0 text-xs text-amber-400" title={`★${tpl.complexity}`}>
                  {"★".repeat(tpl.complexity)}
                </span>
              </div>
              <p className="mb-3 line-clamp-3 text-xs text-muted-foreground">{tpl.flagship}</p>

              <TemplatePreviewStrip profession={tpl.profession} tools={tpl.tools} depth={tpl.depth} />

              <div className="mb-3 flex flex-1 flex-wrap gap-1.5">
                {tpl.depth.prediction && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    <TrendingUp className="h-3 w-3" /> {t("templates.predicts")}
                  </span>
                )}
                {tpl.depth.autonomous && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-400">
                    <Zap className="h-3 w-3" /> {t("templates.autonomous")}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px]">
                  <Wrench className="h-3 w-3" /> {tpl.tools.length}
                </span>
              </div>

              <div className="mb-4 flex items-end justify-between border-t border-white/5 pt-3">
                <div>
                  <p className="text-sm font-bold">
                    {som(tpl.price.createSom)} <span className="text-xs font-normal text-muted-foreground">so'm</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">{t("templates.oneTime")} · ${tpl.price.createUsd}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">
                    {som(tpl.price.monthlySom)} <span className="text-xs font-normal text-muted-foreground">so'm</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">{t("templates.perMonth")}</p>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={() => install.mutate(tpl.id)}
                disabled={installing === tpl.id}
              >
                {installing === tpl.id ? (
                  <>
                    <Loader2 className="animate-spin" /> {t("templates.installing")}
                  </>
                ) : (
                  <>
                    <Check /> {t("templates.install")}
                  </>
                )}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
