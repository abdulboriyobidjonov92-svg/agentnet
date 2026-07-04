"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { Gem, Check, Loader2, Building2, Sparkles, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";

interface PlansCatalog {
  pricePerMessageSom: number;
  proMonthSom: number;
  limits: {
    free: { chatPerDay: number; agentsMax: number };
    pro: { chatPerDay: number; agentsMax: number };
  };
}

interface UsageStatus {
  plan: string;
  proUntil?: string | null;
}

export default function PricingPage() {
  const api = useApiClient();
  const { t, locale } = useT();
  const queryClient = useQueryClient();

  const [upgrading, setUpgrading] = useState(false);
  const [upgraded, setUpgraded] = useState(false);
  const [error, setError] = useState("");

  const { data: plans, isError: plansError, refetch: refetchPlans } = useQuery({
    queryKey: ["billing-plans"],
    queryFn: () => api.get<PlansCatalog>("/billing/plans"),
  });
  const { data: usage } = useQuery({
    queryKey: ["usage"],
    queryFn: () => api.get<UsageStatus>("/usage/me"),
  });

  const fmt = (n: number) => n.toLocaleString(locale === "uz" ? "uz-UZ" : locale === "ru" ? "ru-RU" : "en-US");
  const isPro = usage?.plan === "pro";

  const upgrade = async () => {
    setUpgrading(true);
    setError("");
    try {
      await api.post("/billing/upgrade-pro", {});
      setUpgraded(true);
      queryClient.invalidateQueries({ queryKey: ["usage"] });
      queryClient.invalidateQueries({ queryKey: ["billing"] });
    } catch (e: any) {
      if (e?.status === 402) setError(t("pricing.insufficient"));
      else setError(e?.payload?.message ?? t("common.error"));
    } finally {
      setUpgrading(false);
    }
  };

  if (plansError) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <ErrorState onRetry={() => refetchPlans()} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-10 text-center">
        <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
          <Gem className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{t("pricing.title")}</h1>
        <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">{t("pricing.subtitle")}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Free */}
        <div className="flex flex-col rounded-2xl border bg-card p-6 shadow-soft">
          <h2 className="text-lg font-semibold">{t("pricing.freeName")}</h2>
          <p className="mt-1 min-h-10 text-sm text-muted-foreground">{t("pricing.freeDesc")}</p>
          <p className="mt-4 text-3xl font-bold">{t("pricing.free0")}</p>
          <ul className="mt-5 flex-1 space-y-2.5 text-sm">
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0 text-primary" />
              {plans ? `${fmt(plans.limits.free.chatPerDay)} ${t("pricing.chatPerDay")}` : "…"}
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0 text-primary" />
              {plans ? `${fmt(plans.limits.free.agentsMax)} ${t("pricing.agentsMax")}` : "…"}
            </li>
            <li className="flex items-center gap-2">
              <Wallet className="h-4 w-4 shrink-0 text-muted-foreground" />
              {plans ? `${fmt(plans.pricePerMessageSom)} so'm ${t("pricing.perMessage")}` : "…"}
            </li>
          </ul>
          {!isPro && usage && (
            <p className="mt-5 rounded-lg bg-muted px-3 py-2 text-center text-xs font-medium text-muted-foreground">
              {t("pricing.currentPlan")}
            </p>
          )}
        </div>

        {/* Pro */}
        <div className="relative flex flex-col rounded-2xl border border-primary/40 bg-card p-6 shadow-glow">
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-[11px] font-bold uppercase text-primary-foreground">
            <Sparkles className="mr-1 inline h-3 w-3" />
            {t("pricing.proName")}
          </span>
          <h2 className="text-lg font-semibold">{t("pricing.proName")}</h2>
          <p className="mt-1 min-h-10 text-sm text-muted-foreground">{t("pricing.proDesc")}</p>
          <p className="mt-4 text-3xl font-bold">
            {plans ? `${fmt(plans.proMonthSom)} so'm` : "…"}
            <span className="text-sm font-normal text-muted-foreground"> {t("pricing.perMonth")}</span>
          </p>
          <ul className="mt-5 flex-1 space-y-2.5 text-sm">
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0 text-primary" />
              {plans ? `${fmt(plans.limits.pro.chatPerDay)} ${t("pricing.chatPerDay")}` : "…"}
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0 text-primary" />
              {plans ? `${fmt(plans.limits.pro.agentsMax)} ${t("pricing.agentsMax")}` : "…"}
            </li>
            <li className="flex items-center gap-2">
              <Wallet className="h-4 w-4 shrink-0 text-muted-foreground" />
              {plans ? `${fmt(plans.pricePerMessageSom)} so'm ${t("pricing.perMessage")}` : "…"}
            </li>
          </ul>
          {isPro ? (
            <div className="mt-5 rounded-lg bg-primary/10 px-3 py-2 text-center text-xs font-medium text-primary">
              {t("pricing.currentPlan")}
              {usage?.proUntil && (
                <span className="block mt-0.5">
                  {t("pricing.activeUntil")}: {new Date(usage.proUntil).toLocaleDateString(locale === "uz" ? "uz-UZ" : locale === "ru" ? "ru-RU" : "en-US")}
                </span>
              )}
            </div>
          ) : upgraded ? (
            <p className="mt-5 rounded-lg bg-primary/10 px-3 py-2 text-center text-sm font-medium text-primary">
              {t("pricing.upgraded")}
            </p>
          ) : (
            <Button className="mt-5 w-full" onClick={upgrade} disabled={upgrading || !plans}>
              {upgrading ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {upgrading ? t("pricing.upgrading") : t("pricing.upgradeBtn")}
            </Button>
          )}
          {error && (
            <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-center text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>

        {/* Enterprise */}
        <div className="flex flex-col rounded-2xl border bg-card p-6 shadow-soft">
          <h2 className="text-lg font-semibold">{t("pricing.entName")}</h2>
          <p className="mt-1 min-h-10 text-sm text-muted-foreground">{t("pricing.entDesc")}</p>
          <p className="mt-4 text-3xl font-bold">
            <Building2 className="inline h-7 w-7 text-primary" />
          </p>
          <ul className="mt-5 flex-1 space-y-2.5 text-sm">
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0 text-primary" /> AI-CEO · CFO · CMO · CLO · CTO
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0 text-primary" /> Ethics Guard
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0 text-primary" /> Compliance packs
            </li>
          </ul>
          <Button asChild variant="outline" className="mt-5 w-full">
            <Link href="/agentos">
              <Building2 /> {t("pricing.entCta")}
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-8 space-y-2 text-center text-xs text-muted-foreground">
        <p>{t("pricing.balanceNote")}</p>
        <p>
          {t("pricing.marketplaceNote")}{" "}
          <Link href="/marketplace" className="text-primary underline-offset-2 hover:underline">
            Marketplace →
          </Link>
        </p>
      </div>
    </div>
  );
}
