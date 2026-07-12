"use client";
import { Gem } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { ErrorState } from "@/components/ui/error-state";
import { VerticalPlans, useBillingPlans } from "@/components/pricing/vertical-plans";
import { PlatformTiers } from "@/components/pricing/platform-tiers";
import Link from "next/link";

export default function PricingPage() {
  const { t } = useT();
  const { isError: plansError, refetch: refetchPlans } = useBillingPlans();

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

      <VerticalPlans />

      {/* Platforma imkoniyatlari — Twin/Fusion/Supermode, per-agent narxlashdan BUTUNLAY ALOHIDA */}
      <div className="mb-6 mt-16 border-t pt-10">
        <h2 className="text-xl font-bold tracking-tight">{t("pricing.platform.title")}</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("pricing.platform.subtitle")}</p>
      </div>

      <PlatformTiers />

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
