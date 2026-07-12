"use client";
import { useState } from "react";
import { useApiClient, apiErrorMessage, blockedMessage } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { Zap, Loader2, ShieldAlert } from "lucide-react";
import { StageCard, type Stage } from "./stage-card";

export function DailyPanel() {
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
