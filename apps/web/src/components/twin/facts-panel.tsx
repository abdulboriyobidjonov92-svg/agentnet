"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/error-state";
import { CATEGORIES, type TwinFact } from "./twin-types";

export function FactsPanel() {
  const api = useApiClient();
  const { t } = useT();
  const queryClient = useQueryClient();

  const [category, setCategory] = useState("finance");
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [adding, setAdding] = useState(false);

  const { data: facts, isError: factsError, refetch: refetchFacts } = useQuery({
    queryKey: ["twin-facts"],
    queryFn: () => api.get<TwinFact[]>("/twin/facts"),
  });

  const addFact = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      await api.post("/twin/facts", { category, label: label.trim(), value: value.trim() });
      setLabel("");
      setValue("");
      queryClient.invalidateQueries({ queryKey: ["twin-facts"] });
    } finally {
      setAdding(false);
    }
  };

  const removeFact = async (id: string) => {
    await api.delete(`/twin/facts/${id}`);
    queryClient.invalidateQueries({ queryKey: ["twin-facts"] });
  };

  const byCategory: Record<string, TwinFact[]> = {};
  for (const f of facts ?? []) (byCategory[f.category] ??= []).push(f);

  return (
    <div className="space-y-4">
      <form onSubmit={addFact} className="space-y-3 rounded-2xl border bg-card p-4 shadow-soft">
        <p className="text-sm font-semibold">{t("twin.addFact")}</p>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setCategory(id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                category === id ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted",
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {t(`twin.cat.${id}`)}
            </button>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            required
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t("twin.labelPh")}
          />
          <Input
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t("twin.valuePh")}
          />
        </div>
        <Button type="submit" size="sm" disabled={adding || !label.trim() || !value.trim()}>
          {adding ? <Loader2 className="animate-spin" /> : <Plus />}
          {t("twin.addFact")}
        </Button>
      </form>

      {factsError ? (
        <ErrorState onRetry={() => refetchFacts()} />
      ) : !facts?.length ? (
        <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {t("twin.noFacts")}
        </div>
      ) : (
        CATEGORIES.filter((c) => byCategory[c.id]?.length).map(({ id, icon: Icon }) => (
          <div key={id} className="rounded-2xl border bg-card p-4 shadow-soft">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Icon className="h-4 w-4 text-primary" /> {t(`twin.cat.${id}`)}
            </p>
            <ul className="space-y-1.5">
              {byCategory[id].map((f) => (
                <li key={f.id} className="group flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
                  <span>
                    <span className="font-medium">{f.label}:</span> {f.value}
                    <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                      {t(`twin.source.${f.source}`) !== `twin.source.${f.source}` ? t(`twin.source.${f.source}`) : f.source}
                    </span>
                  </span>
                  <button
                    onClick={() => removeFact(f.id)}
                    aria-label={t("common.delete")}
                    className="hit-target text-muted-foreground opacity-0 transition hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}
