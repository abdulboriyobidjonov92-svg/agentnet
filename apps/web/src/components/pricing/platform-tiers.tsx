"use client";
import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { Check, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { toast } from "@/components/ui/toast";
import { PLATFORM_TIERS, type SelfServePlan } from "./platform-tiers-data";

interface PlatformPlansCatalog {
  pro: { priceSom: number; chatPerDay: number };
  max: { priceSom: number; chatPerDay: number };
  max200: { priceSom: number; chatPerDay: number };
  enterprise: { priceSom: null; chatPerDay: null };
}

interface PlatformStatus {
  plan: string;
  rawPlan: string;
  until: string | null;
  frozen: boolean;
}

// Platforma imkoniyatlari — Twin/Fusion/Supermode, per-agent narxlashdan BUTUNLAY ALOHIDA
export function PlatformTiers() {
  const api = useApiClient();
  const { t, locale } = useT();

  const { data: platformPlans, isError: platformPlansError, refetch: refetchPlatformPlans } = useQuery({
    queryKey: ["platform-plans"],
    queryFn: () => api.get<PlatformPlansCatalog>("/platform/plans"),
  });
  const { data: platformStatus } = useQuery({
    queryKey: ["platform-status"],
    queryFn: () => api.get<PlatformStatus>("/platform/status"),
  });

  const [platformProvider, setPlatformProvider] = useState<"payme" | "click">("payme");
  const subscribe = useMutation({
    mutationFn: (plan: SelfServePlan) => api.post<{ payUrl: string }>("/platform/subscribe", { plan, provider: platformProvider }),
    onSuccess: (res) => window.open(res.payUrl, "_blank"),
    onError: (e: any) => {
      toast({ variant: "destructive", title: t("common.error"), description: e.message });
    },
  });

  const fmt = (n: number) => n.toLocaleString(locale === "uz" ? "uz-UZ" : locale === "ru" ? "ru-RU" : "en-US");

  if (platformPlansError) {
    return <ErrorState onRetry={() => refetchPlatformPlans()} />;
  }

  return (
    <>
      <div className="mb-5 flex justify-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
          <input type="radio" name="platform-pay-provider" checked={platformProvider === "payme"} onChange={() => setPlatformProvider("payme")} />
          Payme
        </label>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
          <input type="radio" name="platform-pay-provider" checked={platformProvider === "click"} onChange={() => setPlatformProvider("click")} />
          Click
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {PLATFORM_TIERS.map((tier) => {
          const Icon = tier.icon;
          const priceSom = tier.self ? platformPlans?.[tier.id as SelfServePlan]?.priceSom : null;
          const chatPerDay = tier.self ? platformPlans?.[tier.id as SelfServePlan]?.chatPerDay : null;
          const isCurrent = tier.self && platformStatus?.plan === tier.id;
          return (
            <div
              key={tier.id}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-card p-6",
                tier.highlight ? "border-primary/40 shadow-glow" : "shadow-soft",
              )}
            >
              {tier.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-[11px] font-bold uppercase text-primary-foreground">
                  <Sparkles className="mr-1 inline h-3 w-3" />
                  {t("pricing.platform.popular")}
                </span>
              )}
              <div className="flex items-center gap-2">
                <Icon className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">{t(tier.name)}</h3>
              </div>
              <p className="mt-1 min-h-10 text-sm text-muted-foreground">{t(tier.desc)}</p>
              <p className="mt-4 text-3xl font-bold">
                {tier.self ? (priceSom != null ? `${fmt(priceSom)} so'm` : "…") : t("pricing.platform.custom")}
                {tier.self && <span className="text-sm font-normal text-muted-foreground">{t("pricing.platform.perMonth")}</span>}
              </p>
              <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{t(f)}</span>
                  </li>
                ))}
                {tier.self && (
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{chatPerDay != null ? `${fmt(chatPerDay)} ${t("pricing.platform.chatPerDay")}` : "…"}</span>
                  </li>
                )}
              </ul>
              {isCurrent ? (
                <div className="mt-5 rounded-lg bg-primary/10 px-3 py-2 text-center text-xs font-medium text-primary">
                  {t("pricing.platform.currentPlan")}
                  {platformStatus?.until && (
                    <span className="mt-0.5 block">
                      {t("pricing.platform.activeUntil")}: {new Date(platformStatus.until).toLocaleDateString(locale === "uz" ? "uz-UZ" : locale === "ru" ? "ru-RU" : "en-US")}
                    </span>
                  )}
                </div>
              ) : tier.self ? (
                <Button
                  className="mt-5 w-full"
                  onClick={() => subscribe.mutate(tier.id as SelfServePlan)}
                  disabled={subscribe.isPending || !platformPlans}
                >
                  {subscribe.isPending ? <Loader2 className="animate-spin" /> : <Icon />}
                  {subscribe.isPending ? t("pricing.platform.subscribing") : t("pricing.platform.subscribe")}
                </Button>
              ) : (
                <Button asChild variant="outline" className="mt-5 w-full">
                  <Link href={tier.href!}>
                    <Icon /> {t(tier.cta!)}
                  </Link>
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {platformStatus?.frozen && (
        <p className="mt-5 rounded-lg bg-destructive/10 px-3 py-2 text-center text-sm font-medium text-destructive">
          {t("pricing.platform.frozen")}
        </p>
      )}
      {!platformStatus || platformStatus.plan === "none" ? (
        <p className="mt-5 text-center text-xs text-muted-foreground">{t("pricing.platform.none")}</p>
      ) : null}
    </>
  );
}
