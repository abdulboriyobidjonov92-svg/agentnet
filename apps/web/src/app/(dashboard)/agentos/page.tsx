"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { Fireworks } from "@/components/three/fireworks";
import {
  Building2, Loader2, Command, ShieldAlert, ShieldCheck, Crown, Wallet,
  Megaphone, Scale, Cpu, Send, ChevronDown, ChevronUp, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { StatTile, AreaChart } from "@/components/charts/charts";

function ops(base: number, seed: number, n = 20) {
  const out: number[] = [];
  let v = base * 0.6;
  for (let i = 0; i < n; i++) { v = v * (1 + Math.sin(i / 3 + seed) * 0.08) + base / n; out.push(Math.round(v)); }
  return out;
}

const ROLE_ICON: Record<string, any> = { ceo: Crown, cfo: Wallet, cmo: Megaphone, clo: Scale, cto: Cpu };
const ROLE_COLOR: Record<string, string> = {
  ceo: "text-gold border-gold/40",
  cfo: "text-emeraldx border-emerald-400/30",
  cmo: "text-violetx border-violet-400/30",
  clo: "text-neon border-cyan-400/30",
  cto: "text-blue-400 border-blue-400/30",
};

interface Dept {
  role: string;
  label: string;
  title: string;
  output: string;
  ethics: { verdict: string; reasoning: string };
}
interface CommandResult {
  command: string;
  departments: Dept[];
  report: string;
  ethics_summary: Record<string, number>;
  method: string;
}

export default function AgentOsPage() {
  const api = useApiClient();
  const { t } = useT();
  const queryClient = useQueryClient();

  const [command, setCommand] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CommandResult | null>(null);
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [burst, setBurst] = useState(0);

  // Ish maydoni setup holati
  const [wsName, setWsName] = useState("");
  const [wsKind, setWsKind] = useState("company");
  const [wsIndustry, setWsIndustry] = useState("");
  const [creating, setCreating] = useState(false);

  const { data: workspace, isLoading } = useQuery({
    queryKey: ["agentos-workspace"],
    queryFn: () => api.get<any>("/agentos/workspace"),
  });
  const { data: history } = useQuery({
    queryKey: ["agentos-history"],
    queryFn: () => api.get<any[]>("/agentos/history"),
    enabled: !!workspace,
  });

  const createWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post("/agentos/workspace", { name: wsName.trim(), kind: wsKind, tier: wsKind === "government" ? "gov" : "mid", industry: wsIndustry.trim() });
      queryClient.invalidateQueries({ queryKey: ["agentos-workspace"] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      setBurst((b) => b + 1);
    } finally {
      setCreating(false);
    }
  };

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    setRunning(true);
    setError("");
    setBlocked(false);
    setResult(null);
    try {
      const rec = await api.post<any>("/agentos/command", { command: command.trim() });
      setResult(rec.result);
      setBurst((b) => b + 1);
    } catch (err: any) {
      if (err.payload?.blocked) setBlocked(true);
      else setError(err.message || "Error");
    } finally {
      setRunning(false);
    }
  };

  const KINDS = [
    { id: "company", label: t("os.kindCompany") },
    { id: "startup", label: t("os.kindStartup") },
    { id: "government", label: t("os.kindGov") },
    { id: "enterprise", label: t("os.kindEnterprise") },
  ];

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // ---- Ish maydoni yo'q: setup ekрани ----
  if (!workspace) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <Fireworks trigger={burst} />
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-glow">
            <Building2 className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold">{t("os.setupTitle")}</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{t("os.setupSub")}</p>
        </div>

        <form onSubmit={createWorkspace} className="space-y-4 rounded-2xl border border-white/10 glass-panel p-6">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("os.orgName")}</label>
            <input
              required
              minLength={2}
              value={wsName}
              onChange={(e) => setWsName(e.target.value)}
              placeholder={t("os.orgNamePh")}
              className="w-full rounded-xl border bg-background/60 px-4 py-3 text-sm outline-none transition focus:border-primary"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("os.orgKind")}</label>
            <div className="grid grid-cols-2 gap-2">
              {KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setWsKind(k.id)}
                  className={cn(
                    "rounded-xl border p-2.5 text-sm font-medium transition",
                    wsKind === k.id ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted",
                  )}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("os.industry")}</label>
            <input
              value={wsIndustry}
              onChange={(e) => setWsIndustry(e.target.value)}
              placeholder={t("os.industryPh")}
              className="w-full rounded-xl border bg-background/60 px-4 py-3 text-sm outline-none transition focus:border-primary"
            />
          </div>
          <button
            type="submit"
            disabled={creating || wsName.trim().length < 2}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition hover:brightness-110 disabled:opacity-50"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {t("os.create")}
          </button>
          <p className="text-center text-xs text-muted-foreground">{t("os.createNote")}</p>
        </form>
      </div>
    );
  }

  // ---- Ish maydoni bor: buyruq markazi (command center) ----
  return (
    <div className="space-y-6">
      <Fireworks trigger={burst} />

      {/* Enterprise sarlavha — "command center" ko'rinishi */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 glass-panel p-6">
        <div className="absolute inset-0 bg-grid-lines opacity-30" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-glow">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{workspace.name}</h1>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                AgentOS · {workspace.kind}{workspace.industry ? ` · ${workspace.industry}` : ""}
              </p>
            </div>
          </div>
          <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {workspace.agents?.length ?? 0} C-suite
          </span>
        </div>

        {/* C-suite tarmog'i */}
        <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {(workspace.agents ?? []).map((a: any) => {
            const Icon = ROLE_ICON[a.csuiteRole] ?? Cpu;
            return (
              <div
                key={a.id}
                className={cn("flex flex-col items-center gap-1.5 rounded-xl border bg-background/40 p-3 text-center backdrop-blur", ROLE_COLOR[a.csuiteRole])}
              >
                <Icon className="h-6 w-6" />
                <span className="text-xs font-bold">{a.name}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Operatsion ko'rsatkichlar (sovereign command-center) */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={t("os.mCommands")} value={(history?.length ?? 0).toLocaleString()} accent="cyan" data={ops(Math.max(history?.length ?? 1, 3), 1)} trend={14} />
        <StatTile label={t("os.mDepartments")} value={workspace.agents?.length ?? 0} accent="violet" data={ops(5, 2)} trend={0} />
        <StatTile label={t("os.mEthics")} value="100%" accent="emerald" data={ops(98, 3).map((v) => 94 + (v % 6))} trend={1} />
        <StatTile label={t("os.mThroughput")} value={((history?.length ?? 0) * 5).toLocaleString()} accent="gold" data={ops(Math.max((history?.length ?? 1) * 5, 8), 4)} trend={22} />
      </div>

      {/* Operatsion o'tkazuvchanlik grafigi */}
      <div className="rounded-2xl border border-white/10 bg-card/60 p-5 backdrop-blur">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t("os.opsActivity")}</h2>
          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emeraldx">LIVE</span>
        </div>
        <AreaChart data={ops(Math.max((history?.length ?? 1) * 8, 20), 5, 28)} accent="cyan" height={150} />
      </div>

      {/* Buyruq kiritish */}
      <form onSubmit={run} className="space-y-3 rounded-2xl border-2 border-primary/30 bg-primary/[0.03] p-5">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <Command className="h-4 w-4 text-primary" /> {t("os.commandTitle")}
        </label>
        <div className="flex gap-2">
          <input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder={t("os.commandPh")}
            className="flex-1 rounded-xl border bg-background/60 px-4 py-3 text-sm outline-none transition focus:border-primary"
          />
          <button
            type="submit"
            disabled={running || command.trim().length < 4}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition hover:brightness-110 disabled:opacity-50"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {running ? t("os.running") : t("os.execute")}
          </button>
        </div>
        {blocked && (
          <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <ShieldAlert className="h-4 w-4" /> {t("filter.blocked")}
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>

      {/* Natija: bo'limlar + hisobot */}
      {result && (
        <div className="space-y-4 animate-in-up">
          {result.method === "heuristic" && (
            <p className="rounded-lg bg-gold/10 px-3 py-2 text-xs text-gold">{t("common.offline")}</p>
          )}
          <div className="grid gap-3 lg:grid-cols-2">
            {result.departments.map((d) => (
              <DeptCard key={d.role} dept={d} />
            ))}
          </div>

          {/* Yig'ma hisobot */}
          <div className="rounded-2xl border-2 border-primary/40 bg-primary/[0.04] p-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-semibold text-primary">
                <Command className="h-4 w-4" /> {t("os.report")}
              </p>
              <div className="flex gap-1.5">
                {Object.entries(result.ethics_summary).map(([v, n]) => (
                  <span
                    key={v}
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold",
                      v === "APPROVE" && "bg-primary/15 text-primary",
                      v === "CAUTION" && "bg-gold/15 text-gold",
                      v === "REJECT" && "bg-destructive/15 text-destructive",
                    )}
                  >
                    {v} {n}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-sm leading-relaxed">{result.report}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function DeptCard({ dept }: { dept: Dept }) {
  const { t } = useT();
  const [open, setOpen] = useState(true);
  const Icon = ROLE_ICON[dept.role] ?? Cpu;
  return (
    <div className={cn("rounded-2xl border bg-card/60 p-4 backdrop-blur", ROLE_COLOR[dept.role])}>
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2">
        <Icon className="h-5 w-5" />
        <span className="flex-1 text-left">
          <span className="block text-sm font-bold">{dept.label}</span>
          <span className="block text-xs text-muted-foreground">{dept.title}</span>
        </span>
        <span
          className={cn(
            "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
            dept.ethics.verdict === "APPROVE" && "bg-primary/15 text-primary",
            dept.ethics.verdict === "CAUTION" && "bg-gold/15 text-gold",
            dept.ethics.verdict === "REJECT" && "bg-destructive/15 text-destructive",
          )}
        >
          <ShieldCheck className="h-3 w-3" /> {dept.ethics.verdict}
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <div className="prose prose-sm mt-3 max-w-none border-t border-white/5 pt-3 text-xs dark:prose-invert">
          <ReactMarkdown>{dept.output}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
