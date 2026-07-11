"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useApiClient } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { Gem, Check, Loader2, Building2, Sparkles, Wallet, Rocket, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { toast } from "@/components/ui/toast";

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

interface PlatformPlansCatalog {
  pro: { priceSom: number; chatPerDay: number };
  max: { priceSom: number; chatPerDay: number };
  enterprise: { priceSom: null; chatPerDay: null };
}

interface PlatformStatus {
  plan: string;
  rawPlan: string;
  until: string | null;
  frozen: boolean;
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
    mutationFn: (plan: "pro" | "max") => api.post<{ payUrl: string }>("/platform/subscribe", { plan, provider: platformProvider }),
    onSuccess: (res) => window.open(res.payUrl, "_blank"),
    onError: (e: any) => {
      toast({ variant: "destructive", title: t("common.error"), description: e.message });
    },
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

      <div className="mb-6">
        <h2 className="text-xl font-bold tracking-tight">{t("pricing.vertical.title")}</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("pricing.vertical.subtitle")}</p>
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

      {/* Platforma imkoniyatlari — Twin/Fusion/Supermode, per-agent narxlashdan BUTUNLAY ALOHIDA */}
      <div className="mb-6 mt-16 border-t pt-10">
        <h2 className="text-xl font-bold tracking-tight">{t("pricing.platform.title")}</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("pricing.platform.subtitle")}</p>
      </div>

      {platformPlansError ? (
        <ErrorState onRetry={() => refetchPlatformPlans()} />
      ) : (
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

          <div className="grid gap-6 md:grid-cols-3">
            {/* Pro */}
            <div className="flex flex-col rounded-2xl border bg-card p-6 shadow-soft">
              <h3 className="text-lg font-semibold">{t("pricing.platform.pro")}</h3>
              <p className="mt-1 min-h-10 text-sm text-muted-foreground">{t("pricing.platform.proDesc")}</p>
              <p className="mt-4 text-3xl font-bold">
                {platformPlans ? `${fmt(platformPlans.pro.priceSom)} so'm` : "…"}
                <span className="text-sm font-normal text-muted-foreground">{t("pricing.platform.perMonth")}</span>
              </p>
              <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                  {platformPlans ? `${fmt(platformPlans.pro.chatPerDay)} ${t("pricing.platform.chatPerDay")}` : "…"}
                </li>
              </ul>
              {platformStatus?.plan === "pro" ? (
                <div className="mt-5 rounded-lg bg-primary/10 px-3 py-2 text-center text-xs font-medium text-primary">
                  {t("pricing.platform.currentPlan")}
                  {platformStatus.until && (
                    <span className="block mt-0.5">
                      {t("pricing.platform.activeUntil")}: {new Date(platformStatus.until).toLocaleDateString(locale === "uz" ? "uz-UZ" : locale === "ru" ? "ru-RU" : "en-US")}
                    </span>
                  )}
                </div>
              ) : (
                <Button className="mt-5 w-full" onClick={() => subscribe.mutate("pro")} disabled={subscribe.isPending || !platformPlans}>
                  {subscribe.isPending ? <Loader2 className="animate-spin" /> : <Rocket />}
                  {subscribe.isPending ? t("pricing.platform.subscribing") : t("pricing.platform.subscribe")}
                </Button>
              )}
            </div>

            {/* Max */}
            <div className="relative flex flex-col rounded-2xl border border-primary/40 bg-card p-6 shadow-glow">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-[11px] font-bold uppercase text-primary-foreground">
                <Sparkles className="mr-1 inline h-3 w-3" />
                {t("pricing.platform.max")}
              </span>
              <h3 className="text-lg font-semibold">{t("pricing.platform.max")}</h3>
              <p className="mt-1 min-h-10 text-sm text-muted-foreground">{t("pricing.platform.maxDesc")}</p>
              <p className="mt-4 text-3xl font-bold">
                {platformPlans ? `${fmt(platformPlans.max.priceSom)} so'm` : "…"}
                <span className="text-sm font-normal text-muted-foreground">{t("pricing.platform.perMonth")}</span>
              </p>
              <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                  {platformPlans ? `${fmt(platformPlans.max.chatPerDay)} ${t("pricing.platform.chatPerDay")}` : "…"}
                </li>
              </ul>
              {platformStatus?.plan === "max" ? (
                <div className="mt-5 rounded-lg bg-primary/10 px-3 py-2 text-center text-xs font-medium text-primary">
                  {t("pricing.platform.currentPlan")}
                  {platformStatus.until && (
                    <span className="block mt-0.5">
                      {t("pricing.platform.activeUntil")}: {new Date(platformStatus.until).toLocaleDateString(locale === "uz" ? "uz-UZ" : locale === "ru" ? "ru-RU" : "en-US")}
                    </span>
                  )}
                </div>
              ) : (
                <Button className="mt-5 w-full" onClick={() => subscribe.mutate("max")} disabled={subscribe.isPending || !platformPlans}>
                  {subscribe.isPending ? <Loader2 className="animate-spin" /> : <Crown />}
                  {subscribe.isPending ? t("pricing.platform.subscribing") : t("pricing.platform.subscribe")}
                </Button>
              )}
            </div>

            {/* Enterprise — o'z-o'zidan sotib olinmaydi, "kelishuv asosida" */}
            <div className="flex flex-col rounded-2xl border bg-card p-6 shadow-soft">
              <h3 className="text-lg font-semibold">{t("pricing.platform.enterprise")}</h3>
              <p className="mt-1 min-h-10 text-sm text-muted-foreground">{t("pricing.platform.enterpriseDesc")}</p>
              <p className="mt-4 text-3xl font-bold">{t("pricing.platform.custom")}</p>
              <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-primary" /> {t("pricing.platform.unlimited")}
                </li>
              </ul>
              <Button asChild variant="outline" className="mt-5 w-full">
                <Link href="mailto:sales@agentnet.app">
                  <Building2 /> {t("pricing.platform.contactUs")}
                </Link>
              </Button>
            </div>
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
      )}

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
