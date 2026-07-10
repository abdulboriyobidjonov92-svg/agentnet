"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient, apiErrorMessage, blockedMessage } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import {
  Target, Loader2, Play, ChevronDown, ChevronUp, Trash2,
  CheckCircle2, Circle, Bot, ShieldAlert, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/error-state";
import ReactMarkdown from "react-markdown";

interface GoalTask {
  id: string;
  order: number;
  title: string;
  description?: string | null;
  agentRole?: string | null;
  cadence?: string | null;
  status: string;
  result?: string | null;
}

interface Goal {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  progress: number;
  tasks: GoalTask[];
  createdAt: string;
}

export default function GoalsPage() {
  const api = useApiClient();
  const { t } = useT();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [blockedReason, setBlockedReason] = useState<string | null>(null);

  const { data: goals, isError: goalsError, refetch: refetchGoals } = useQuery({
    queryKey: ["goals"],
    queryFn: () => api.get<Goal[]>("/goals"),
  });

  const createGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError("");
    setBlockedReason(null);
    try {
      const goal = await api.post<Goal>("/goals", { title: title.trim() });
      setTitle("");
      setExpanded(goal.id);
      queryClient.invalidateQueries({ queryKey: ["goals"] });
    } catch (err: any) {
      if (err.payload?.blocked) setBlockedReason(err.payload?.reason ?? null);
      else setError(apiErrorMessage(err, t));
    } finally {
      setCreating(false);
    }
  };

  const advance = async (id: string) => {
    setAdvancingId(id);
    try {
      await api.post(`/goals/${id}/advance`, {});
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      setExpanded(id);
    } finally {
      setAdvancingId(null);
    }
  };

  const remove = async (id: string) => {
    await api.delete(`/goals/${id}`);
    queryClient.invalidateQueries({ queryKey: ["goals"] });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Target className="h-6 w-6 text-primary" /> {t("goals.title")}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("goals.subtitle")}</p>
      </div>

      <form onSubmit={createGoal} className="space-y-3 rounded-2xl border bg-card p-4 shadow-soft">
        <div className="flex gap-2">
          <Input
            required
            minLength={5}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("goals.ph")}
            className="flex-1"
          />
          <Button type="submit" disabled={creating || title.trim().length < 5} className="h-11 shrink-0">
            {creating ? <Loader2 className="animate-spin" /> : <Target />}
            {creating ? t("goals.creating") : t("goals.create")}
          </Button>
        </div>
        {blockedReason !== null && (
          <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <ShieldAlert className="h-4 w-4" /> {blockedMessage(blockedReason, t)}
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" /> {t("goals.autoNote")}
        </p>
      </form>

      {goalsError ? (
        <ErrorState onRetry={() => refetchGoals()} />
      ) : !goals?.length ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          {t("goals.empty")}
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => {
            const isOpen = expanded === goal.id;
            const done = goal.tasks.filter((tk) => tk.status === "done").length;
            return (
              <div key={goal.id} className="rounded-2xl border bg-card shadow-soft">
                <div className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-semibold">{goal.title}</h3>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          goal.status === "completed" ? "bg-primary/10 text-primary" : "bg-gold/10 text-gold",
                        )}
                      >
                        {t(`goals.status.${goal.status}`) !== `goals.status.${goal.status}`
                          ? t(`goals.status.${goal.status}`)
                          : goal.status}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400 transition-all duration-700"
                          style={{ width: `${goal.progress}%` }}
                        />
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-primary">{goal.progress}%</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {done}/{goal.tasks.length} {t("goals.tasksDone")}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {goal.status === "active" && (
                      <Button
                        size="sm"
                        onClick={() => advance(goal.id)}
                        disabled={advancingId !== null}
                      >
                        {advancingId === goal.id ? (
                          <>
                            <Loader2 className="animate-spin" /> {t("goals.advancing")}
                          </>
                        ) : (
                          <>
                            <Play /> {t("goals.advance")}
                          </>
                        )}
                      </Button>
                    )}
                    <button
                      onClick={() => setExpanded(isOpen ? null : goal.id)}
                      aria-label={isOpen ? t("common.back") : t("goals.tasksDone")}
                      aria-expanded={isOpen}
                      className="-m-1.5 rounded-lg p-3.5 text-muted-foreground transition hover:bg-muted"
                    >
                      {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => remove(goal.id)}
                      aria-label={t("common.delete")}
                      className="-m-1.5 rounded-lg p-3.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="space-y-2 border-t p-4">
                    {goal.tasks.map((task) => (
                      <TaskRow key={task.id} task={task} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TaskRow({ task }: { task: GoalTask }) {
  const { t } = useT();
  const [showResult, setShowResult] = useState(false);
  const isDone = task.status === "done";

  return (
    <div className={cn("rounded-xl border p-3", isDone && "border-primary/30 bg-primary/[0.03]")}>
      <div className="flex items-start gap-2.5">
        {isDone ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        ) : (
          <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-medium", isDone && "text-primary")}>{task.title}</p>
          {task.description && <p className="text-xs text-muted-foreground">{task.description}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {task.agentRole && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
                <Bot className="h-3 w-3" /> {task.agentRole}
              </span>
            )}
            {task.cadence && task.cadence !== "once" && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">{task.cadence}</span>
            )}
            {isDone && task.result && (
              <button
                onClick={() => setShowResult(!showResult)}
                className="text-[11px] font-semibold text-primary hover:underline"
              >
                {t("goals.result")} {showResult ? "▲" : "▼"}
              </button>
            )}
          </div>
          {showResult && task.result && (
            <div className="prose prose-sm mt-2 max-w-none rounded-lg bg-muted/50 p-3 text-xs dark:prose-invert">
              <ReactMarkdown>{task.result}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
