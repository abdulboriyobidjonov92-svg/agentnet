"use client";
import { useT } from "@/lib/i18n/client";
import { Bot, Download, Check, BadgeCheck, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AgentCard({
  agent,
  installing,
  installed,
  installErrorMessage,
  ratingOpen,
  onInstall,
  onToggleRating,
  onRate,
}: {
  agent: any;
  installing: boolean;
  installed: boolean;
  installErrorMessage: string | null;
  ratingOpen: boolean;
  onInstall: () => void;
  onToggleRating: () => void;
  onRate: (rating: number) => void;
}) {
  const { t } = useT();

  return (
    <div className="flex flex-col rounded-2xl border bg-card p-5 shadow-soft transition hover:shadow-lift">
      <div className="mb-3 flex items-start gap-3">
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Bot className="h-5 w-5" />
          <span className="absolute -left-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground shadow-soft">
            {agent.rank}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-1.5 font-semibold">
            <span className="truncate">{agent.name}</span>
            {agent.verified && (
              <span title={t("market.verified")}>
                <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />
              </span>
            )}
          </h3>
          {agent.user?.email && <p className="truncate text-xs text-muted-foreground">by {agent.user.email}</p>}
        </div>
      </div>

      {agent.description && <p className="mb-2 text-sm text-muted-foreground">{agent.description}</p>}

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Star className="h-3.5 w-3.5 text-gold" />
          {agent.ratingAvg ? `${agent.ratingAvg.toFixed(1)} (${agent.ratingCount})` : "—"}
        </span>
        <span>· {agent.installCount} {t("market.installs")}</span>
        <span>· {agent.usageCount} {t("market.uses")}</span>
        {agent.vertical && <span className="rounded-full bg-secondary px-2 py-0.5">{agent.vertical}</span>}
      </div>

      <div className="mt-auto flex gap-2">
        <Button onClick={onInstall} disabled={installing || installed} className="flex-1">
          {installed ? (
            <><Check /> {t("market.installed")}</>
          ) : (
            <>
              <Download />
              {agent.marketplacePrice ? `${Math.round(agent.marketplacePrice / 100).toLocaleString()} so'm` : t("market.install")}
            </>
          )}
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={onToggleRating}
          title={t("market.rate")}
          aria-label={t("market.rate")}
        >
          <Star />
        </Button>
      </div>

      {installErrorMessage && (
        <p role="alert" className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {installErrorMessage}
        </p>
      )}

      {ratingOpen && (
        <div className="mt-2 flex justify-center gap-1">
          {[1, 2, 3, 4, 5].map((r) => (
            <button
              key={r}
              onClick={() => onRate(r)}
              aria-label={`${t("market.rate")}: ${r}/5`}
              className="rounded-lg p-2.5 transition hover:bg-muted"
            >
              <Star className="h-5 w-5 text-gold" fill="currentColor" fillOpacity={0.4} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
