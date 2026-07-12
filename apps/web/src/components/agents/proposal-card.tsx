"use client";
import { Check, RotateCcw, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ComposeResult } from "./compose-types";

export function ProposalCard({
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
