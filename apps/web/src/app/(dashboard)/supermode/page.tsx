"use client";
import { useState } from "react";
import { useApiClient } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import {
  Zap, Loader2, ShieldAlert, ShieldCheck, CircleUserRound, CalendarDays,
  Bot, Globe, FileText, ExternalLink, ChevronDown, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

const STAGE_ICONS: Record<string, any> = {
  context: CircleUserRound,
  plan: CalendarDays,
  agents: Bot,
  ethics: ShieldCheck,
  knowledge: Globe,
  report: FileText,
};

interface Stage {
  id: string;
  title: string;
  output: any;
}

export default function SuperModePage() {
  const api = useApiClient();
  const { t } = useT();

  const [command, setCommand] = useState("");
  const [running, setRunning] = useState(false);
  const [stages, setStages] = useState<Stage[] | null>(null);
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(false);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    setRunning(true);
    setError("");
    setBlocked(false);
    setStages(null);
    try {
      const res = await api.post<{ stages: Stage[] }>("/supermode", {
        command: command.trim() || t("super.ph"),
      });
      setStages(res.stages);
    } catch (err: any) {
      if (err.payload?.blocked) setBlocked(true);
      else setError(err.message || "Error");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Zap className="h-6 w-6 text-gold" /> {t("super.title")}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("super.subtitle")}</p>
      </div>

      <form onSubmit={run} className="space-y-3 rounded-2xl border-2 border-gold/40 bg-gold/5 p-5">
        <div className="flex gap-2">
          <input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder={t("super.ph")}
            className="flex-1 rounded-xl border bg-background px-4 py-3 text-sm outline-none transition focus:border-gold"
          />
          <button
            type="submit"
            disabled={running}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-gold-foreground shadow-gold-glow transition hover:brightness-110 disabled:opacity-50"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {running ? t("super.running") : t("super.run")}
          </button>
        </div>
        {blocked && (
          <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <ShieldAlert className="h-4 w-4" /> {t("filter.blocked")}
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>

      {stages && (
        <div className="space-y-3 animate-in-up">
          {stages.map((stage, i) => (
            <StageCard key={stage.id} stage={stage} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function StageCard({ stage, index }: { stage: Stage; index: number }) {
  const { t } = useT();
  const [open, setOpen] = useState(stage.id === "report" || stage.id === "plan");
  const Icon = STAGE_ICONS[stage.id] ?? FileText;
  const o = stage.output ?? {};

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-muted/40"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">#{index + 1}</p>
          <p className="font-semibold">{stage.title}</p>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t p-4 text-sm">
          {stage.id === "context" && (
            <div className="grid gap-2 sm:grid-cols-3">
              <ContextStat label="Life Twin" value={o.facts_total} />
              <ContextStat label={t("nav.goals")} value={o.goals_active} />
              <ContextStat label="📅" value={(o.calendar_events ?? []).length} />
              {(o.goal_titles ?? []).length > 0 && (
                <div className="sm:col-span-3">
                  {o.goal_titles.map((g: string, i: number) => (
                    <span key={i} className="mr-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">{g}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {stage.id === "plan" && (
            <div className="space-y-2">
              {o.focus && (
                <p className="rounded-lg bg-gold/10 px-3 py-2 text-sm">
                  <span className="font-semibold text-gold">{t("super.focus")}:</span> {o.focus}
                </p>
              )}
              <ul className="space-y-1.5">
                {(o.blocks ?? []).map((b: any, i: number) => (
                  <li key={i} className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2">
                    <span className="shrink-0 font-mono text-xs font-semibold text-primary">{b.time}</span>
                    <span className="flex-1">{b.activity}</span>
                    {b.agent_role && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        <Bot className="h-3 w-3" /> {b.agent_role}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {stage.id === "agents" && (
            <div className="space-y-3">
              {(o.deliverables ?? []).map((d: any, i: number) => (
                <div key={i} className="rounded-xl border p-3">
                  <p className="mb-1 flex items-center gap-2 text-xs font-semibold text-primary">
                    <Bot className="h-3.5 w-3.5" /> {d.agent_role} · {d.time}
                  </p>
                  <p className="mb-2 text-xs text-muted-foreground">{d.activity}</p>
                  <div className="prose prose-sm max-w-none rounded-lg bg-muted/50 p-3 text-xs dark:prose-invert">
                    <ReactMarkdown>{d.deliverable}</ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>
          )}

          {stage.id === "ethics" && (
            <ul className="space-y-2">
              {(o.checks ?? []).map((c: any, i: number) => (
                <li key={i} className="flex items-start gap-2.5 rounded-lg bg-muted/50 px-3 py-2">
                  <span
                    className={cn(
                      "mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
                      c.verdict === "APPROVE" && "bg-primary/10 text-primary",
                      c.verdict === "CAUTION" && "bg-gold/10 text-gold",
                      c.verdict === "REJECT" && "bg-destructive/10 text-destructive",
                    )}
                  >
                    {t(`values.verdict.${c.verdict}`) !== `values.verdict.${c.verdict}`
                      ? t(`values.verdict.${c.verdict}`)
                      : c.verdict}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium">{c.action}</p>
                    <p className="text-xs text-muted-foreground">{c.reasoning}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {stage.id === "knowledge" && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("common.sources")}</p>
              {(o.sources ?? []).filter((s: any) => (s.items ?? []).length).map((s: any, i: number) => (
                <div key={i} className="rounded-xl border p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold">
                    <Globe className="h-3.5 w-3.5 text-primary" /> {s.source}
                    {s.source_url && (
                      <a href={s.source_url} target="_blank" rel="noreferrer" className="text-primary">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    <span className="font-normal text-muted-foreground">· {String(s.retrieved_at).slice(0, 16)}</span>
                  </p>
                  {(s.items ?? []).map((it: any, j: number) => (
                    <p key={j} className="text-xs">
                      {it.title}
                      {it.data && `: ${JSON.stringify(it.data).slice(0, 120)}`}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          )}

          {stage.id === "report" && (
            <p className="rounded-xl border-2 border-primary/30 bg-primary/[0.04] p-4 leading-relaxed">{o.summary}</p>
          )}
        </div>
      )}
    </div>
  );
}

function ContextStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2 text-center">
      <p className="text-xl font-bold text-primary">{value ?? 0}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
