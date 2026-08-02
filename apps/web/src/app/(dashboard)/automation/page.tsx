"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { Globe, Play, Loader2, CheckCircle2, XCircle, ShieldAlert, ChevronDown, KeyRound, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/error-state";

/** S1: Universal App Control (Tier 1) — brauzer-avtomatlashtirish UI. */
export default function AutomationPage() {
  const api = useApiClient();
  const qc = useQueryClient();
  const { t } = useT();
  const [goal, setGoal] = useState("");
  const [startUrl, setStartUrl] = useState("");
  const [lastRun, setLastRun] = useState<any>(null);
  const [openRun, setOpenRun] = useState<string | null>(null);

  const { data: runs, isError: runsError, refetch: refetchRuns } = useQuery({
    queryKey: ["automation-runs"],
    queryFn: () => api.get<any[]>("/automation/runs"),
  });

  const runMutation = useMutation({
    mutationFn: () =>
      api.post<any>("/automation/run", { goal, startUrl: startUrl || undefined }),
    onSuccess: (data) => {
      setLastRun(data);
      qc.invalidateQueries({ queryKey: ["automation-runs"] });
    },
    onError: (e: any) => {
      setLastRun({ status: "blocked", result: { summary: e?.payload?.reason ?? e.message } });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("auto.title")}</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">{t("auto.subtitle")}</p>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-soft">
        <label className="mb-1.5 block text-sm font-medium">{t("auto.goal")}</label>
        <Textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder={t("auto.goalPh")}
          rows={3}
        />
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            value={startUrl}
            onChange={(e) => setStartUrl(e.target.value)}
            placeholder={t("auto.startUrl")}
            className="flex-1"
          />
          <Button
            onClick={() => runMutation.mutate()}
            disabled={!goal.trim() || runMutation.isPending}
          >
            {runMutation.isPending ? (
              <><Loader2 className="animate-spin" /> {t("auto.running")}</>
            ) : (
              <><Play /> {t("auto.run")}</>
            )}
          </Button>
        </div>
      </div>

      <SessionsCard t={t} />

      {lastRun && <RunCard run={lastRun} t={t} expanded />}

      {runsError && <ErrorState onRetry={() => refetchRuns()} />}

      {!!runs?.length && (
        <div>
          <h2 className="mb-3 font-semibold">{t("auto.history")}</h2>
          <div className="space-y-3">
            {runs.map((r) => (
              <div key={r.id} onClick={() => setOpenRun(openRun === r.id ? null : r.id)} className="cursor-pointer">
                <RunCard run={r} t={t} expanded={openRun === r.id} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * BOSQICH 0 — brauzer-agent sessiyalari (ko'rish/o'chirish). Sessiya QO'LGA
 * KIRITISH oqimi (headful login-capture) ADR-010 bo'yicha rad etilgan — hosted
 * muhitda ishlamaydi. Bu karta faqat allaqachon saqlangan sessiyalarni
 * ko'rsatadi/o'chiradi; qo'shish oqimi kontrakt-mos usul bilan keyinroq qaytadi.
 */
function SessionsCard({ t }: { t: (k: string) => string }) {
  const api = useApiClient();
  const qc = useQueryClient();

  const { data: sessions } = useQuery({
    queryKey: ["browser-sessions"],
    queryFn: () => api.get<any[]>("/automation/sessions"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => api.delete(`/automation/sessions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["browser-sessions"] }),
  });

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-soft">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-primary" />
        <h2 className="font-semibold">{t("auto.sessions")}</h2>
      </div>
      <p className="mt-1.5 max-w-2xl text-xs text-muted-foreground">{t("auto.sessionsHint")}</p>

      <div className="mt-4 space-y-2">
        {sessions?.length ? (
          sessions.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-xl border bg-background/50 px-3 py-2">
              <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{s.label || s.domain}</p>
                <p className="text-xs text-muted-foreground">
                  {s.domain} · {s.cookieCount} {t("auto.cookies")} ·{" "}
                  {t("auto.lastUsed")}: {s.lastUsedAt ? new Date(s.lastUsedAt).toLocaleString() : t("auto.never")}
                </p>
              </div>
              <button
                onClick={() => delMut.mutate(s.id)}
                disabled={delMut.isPending}
                className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                aria-label={t("auto.deleteSession")}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground">{t("auto.noSessions")}</p>
        )}
      </div>
    </div>
  );
}

function RunCard({ run, t, expanded }: { run: any; t: (k: string) => string; expanded?: boolean }) {
  const statusIcon =
    run.status === "completed" ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> :
    run.status === "blocked" ? <ShieldAlert className="h-4 w-4 text-amber-500" /> :
    run.status === "running" ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> :
    <XCircle className="h-4 w-4 text-destructive" />;

  const steps = (run.steps as any[]) ?? [];
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-soft">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Globe className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{run.goal}</p>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            {statusIcon}
            <span>{run.status}</span>
            {run.method && <span className="rounded-full bg-secondary px-2 py-0.5">{run.method}</span>}
            {steps.length > 0 && <span>{steps.length} {t("auto.steps").toLowerCase()}</span>}
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition ${expanded ? "rotate-180" : ""}`} />
      </div>

      {expanded && (
        <div className="mt-4 space-y-3 border-t pt-4">
          {run.result?.summary && <p className="text-sm">{run.result.summary}</p>}
          {run.result?.extracted && (
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-muted p-3 text-xs">
              {run.result.extracted}
            </pre>
          )}
          {steps.length > 0 && (
            <ol className="space-y-1.5">
              {steps.map((s: any, i: number) => (
                <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                  <span className="font-mono text-primary">{s.step}.</span>
                  <span className="font-medium">{s.action}</span>
                  {s.target && <span className="truncate">{s.target}</span>}
                  <span className="truncate opacity-70">— {s.observation}</span>
                </li>
              ))}
            </ol>
          )}
          {run.result?.finalUrl && (
            <p className="text-xs text-muted-foreground">
              → {run.result.finalUrl} {run.result.finalTitle ? `— "${run.result.finalTitle}"` : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
