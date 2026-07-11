"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient, apiErrorMessage } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Sparkles, Wand2, Check, RotateCcw, Loader2, ShieldCheck, PackageCheck } from "lucide-react";
import { useT } from "@/lib/i18n/client";

/** Y9: bir-klik agent yaratish — tabiiy til → tayyor agent taklifi + narx. */

// Y9↔shablon integratsiyasi: custom yaratishdan OLDIN 20 ta shablon bilan
// solishtiriladi (oddiy keyword-moslik, ML shart emas). 70%+ mos kelsa —
// tayyor (arzonroq, tezroq) shablonni taklif qilamiz, custom variant ham qoladi.
const TEMPLATE_SUGGESTION_THRESHOLD = 70;

interface TemplateMatch {
  id: string;
  profession: string;
  flagship: string;
  matchPercent: number;
  price: { createSom: number; monthlySom: number };
}

interface ComposeProposal {
  name: string;
  systemPrompt: string;
  model: string;
  toolsConfig: { tool_id: string; config: Record<string, unknown> }[];
  vertical?: string;
  description?: string;
  halalFilterEnabled: boolean;
  memoryEnabled: boolean;
}
interface ComposeResult {
  proposal: ComposeProposal;
  meta: {
    domain: string;
    vertical: string | null;
    complexity: number;
    reasoning: string;
    method: "llm" | "heuristic";
    matched: string | null;
    toolIds: string[];
    language: string;
  };
  price: {
    complexity: number;
    toolCount: number;
    creationUsd: number;
    monthlyUsd: number;
    creationSom: number;
    monthlySom: number;
    fxRate: number;
  };
}

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

function ProposalCard({
  result,
  creating,
  error,
  onCreate,
  onRestart,
  t,
  som,
}: {
  result: ComposeResult;
  creating: boolean;
  error?: string;
  onCreate: () => void;
  onRestart: () => void;
  t: (k: string) => string;
  som: (n: number) => string;
}) {
  const { proposal, meta, price } = result;
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="mb-1 flex items-center gap-2">
          <h3 className="text-lg font-bold">{proposal.name}</h3>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium">
            {"★".repeat(meta.complexity)}
          </span>
          {proposal.halalFilterEnabled && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              <ShieldCheck className="h-3 w-3" /> Halal
            </span>
          )}
        </div>
        {meta.reasoning && <p className="text-sm text-muted-foreground">{meta.reasoning}</p>}

        {meta.toolIds.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("compose.tools")}</p>
            <div className="flex flex-wrap gap-1.5">
              {meta.toolIds.map((id) => (
                <span key={id} className="rounded-md bg-background/60 px-2 py-0.5 text-[11px]">
                  {id}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Narx — yaratish (endi bepul, activation'ni bo'g'maslik uchun) + oylik */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
          <p className="text-xs text-muted-foreground">{t("compose.priceCreation")}</p>
          {price.creationSom > 0 ? (
            <>
              <p className="mt-0.5 text-lg font-bold">
                {som(price.creationSom)} <span className="text-sm font-normal text-muted-foreground">so'm</span>
              </p>
              <p className="text-[11px] text-muted-foreground">${price.creationUsd}</p>
            </>
          ) : (
            <p className="mt-0.5 text-lg font-bold text-emerald-500">{t("compose.free")}</p>
          )}
        </div>
        <div className="rounded-xl border border-white/10 p-3">
          <p className="text-xs text-muted-foreground">{t("compose.priceMonthly")}</p>
          <p className="mt-0.5 text-lg font-bold">
            {som(price.monthlySom)} <span className="text-sm font-normal text-muted-foreground">so'm</span>
          </p>
          <p className="text-[11px] text-muted-foreground">${price.monthlyUsd}/{t("compose.mo")}</p>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button className="flex-1" onClick={onCreate} disabled={creating}>
          {creating ? (
            <>
              <Loader2 className="animate-spin" /> {t("compose.creating")}
            </>
          ) : (
            <>
              <Check /> {t("compose.create")}
            </>
          )}
        </Button>
        <Button variant="outline" onClick={onRestart} disabled={creating}>
          <RotateCcw /> {t("compose.restart")}
        </Button>
      </div>
    </div>
  );
}

/** Y9↔shablon: custom yaratishdan oldin topilgan tayyor (sinovdan o'tgan, tezroq) shablon taklifi.
 * Eslatma: custom yaratish endi BEPUL — shablon narxi ko'rsatiladi, lekin "arzonroq" degan
 * da'vo endi noto'g'ri (custom $0), shuning uchun taqqoslash tezlik/sifatga qaratilgan. */
function TemplateSuggestionCard({
  suggestion,
  installing,
  generating,
  error,
  onBuy,
  onCustom,
  t,
  som,
}: {
  suggestion: TemplateMatch;
  installing: boolean;
  generating: boolean;
  error?: string;
  onBuy: () => void;
  onCustom: () => void;
  t: (k: string) => string;
  som: (n: number) => string;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="mb-1 flex items-center gap-2">
          <PackageCheck className="h-4 w-4 text-primary" />
          <h3 className="text-lg font-bold">{t("compose.templateFound")}</h3>
        </div>
        <p className="text-sm text-muted-foreground">{t("compose.templateFoundDesc")}</p>
        <div className="mt-3 rounded-lg bg-background/60 p-3">
          <p className="font-semibold">{suggestion.profession}</p>
          <p className="text-sm text-muted-foreground">{suggestion.flagship}</p>
          <p className="mt-2 text-sm">
            {som(suggestion.price.createSom)} so'm{" "}
            <span className="text-xs text-muted-foreground">
              ({som(suggestion.price.monthlySom)} so'm/{t("compose.mo")})
            </span>
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button className="flex-1" onClick={onBuy} disabled={installing || generating}>
          {installing ? <Loader2 className="animate-spin" /> : <Check />} {t("compose.buyTemplate")}
        </Button>
        <Button variant="outline" onClick={onCustom} disabled={installing || generating}>
          {generating ? <Loader2 className="animate-spin" /> : <Wand2 />} {t("compose.useCustomAnyway")}
        </Button>
      </div>
    </div>
  );
}
