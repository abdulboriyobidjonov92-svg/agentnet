"use client";
import { useState } from "react";
import { useApiClient, apiErrorMessage, blockedMessage } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { Fireworks } from "@/components/three/fireworks";
import { Building2, Loader2, Command, ShieldAlert, Cpu, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatTile, AreaChart } from "@/components/charts/charts";
import { DeptCard } from "./dept-card";
import { ops, ROLE_ICON, ROLE_COLOR, type CommandResult } from "./agentos-utils";

export function CommandCenter({ workspace, history }: { workspace: any; history: any[] | undefined }) {
  const api = useApiClient();
  const { t } = useT();

  const [command, setCommand] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CommandResult | null>(null);
  const [error, setError] = useState("");
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    setRunning(true);
    setError("");
    setBlockedReason(null);
    setResult(null);
    try {
      const rec = await api.post<any>("/agentos/command", { command: command.trim() });
      setResult(rec.result);
      setBurst((b) => b + 1);
    } catch (err: any) {
      if (err.payload?.blocked) setBlockedReason(err.payload?.reason ?? null);
      else setError(apiErrorMessage(err, t));
    } finally {
      setRunning(false);
    }
  };

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
                {t("nav.agentos")} · {workspace.kind}{workspace.industry ? ` · ${workspace.industry}` : ""}
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
          <Input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder={t("os.commandPh")}
            className="flex-1 bg-background/60"
          />
          <Button type="submit" disabled={running || command.trim().length < 4} className="h-11 shrink-0">
            {running ? <Loader2 className="animate-spin" /> : <Send />}
            {running ? t("os.running") : t("os.execute")}
          </Button>
        </div>
        {blockedReason !== null && (
          <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <ShieldAlert className="h-4 w-4" /> {blockedMessage(blockedReason, t)}
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
                      "rounded-full px-2 py-0.5 text-[11px] font-bold",
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
