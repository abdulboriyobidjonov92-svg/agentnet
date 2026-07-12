"use client";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { CircleUserRound, CalendarDays, Bot, ShieldCheck, Globe, FileText, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
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

export interface Stage {
  id: string;
  title: string;
  output: any;
}

function ContextStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2 text-center">
      <p className="text-xl font-bold text-primary">{value ?? 0}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function StageCard({ stage, index }: { stage: Stage; index: number }) {
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
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
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
                      "mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold",
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
