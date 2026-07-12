"use client";
import { useT } from "@/lib/i18n/client";
import { CircleUserRound } from "lucide-react";
import { InfoHint } from "@/components/ui/info-hint";
import { FactsPanel } from "@/components/twin/facts-panel";
import { WhatifPanel } from "@/components/twin/whatif-panel";

export default function TwinPage() {
  const { t } = useT();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <CircleUserRound className="h-6 w-6 text-primary" /> {t("twin.title")}
          <InfoHint text={t("twin.hint")} label={t("twin.title")} />
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("twin.subtitle")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <FactsPanel />
        <WhatifPanel />
      </div>
    </div>
  );
}
