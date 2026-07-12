"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient, apiErrorMessage } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Sparkles, Wand2, Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { ProposalCard } from "./proposal-card";
import { TemplateSuggestionCard } from "./template-suggestion-card";
import type { ComposeResult, TemplateMatch } from "./compose-types";

/** Y9: bir-klik agent yaratish — tabiiy til → tayyor agent taklifi + narx. */

// Y9↔shablon integratsiyasi: custom yaratishdan OLDIN 20 ta shablon bilan
// solishtiriladi (oddiy keyword-moslik, ML shart emas). 70%+ mos kelsa —
// tayyor (arzonroq, tezroq) shablonni taklif qilamiz, custom variant ham qoladi.
const TEMPLATE_SUGGESTION_THRESHOLD = 70;

const EXAMPLE_KEYS = ["compose.ex1", "compose.ex2", "compose.ex3"] as const;

export function AgentComposer() {
  const api = useApiClient();
  const qc = useQueryClient();
  const router = useRouter();
  const { t, locale } = useT();
  const [desc, setDesc] = useState("");
  const [result, setResult] = useState<ComposeResult | null>(null);
  const [suggestion, setSuggestion] = useState<TemplateMatch | null>(null);

  const compose = useMutation({
    mutationFn: (description: string) =>
      api.post<ComposeResult>("/agents/compose", { description }),
    onSuccess: (r) => setResult(r),
  });

  // Custom composer'ga yuborishdan OLDIN — mos tayyor shablon bormi?
  const matchTemplate = useMutation({
    mutationFn: (description: string) =>
      api.get<TemplateMatch[]>(`/templates/match?q=${encodeURIComponent(description)}&language=${locale}`),
  });

  const installTemplate = useMutation({
    mutationFn: (templateId: string) => api.post<{ agent: { id: string } }>(`/templates/${templateId}/install`, {}),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      router.push(`/agents/${res.agent.id}`);
    },
  });

  const handleGenerate = async () => {
    const trimmed = desc.trim();
    try {
      const matches = await matchTemplate.mutateAsync(trimmed);
      const top = matches?.[0];
      if (top && top.matchPercent >= TEMPLATE_SUGGESTION_THRESHOLD) {
        setSuggestion(top);
        return;
      }
    } catch {
      // Moslashtirish xizmati vaqtincha mavjud emas — custom oqim baribir davom etadi
    }
    compose.mutate(trimmed);
  };

  // Bir marta generatsiya qilinadi — tugma ikki marta bosilsa ham (yoki
  // tarmoq qayta urinishi) IKKINCHI marta yechilmasligi uchun (idempotency).
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const create = useMutation({
    mutationFn: (r: ComposeResult) =>
      api.post<{ id: string }>("/agents", { ...r.proposal, complexity: r.meta.complexity, idempotencyKey }),
    onSuccess: (agent) => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      router.push(`/agents/${agent.id}`);
    },
  });

  const som = (n: number) => n.toLocaleString("ru-RU");

  return (
    <div className="rounded-2xl border border-white/10 glass-panel p-5 sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold tracking-tight">{t("compose.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("compose.subtitle")}</p>
        </div>
      </div>

      {suggestion ? (
        <TemplateSuggestionCard
          suggestion={suggestion}
          installing={installTemplate.isPending}
          generating={compose.isPending}
          error={installTemplate.error ? apiErrorMessage(installTemplate.error, t) : undefined}
          onBuy={() => installTemplate.mutate(suggestion.id)}
          onCustom={() => {
            setSuggestion(null);
            compose.mutate(desc.trim());
          }}
          t={t}
          som={som}
        />
      ) : !result ? (
        <>
          <Textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder={t("compose.placeholder")}
            rows={3}
            className="min-h-[96px] resize-none text-base"
            disabled={compose.isPending || matchTemplate.isPending}
          />

          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLE_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setDesc(t(k))}
                disabled={compose.isPending || matchTemplate.isPending}
                className="rounded-full border border-white/10 bg-background/40 px-3 py-1 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground disabled:opacity-50"
              >
                {t(k)}
              </button>
            ))}
          </div>

          {compose.isError && (
            <p className="mt-3 text-sm text-destructive">
              {apiErrorMessage(compose.error, t)}
            </p>
          )}

          <Button
            className="mt-4 w-full"
            onClick={handleGenerate}
            disabled={compose.isPending || matchTemplate.isPending || desc.trim().length < 3}
          >
            {compose.isPending || matchTemplate.isPending ? (
              <>
                <Loader2 className="animate-spin" /> {t("compose.generating")}
              </>
            ) : (
              <>
                <Wand2 /> {t("compose.generate")}
              </>
            )}
          </Button>
        </>
      ) : (
        <ProposalCard
          result={result}
          creating={create.isPending}
          error={create.error ? apiErrorMessage(create.error, t) : undefined}
          onCreate={() => create.mutate(result)}
          onRestart={() => {
            setResult(null);
            compose.reset();
            create.reset();
          }}
          t={t}
          som={som}
        />
      )}
    </div>
  );
}
