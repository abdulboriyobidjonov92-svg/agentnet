"use client";
import { useEffect, useState } from "react";
import { useApiClient, apiErrorMessage } from "@/lib/api-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, Check, Scale, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

export function ValuesTab() {
  const { t } = useT();
  const api = useApiClient();
  const queryClient = useQueryClient();

  const { data: values } = useQuery({
    queryKey: ["values"],
    queryFn: () => api.get<{ tradition: string; statements: string[] }>("/users/me/values"),
  });

  const [tradition, setTradition] = useState("islamic");
  const [statements, setStatements] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [action, setAction] = useState("");
  const [checking, setChecking] = useState(false);
  const [verdict, setVerdict] = useState<any>(null);

  useEffect(() => {
    if (values) {
      setTradition(values.tradition ?? "islamic");
      setStatements((values.statements ?? []).join("\n"));
    }
  }, [values]);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.patch("/users/me/values", {
        tradition,
        statements: statements.split("\n").map((s) => s.trim()).filter(Boolean),
      });
      queryClient.invalidateQueries({ queryKey: ["values"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const check = async (e: React.FormEvent) => {
    e.preventDefault();
    setChecking(true);
    setVerdict(null);
    try {
      const res = await api.post<any>("/ethics/evaluate", { action: action.trim() });
      setVerdict(res);
    } catch (err: any) {
      setVerdict({ verdict: "REJECT", reasoning: apiErrorMessage(err, t) });
    } finally {
      setChecking(false);
    }
  };

  const TRADITIONS = [
    { id: "islamic", label: t("values.islamic") },
    { id: "secular", label: t("values.secular") },
    { id: "mixed", label: t("values.mixed") },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-6 shadow-soft">
        <h2 className="mb-1 font-semibold">{t("values.title")}</h2>
        <p className="mb-4 text-xs text-muted-foreground">{t("values.subtitle")}</p>

        <p className="mb-2 text-sm font-medium">{t("values.tradition")}</p>
        <div className="mb-4 grid gap-2 sm:grid-cols-3">
          {TRADITIONS.map((tr) => (
            <button
              key={tr.id}
              type="button"
              onClick={() => setTradition(tr.id)}
              className={cn(
                "rounded-xl border p-3 text-sm font-medium transition",
                tradition === tr.id ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "hover:bg-muted",
              )}
            >
              {tr.label}
            </button>
          ))}
        </div>

        <p className="mb-2 text-sm font-medium">{t("values.statements")}</p>
        <Textarea
          rows={5}
          value={statements}
          onChange={(e) => setStatements(e.target.value)}
          placeholder={t("values.statementsPh")}
          className="mb-3 resize-none"
        />
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : saved ? <Check /> : <Scale />}
          {saved ? t("values.saved") : t("values.save")}
        </Button>
      </div>

      <form onSubmit={check} className="rounded-2xl border bg-card p-6 shadow-soft">
        <h2 className="mb-3 font-semibold">{t("values.check")}</h2>
        <div className="flex gap-2">
          <Input
            required
            minLength={5}
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder={t("values.checkPh")}
            className="flex-1"
          />
          <Button type="submit" disabled={checking || action.trim().length < 5} className="h-11 shrink-0">
            {checking ? <Loader2 className="animate-spin" /> : <Shield />}
            {checking ? t("values.checking") : t("values.checkBtn")}
          </Button>
        </div>
        {verdict && (
          <div className="mt-3 rounded-xl border p-4 animate-in-up">
            <span
              className={cn(
                "rounded-full px-3 py-1 text-xs font-bold",
                verdict.verdict === "APPROVE" && "bg-primary/10 text-primary",
                verdict.verdict === "CAUTION" && "bg-gold/10 text-gold",
                verdict.verdict === "REJECT" && "bg-destructive/10 text-destructive",
              )}
            >
              {t(`values.verdict.${verdict.verdict}`) !== `values.verdict.${verdict.verdict}`
                ? t(`values.verdict.${verdict.verdict}`)
                : verdict.verdict}
            </span>
            <p className="mt-2 text-sm">{verdict.reasoning}</p>
            {(verdict.value_alignment ?? []).length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {verdict.value_alignment.map((v: any, i: number) => (
                  <li key={i}>
                    <span className="font-medium">{v.value}</span> — {v.status}
                    {v.note ? `: ${v.note}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
