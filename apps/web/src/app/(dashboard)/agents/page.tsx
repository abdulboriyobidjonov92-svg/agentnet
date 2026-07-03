"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/api-client";
import { Bot, Plus, Trash2, Settings, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";

export default function AgentsPage() {
  const api = useApiClient();
  const qc = useQueryClient();
  const { t } = useT();
  const [deleting, setDeleting] = useState<string | null>(null);

  const { data: agents, isLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: () => api.get<any[]>("/agents"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/agents/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents"] }),
  });

  const handleDelete = async (id: string) => {
    if (!confirm(t("agents.deleteConfirm"))) return;
    setDeleting(id);
    await deleteMutation.mutateAsync(id).finally(() => setDeleting(null));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("agents.title")}</h1>
          <p className="mt-1 text-muted-foreground">{t("agents.subtitle")}</p>
        </div>
        <Link href="/agents/new" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition hover:brightness-110">
          <Plus className="h-4 w-4" /> {t("agents.new")}
        </Link>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-52 animate-pulse rounded-2xl border bg-card" />
          ))}
        </div>
      ) : !agents?.length ? (
        <div className="rounded-2xl border border-dashed p-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Bot className="h-8 w-8 text-primary" />
          </div>
          <h3 className="mb-1 text-lg font-semibold">{t("agents.empty")}</h3>
          <p className="mb-6 text-muted-foreground">{t("agents.emptyDesc")}</p>
          <div className="flex justify-center gap-3">
            <Link href="/agents/new" className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition hover:brightness-110">
              {t("common.create")}
            </Link>
            <Link href="/marketplace" className="rounded-xl border px-5 py-2.5 text-sm font-semibold transition hover:bg-muted">
              {t("nav.marketplace")}
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent: any) => (
            <div key={agent.id} className="group rounded-2xl border bg-card p-5 shadow-soft transition hover:shadow-lift">
              <div className="mb-3 flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                  <Link href={`/agents/${agent.id}/settings`} aria-label={t("agents.settings")} className="rounded-lg p-1.5 hover:bg-muted">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                  </Link>
                  <button onClick={() => handleDelete(agent.id)} disabled={deleting === agent.id} aria-label={t("common.delete")} className="rounded-lg p-1.5 hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                </div>
              </div>
              <h3 className="mb-1 truncate font-semibold">{agent.name}</h3>
              <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">{agent.systemPrompt}</p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{agent.model}</span>
                {agent.halalFilterEnabled && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Halal</span>
                )}
                {agent.isPublished && (
                  <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600">{t("nav.marketplace")}</span>
                )}
              </div>
              <Link href={`/agents/${agent.id}`} className="mt-4 flex items-center justify-center gap-1.5 rounded-xl bg-primary/10 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary hover:text-primary-foreground">
                <MessageSquare className="h-4 w-4" /> {t("agents.chat")}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
