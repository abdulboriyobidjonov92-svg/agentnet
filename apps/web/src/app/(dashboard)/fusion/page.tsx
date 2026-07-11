"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApiClient, apiErrorMessage, blockedMessage } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import {
  Users, Zap, Sparkles, Loader2, ShieldAlert, Lightbulb, ListOrdered, Scale,
  CircleUserRound, CalendarDays, Bot, ShieldCheck, Globe, FileText, ExternalLink, ChevronDown, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { InfoHint } from "@/components/ui/info-hint";
import { Textarea } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/error-state";
import ReactMarkdown from "react-markdown";

/**
 * Ilgari "Fyujn" va "Super rejim" deb ikkita alohida sahifa edi — ikkalasi
 * ham aslida bitta narsa qiladi: savolni ko'p nuqtai-nazardan tahlil qilish.
 * Endi bitta sahifa, ikki rejim: tezkor mutaxassis-fikri yoki to'liq
 * kun-boshqaruv quvur liniyasi (Life Twin + Goals konteksti bilan).
 */
type Mode = "experts" | "daily";

export default function ConsultPage() {
  const { t } = useT();
  const [mode, setMode] = useState<Mode>("experts");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Sparkles className="h-6 w-6 text-primary" /> {t("consult.title")}
          <InfoHint text={t("consult.hint")} label={t("consult.title")} />
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("consult.subtitle")}</p>
      </div>

      <div className="flex items-center gap-2">
        <div className="inline-flex gap-1 rounded-xl border bg-card p-1 shadow-soft">
          <button
            type="button"
            onClick={() => setMode("experts")}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition",
              mode === "experts" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Users className="h-4 w-4" /> {t("consult.tabExperts")}
          </button>
          <button
            type="button"
            onClick={() => setMode("daily")}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition",
              mode === "daily" ? "bg-gold/10 text-gold" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Zap className="h-4 w-4" /> {t("consult.tabDaily")}
          </button>
        </div>
        <InfoHint
          text={mode === "experts" ? t("consult.hintExperts") : t("consult.hintDaily")}
          label={mode === "experts" ? t("consult.tabExperts") : t("consult.tabDaily")}
        />
      </div>

      {mode === "experts" ? <ExpertPanel /> : <DailyPanel />}
    </div>
  );
}

interface FusionResult {
  roles: string[];
  perspectives: { role: string; role_label: string; analysis: string }[];
  conflicts: string[];
  synthesis: string;
  action_plan: string[];
  method: string;
}

function ExpertPanel() {
  const api = useApiClient();
  const { t } = useT();

  const [problem, setProblem] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<FusionResult | null>(null);
  const [error, setError] = useState("");
  const [blockedReason, setBlockedReason] = useState<string | null>(null);

  const { data: catalog, isError: rolesError, refetch: refetchRoles } = useQuery({
    queryKey: ["fusion-roles"],
    queryFn: () => api.get<{ roles: { slug: string; label: string }[] }>("/fusion/roles"),
  });

  const toggleRole = (slug: string) =>
    setSelectedRoles((prev) =>
      prev.includes(slug) ? prev.filter((r) => r !== slug) : prev.length < 4 ? [...prev, slug] : prev,
    );

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    setRunning(true);
    setError("");
    setBlockedReason(null);
    setResult(null);
    try {
      const res = await api.post<FusionResult>("/fusion", {
        problem: problem.trim(),
        roles: selectedRoles,
      });
      setResult(res);
    } catch (err: any) {
      if (err.payload?.blocked) setBlockedReason(err.payload?.reason ?? null);
      else setError(apiErrorMessage(err, t));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t("fusion.subtitle")}</p>

      <form onSubmit={run} className="space-y-4 rounded-2xl border bg-card p-5 shadow-soft">
        <Textarea
          required
          rows={4}
          minLength={10}
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
          placeholder={t("fusion.ph")}
          className="resize-none"
        />
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">{t("fusion.roles")}</p>
          {rolesError && <ErrorState onRetry={() => refetchRoles()} className="mb-2 p-4" />}
          <div className="flex flex-wrap gap-1.5">
            {(catalog?.roles ?? []).map((role) => (
              <button
                key={role.slug}
                type="button"
                onClick={() => toggleRole(role.slug)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  selectedRoles.includes(role.slug)
                    ? "border-primary bg-primary/10 text-primary"
                    : "hover:bg-muted",
                )}
              >
                {role.label}
              </button>
            ))}
          </div>
        </div>
        {blockedReason !== null && (
          <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <ShieldAlert className="h-4 w-4" /> {blockedMessage(blockedReason, t)}
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={running || problem.trim().length < 10}>
          {running ? <Loader2 className="animate-spin" /> : <Users />}
          {running ? t("fusion.running") : t("fusion.run")}
        </Button>
      </form>

      {result && (
        <div className="space-y-4 animate-in-up">
          {result.method === "heuristic" && (
            <p className="rounded-lg bg-gold/10 px-3 py-2 text-xs text-gold">{t("common.offline")}</p>
          )}

          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("fusion.perspectives")}
            </h2>
            <div className="space-y-3">
              {result.perspectives.map((p, i) => (
                <div key={i} className="rounded-2xl border bg-card p-4 shadow-soft">
                  <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-primary">
                    <Users className="h-4 w-4" /> {p.role_label || p.role}
                  </p>
                  <p className="text-sm">{p.analysis}</p>
                </div>
              ))}
            </div>
          </div>

          {result.conflicts?.length > 0 && (
            <div className="rounded-2xl border border-gold/40 bg-gold/5 p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-gold">
                <Scale className="h-4 w-4" /> {t("fusion.conflicts")}
              </p>
              <ul className="space-y-1 text-sm">
                {result.conflicts.map((c, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-gold">•</span> {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-2xl border-2 border-primary/40 bg-primary/[0.04] p-5">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
              <Lightbulb className="h-4 w-4" /> {t("fusion.synthesis")}
            </p>
            <p className="text-sm leading-relaxed">{result.synthesis}</p>
          </div>

          {result.action_plan?.length > 0 && (
            <div className="rounded-2xl border bg-card p-4 shadow-soft">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <ListOrdered className="h-4 w-4 text-primary" /> {t("fusion.actionPlan")}
              </p>
              <ol className="space-y-1.5 text-sm">
                {result.action_plan.map((step, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="font-semibold text-primary">{i + 1}.</span> {step}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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

function DailyPanel() {
  const api = useApiClient();
  const { t } = useT();

  const [command, setCommand] = useState("");
  const [running, setRunning] = useState(false);
  const [stages, setStages] = useState<Stage[] | null>(null);
  const [error, setError] = useState("");
  const [blockedReason, setBlockedReason] = useState<string | null>(null);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    setRunning(true);
    setError("");
    setBlockedReason(null);
    setStages(null);
    try {
      const res = await api.post<{ stages: Stage[] }>("/supermode", {
        command: command.trim() || t("super.ph"),
      });
      setStages(res.stages);
    } catch (err: any) {
      if (err.payload?.blocked) setBlockedReason(err.payload?.reason ?? null);
      else setError(apiErrorMessage(err, t));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t("super.subtitle")}</p>

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
        {blockedReason !== null && (
          <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <ShieldAlert className="h-4 w-4" /> {blockedMessage(blockedReason, t)}
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

function ContextStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2 text-center">
      <p className="text-xl font-bold text-primary">{value ?? 0}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
