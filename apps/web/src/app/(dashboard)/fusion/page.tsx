"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { Users, Loader2, ShieldAlert, Lightbulb, ListOrdered, Scale } from "lucide-react";
import { cn } from "@/lib/utils";

interface FusionResult {
  roles: string[];
  perspectives: { role: string; role_label: string; analysis: string }[];
  conflicts: string[];
  synthesis: string;
  action_plan: string[];
  method: string;
}

export default function FusionPage() {
  const api = useApiClient();
  const { t } = useT();

  const [problem, setProblem] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<FusionResult | null>(null);
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(false);

  const { data: catalog } = useQuery({
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
    setBlocked(false);
    setResult(null);
    try {
      const res = await api.post<FusionResult>("/fusion", {
        problem: problem.trim(),
        roles: selectedRoles,
      });
      setResult(res);
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
          <Users className="h-6 w-6 text-primary" /> {t("fusion.title")}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("fusion.subtitle")}</p>
      </div>

      <form onSubmit={run} className="space-y-4 rounded-2xl border bg-card p-5 shadow-soft">
        <textarea
          required
          rows={4}
          minLength={10}
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
          placeholder={t("fusion.ph")}
          className="w-full resize-none rounded-xl border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary"
        />
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">{t("fusion.roles")}</p>
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
        {blocked && (
          <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <ShieldAlert className="h-4 w-4" /> {t("filter.blocked")}
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={running || problem.trim().length < 10}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-50"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
          {running ? t("fusion.running") : t("fusion.run")}
        </button>
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
