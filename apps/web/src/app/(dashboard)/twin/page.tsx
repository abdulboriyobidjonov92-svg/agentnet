"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import {
  CircleUserRound, Plus, Trash2, Loader2, Sparkles, ShieldAlert,
  HeartPulse, Wallet, Users, Briefcase, Repeat, GraduationCap, CircleDot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

const FutureTimeline = dynamic(() => import("@/components/three/future-timeline"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-breathe rounded-2xl bg-primary/5" />,
});

const CATEGORIES = [
  { id: "finance", icon: Wallet },
  { id: "work", icon: Briefcase },
  { id: "family", icon: Users },
  { id: "health", icon: HeartPulse },
  { id: "habits", icon: Repeat },
  { id: "education", icon: GraduationCap },
  { id: "other", icon: CircleDot },
];

interface TwinFact {
  id: string;
  category: string;
  label: string;
  value: string;
  source: string;
}

interface WhatIfResult {
  summary: string;
  assumptions: string[];
  timeline: { period: string; projection: string }[];
  risks: string[];
  opportunities: string[];
  recommendation: string;
  confidence: number;
  used_facts: string[];
  method: string;
}

export default function TwinPage() {
  const api = useApiClient();
  const { t } = useT();
  const queryClient = useQueryClient();

  const [category, setCategory] = useState("finance");
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [adding, setAdding] = useState(false);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(false);

  const { data: facts } = useQuery({
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

  const ask = async (e: React.FormEvent) => {
    e.preventDefault();
    setAsking(true);
    setError("");
    setBlocked(false);
    setResult(null);
    try {
      const res = await api.post<WhatIfResult>("/twin/whatif", { question: question.trim() });
      setResult(res);
    } catch (err: any) {
      if (err.payload?.blocked) setBlocked(true);
      else setError(err.message || "Error");
    } finally {
      setAsking(false);
    }
  };

  const byCategory: Record<string, TwinFact[]> = {};
  for (const f of facts ?? []) (byCategory[f.category] ??= []).push(f);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <CircleUserRound className="h-6 w-6 text-primary" /> {t("twin.title")}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("twin.subtitle")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Faktlar */}
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

          {!facts?.length ? (
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
                        <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                          {t(`twin.source.${f.source}`) !== `twin.source.${f.source}` ? t(`twin.source.${f.source}`) : f.source}
                        </span>
                      </span>
                      <button
                        onClick={() => removeFact(f.id)}
                        aria-label={t("common.delete")}
                        className="text-muted-foreground opacity-0 transition hover:text-destructive group-hover:opacity-100"
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

        {/* What if */}
        <div className="space-y-4">
          <form onSubmit={ask} className="space-y-3 rounded-2xl border bg-card p-4 shadow-soft">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-gold" /> {t("twin.whatifTitle")}
              </p>
              <p className="text-xs text-muted-foreground">{t("twin.whatifSub")}</p>
            </div>
            <Textarea
              required
              rows={3}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={t("twin.whatifPh")}
              className="resize-none"
            />
            {blocked && (
              <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <ShieldAlert className="h-4 w-4" /> {t("filter.blocked")}
              </p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" size="sm" disabled={asking || question.trim().length < 5}>
              {asking ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {asking ? t("twin.asking") : t("twin.ask")}
            </Button>
          </form>

          {result && (
            <div className="space-y-3 rounded-2xl border bg-card p-5 shadow-soft animate-in-up">
              <p className="text-sm">{result.summary}</p>
              {result.method === "heuristic" && (
                <p className="rounded-lg bg-gold/10 px-3 py-2 text-xs text-gold">{t("common.offline")}</p>
              )}
              <Section title={t("twin.timeline")}>
                {/* 3D shoxlanuvchi kelajak yo'llari */}
                <div className="mb-2 h-56 overflow-hidden rounded-2xl border bg-background/30">
                  <FutureTimeline points={result.timeline} className="!h-full !w-full" />
                </div>
                <ol className="space-y-2">
                  {result.timeline.map((tl, i) => (
                    <li key={i} className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
                      <span className="font-semibold text-primary">{tl.period}:</span> {tl.projection}
                    </li>
                  ))}
                </ol>
              </Section>
              {result.assumptions?.length > 0 && (
                <Section title={t("twin.assumptions")}>
                  <BulletList items={result.assumptions} />
                </Section>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {result.risks?.length > 0 && (
                  <Section title={t("twin.risks")}>
                    <BulletList items={result.risks} />
                  </Section>
                )}
                {result.opportunities?.length > 0 && (
                  <Section title={t("twin.opportunities")}>
                    <BulletList items={result.opportunities} />
                  </Section>
                )}
              </div>
              {result.recommendation && (
                <Section title={t("twin.recommendation")}>
                  <p className="text-sm">{result.recommendation}</p>
                </Section>
              )}
              {result.used_facts?.length > 0 && (
                <Section title={t("twin.usedFacts")}>
                  <div className="flex flex-wrap gap-1.5">
                    {result.used_facts.map((f, i) => (
                      <span key={i} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">{f}</span>
                    ))}
                  </div>
                </Section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1 text-sm">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span className="text-primary">•</span> {item}
        </li>
      ))}
    </ul>
  );
}
