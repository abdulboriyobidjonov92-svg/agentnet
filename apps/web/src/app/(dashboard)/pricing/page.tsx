"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useApiClient } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { Gem, Check, Loader2, Building2, Sparkles, Wallet, Rocket, Crown, Users2 } from "lucide-react";
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
  max200: { priceSom: number; chatPerDay: number };
  enterprise: { priceSom: null; chatPerDay: null };
}

type SelfServePlan = "pro" | "max" | "max200";

// Platforma tariflari (Claude.ai uslubi) — self-serve: pro/max/max200; team/enterprise: bog'lanish.
// `features` = i18n kalitlari (har tarif nima ochishini aniq ro'yxatlaydi).
interface PlatformTier {
  id: SelfServePlan | "team" | "enterprise";
  self: boolean;
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  desc: string;
  features: string[];
  highlight?: boolean;
  cta?: string;
  href?: string;
}

const PLATFORM_TIERS: PlatformTier[] = [
  {
    id: "pro",
    self: true,
    icon: Rocket,
    name: "pricing.platform.pro",
    desc: "pricing.platform.proDesc",
    features: ["pricing.pt.f.decision", "pricing.pt.f.experts", "pricing.pt.f.deep", "pricing.pt.f.standard"],
  },
  {
    id: "max",
    self: true,
    icon: Crown,
    highlight: true,
    name: "pricing.platform.max",
    desc: "pricing.platform.maxDesc",
    features: ["pricing.pt.inPro", "pricing.pt.priority"],
  },
  {
    id: "max200",
    self: true,
    icon: Gem,
    name: "pricing.pt.max200",
    desc: "pricing.pt.max200Desc",
    features: ["pricing.pt.inMax", "pricing.pt.topPriority"],
  },
  {
    id: "team",
    self: false,
    icon: Users2,
    name: "pricing.pt.team",
    desc: "pricing.pt.teamDesc",
    features: ["pricing.pt.team.f1", "pricing.pt.team.f2", "pricing.pt.team.f3"],
    cta: "pricing.platform.contactUs",
    href: "mailto:sales@agentnet.app",
  },
  {
    id: "enterprise",
    self: false,
    icon: Building2,
    name: "pricing.platform.enterprise",
    desc: "pricing.platform.enterpriseDesc",
    features: ["pricing.platform.unlimited", "pricing.pt.ent.f1", "pricing.pt.ent.f2"],
    cta: "pricing.platform.contactUs",
    href: "mailto:sales@agentnet.app",
  },
];

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
    mutationFn: (plan: SelfServePlan) => api.post<{ payUrl: string }>("/platform/subscribe", { plan, provider: platformProvider }),
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
        <div className="flex min-w-0 flex-col rounded-2xl border bg-card p-4 shadow-soft sm:p-6">
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
        <div className="relative flex min-w-0 flex-col rounded-2xl border border-primary/40 bg-card p-4 shadow-glow sm:p-6">
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
            <Button className="mt-5 w-full whitespace-normal" onClick={upgrade} disabled={upgrading || !plans}>
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
        <div className="flex min-w-0 flex-col rounded-2xl border bg-card p-4 shadow-soft sm:p-6">
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
          <Button asChild variant="outline" className="mt-5 w-full whitespace-normal">
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
                      className="mt-5 w-full whitespace-normal"
                      onClick={() => subscribe.mutate(tier.id as SelfServePlan)}
                      disabled={subscribe.isPending || !platformPlans}
                    >
                      {subscribe.isPending ? <Loader2 className="animate-spin" /> : <Icon />}
                      {subscribe.isPending ? t("pricing.platform.subscribing") : t("pricing.platform.subscribe")}
                    </Button>
                  ) : (
                    <Button asChild variant="outline" className="mt-5 w-full whitespace-normal">
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
