"use client";
import { useT } from "@/lib/i18n/client";
import { Loader2, ArrowRight, Check, Bot, BadgeCheck, Target, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { pick, type DetectedProfile } from "./onboarding-types";

// Bosqich 2: aniqlangan profil + tavsiya agentlar
export function ProfileStep({
  profile,
  selected,
  installing,
  error,
  onToggleAgent,
  onRedo,
  onInstall,
}: {
  profile: DetectedProfile;
  selected: Set<number>;
  installing: boolean;
  error: string;
  onToggleAgent: (i: number) => void;
  onRedo: () => void;
  onInstall: () => void;
}) {
  const { t, locale } = useT();

  return (
    <div className="space-y-6 animate-in-up">
      <div className="rounded-2xl border bg-card p-6 shadow-soft">
        <div className="mb-4 flex items-center gap-2">
          <BadgeCheck className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">{t("onb.detectedTitle")}</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-muted/60 p-3">
            <p className="text-xs text-muted-foreground">{t("onb.profession")}</p>
            <p className="mt-0.5 font-semibold capitalize">{profile.profession_title}</p>
          </div>
          <div className="rounded-xl bg-muted/60 p-3">
            <p className="text-xs text-muted-foreground">{t("onb.domain")}</p>
            <p className="mt-0.5 font-semibold">{pick(profile.domain_label, locale)}</p>
          </div>
          <div className="rounded-xl bg-muted/60 p-3">
            <p className="text-xs text-muted-foreground">{t("onb.confidence")}</p>
            <p className="mt-0.5 font-semibold">{Math.round(profile.confidence * 100)}%</p>
          </div>
        </div>
        {profile.goals.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Target className="h-3.5 w-3.5" /> {t("onb.goals")}
            </p>
            <div className="flex flex-wrap gap-2">
              {profile.goals.map((g) => (
                <span key={g} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  {g}
                </span>
              ))}
            </div>
          </div>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          {profile.method === "keyword" ? t("onb.offlineNote") : profile.reasoning}
        </p>
        <button
          onClick={onRedo}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          <RotateCcw className="h-3 w-3" /> {t("onb.redo")}
        </button>
      </div>

      <div>
        <h3 className="text-lg font-semibold">{t("onb.recommended")}</h3>
        <p className="mb-3 text-sm text-muted-foreground">{t("onb.recommendedSub")}</p>
        <div className="space-y-2">
          {profile.recommended_agents.map((agent, i) => {
            const checked = selected.has(i);
            return (
              <button
                key={i}
                type="button"
                onClick={() => onToggleAgent(i)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition",
                  checked ? "border-primary bg-primary/5" : "hover:bg-muted",
                )}
              >
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                    checked ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  <Bot className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{pick(agent.name, locale)}</p>
                  <p className="text-sm text-muted-foreground">{pick(agent.description, locale)}</p>
                </div>
                {checked && <Check className="h-5 w-5 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Button size="lg" onClick={onInstall} disabled={installing} className="w-full">
        {installing ? (
          <>
            <Loader2 className="animate-spin" /> {t("onb.installing")}
          </>
        ) : (
          <>
            {t("onb.install")} ({selected.size})
            <ArrowRight />
          </>
        )}
      </Button>
    </div>
  );
}
