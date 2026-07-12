"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { useApiClient, apiErrorMessage, blockedMessage } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { Sparkles, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Section, BulletList } from "./section";
import type { WhatIfResult } from "./twin-types";

const FutureTimeline = dynamic(() => import("@/components/three/future-timeline"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-breathe rounded-2xl bg-primary/5" />,
});

export function WhatifPanel() {
  const api = useApiClient();
  const { t } = useT();

  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [error, setError] = useState("");
  const [blockedReason, setBlockedReason] = useState<string | null>(null);

  const ask = async (e: React.FormEvent) => {
    e.preventDefault();
    setAsking(true);
    setError("");
    setBlockedReason(null);
    setResult(null);
    try {
      const res = await api.post<WhatIfResult>("/twin/whatif", { question: question.trim() });
      setResult(res);
    } catch (err: any) {
      if (err.payload?.blocked) setBlockedReason(err.payload?.reason ?? null);
      else setError(apiErrorMessage(err, t));
    } finally {
      setAsking(false);
    }
  };

  return (
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
        {blockedReason !== null && (
          <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <ShieldAlert className="h-4 w-4" /> {blockedMessage(blockedReason, t)}
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
  );
}
