"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/api-client";
import { Bot, Plus, Trash2, Settings, MessageSquare, Snowflake, Wallet, Hourglass, TimerReset } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { toast } from "@/components/ui/toast";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";

export default function AgentsPage() {
  const api = useApiClient();
  const qc = useQueryClient();
  const { t } = useT();
  const [confirmAgent, setConfirmAgent] = useState<any | null>(null);

  const { data: agents, isLoading, isError, refetch } = useQuery({
    queryKey: ["agents"],
    queryFn: () => api.get<any[]>("/agents"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/agents/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents"] }),
    onError: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      toast({ variant: "destructive", title: t("common.error") });
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => api.post(`/agents/${id}/reactivate`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents"] }),
    onError: (e: any) => {
      toast({ variant: "destructive", title: t("agents.frozenReactivateFailed"), description: e.message });
    },
  });

  /** Linear patterni: optimistik olib tashlash + 5s undo; server DELETE undo muddati o'tgach. */
  const executeDelete = () => {
    const agent = confirmAgent;
    if (!agent) return;
    setConfirmAgent(null);
    qc.setQueryData(["agents"], (old: any[] | undefined) => old?.filter((a) => a.id !== agent.id));
    const timer = setTimeout(() => deleteMutation.mutate(agent.id), 5000);
    toast({
      title: t("agents.deleted"),
      description: agent.name,
      duration: 5000,
      action: {
        label: t("common.undo"),
        onClick: () => {
          clearTimeout(timer);
          qc.invalidateQueries({ queryKey: ["agents"] });
        },
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("agents.title")}</h1>
          <p className="mt-1 text-muted-foreground">{t("agents.subtitle")}</p>
        </div>
        <Button asChild>
          <Link href="/agents/new">
            <Plus /> {t("agents.new")}
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-52 animate-pulse rounded-2xl border bg-card" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !agents?.length ? (
        <EmptyStateGuide />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent: any) => (
            <div key={agent.id} className="group rounded-2xl border bg-card p-5 shadow-soft transition hover:shadow-lift">
              <div className="mb-3 flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                  <Link href={`/agents/${agent.id}/settings`} aria-label={t("agents.settings")} className="-m-2 rounded-lg p-3.5 hover:bg-muted">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                  </Link>
                  <button onClick={() => setConfirmAgent(agent)} aria-label={t("common.delete")} className="-m-2 rounded-lg p-3.5 hover:bg-destructive/10">
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
                {agent.frozen ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-500">
                    {agent.frozenReason === "trial_expired" ? (
                      <>
                        <Hourglass className="h-3 w-3" /> {t("agents.trialExpired")}
                      </>
                    ) : (
                      <>
                        <Snowflake className="h-3 w-3" /> {t("agents.frozen")}
                      </>
                    )}
                  </span>
                ) : (
                  agent.isTrialAgent && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-500">
                      <TimerReset className="h-3 w-3" /> {t("agents.trialBadge").replace("{count}", String(agent.trialMessageCount ?? 0))}
                    </span>
                  )
                )}
              </div>
              {agent.frozen ? (
                <Button
                  variant="outline"
                  className="mt-4 w-full"
                  onClick={() => reactivateMutation.mutate(agent.id)}
                  disabled={reactivateMutation.isPending}
                >
                  <Wallet /> {agent.frozenReason === "trial_expired" ? t("agents.payToContinue") : t("agents.reactivate")}
                </Button>
              ) : (
                <Button asChild variant="subtle" className="mt-4 w-full">
                  <Link href={`/agents/${agent.id}`}>
                    <MessageSquare /> {t("agents.chat")}
                  </Link>
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!confirmAgent} onOpenChange={(o) => !o && setConfirmAgent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("agents.deleteConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>{confirmAgent?.name}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction destructive onClick={executeDelete}>
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Bo'sh holat yo'l-ko'rsatuvi (PLG activation): agent hali yo'q bo'lsa bo'sh
// ekran o'rniga 3 ta eng ommabop shablonni bir-bosishda o'rnatish taklifi.
function EmptyStateGuide() {
  const api = useApiClient();
  const qc = useQueryClient();
  const { t, locale } = useT();
  const [installing, setInstalling] = useState<string | null>(null);

  // /templates ro'yxati install-count bo'yicha saralangan — birinchi 3 = eng ommabop
  const { data: templates } = useQuery({
    queryKey: ["templates", locale],
    queryFn: () => api.get<any[]>(`/templates?language=${locale}`),
  });
  const top3 = (templates ?? []).slice(0, 3);

  const install = useMutation({
    mutationFn: (id: string) => api.post<{ agent: { id: string } }>(`/templates/${id}/install`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      toast({ title: t("agents.emptyInstalled") });
    },
    onError: (e: any) => toast({ variant: "destructive", title: t("common.error"), description: e.message }),
    onSettled: () => setInstalling(null),
  });

  return (
    <div className="rounded-2xl border border-dashed p-10 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <Bot className="h-8 w-8 text-primary" />
      </div>
      <h3 className="mb-1 text-lg font-semibold">{t("agents.empty")}</h3>
      <p className="mb-6 text-muted-foreground">{t("agents.emptyGuide")}</p>

      {top3.length > 0 && (
        <div className="mx-auto mb-6 grid max-w-2xl gap-3 sm:grid-cols-3">
          {top3.map((tpl) => (
            <button
              key={tpl.id}
              disabled={installing !== null}
              onClick={() => {
                setInstalling(tpl.id);
                install.mutate(tpl.id);
              }}
              className="group rounded-2xl border bg-card p-4 text-left shadow-soft transition hover:border-primary/40 hover:shadow-lift disabled:opacity-60"
            >
              <p className="font-medium leading-tight">{tpl.profession}</p>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{tpl.flagship}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
                {installing === tpl.id ? (
                  <Hourglass className="h-3 w-3 animate-pulse" />
                ) : (
                  <Plus className="h-3 w-3 transition group-hover:rotate-90" />
                )}
                {installing === tpl.id ? t("templates.installing") : t("agents.emptyInstall")}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="flex justify-center gap-3">
        <Button asChild>
          <Link href="/agents/new">{t("common.create")}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/templates">{t("nav.templates")}</Link>
        </Button>
      </div>
    </div>
  );
}
