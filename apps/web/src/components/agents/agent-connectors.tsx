"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Plug, Unplug, ExternalLink } from "lucide-react";
import { useApiClient } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { RiskBadge } from "@/components/ui/status";
import { connectorRiskTier } from "@/lib/connector-risk";

/**
 * Agent sozlamalaridagi "Konnektorlar" bo'limi (UI-3).
 *
 * IKKI XIL BIRIKTIRMA ko'rsatiladi va ular ATAYLAB ajratilgan — chunki
 * ularning "uzish" oqibati boshqacha:
 *
 *   AGENTGA XOS  — faqat shu agent ko'radi. Uzish boshqa agentlarga tegmaydi.
 *   UMUMIY       — foydalanuvchining BARCHA agentlari ko'radi. Bu yerdan
 *                  uzish HAMMASIGA ta'sir qiladi, shuning uchun bu yerda
 *                  uzish tugmasi YO'Q — foydalanuvchi Ulanishlar sahifasiga
 *                  yuboriladi (u yerda qamrov ko'rinib turadi).
 *
 * Backend ko'rinish qoidasi bilan bir xil: `agentId IS NULL` YOKI shu agent
 * (`connectors.service.ts` `toolSpecsForAgent`).
 */
export function AgentConnectors({ agentId }: { agentId: string }) {
  const api = useApiClient();
  const qc = useQueryClient();
  const { t } = useT();

  const { data: connectors, isLoading, isError, refetch } = useQuery({
    queryKey: ["connectors"],
    queryFn: () => api.get<any[]>("/connectors/mine"),
  });

  const detach = useMutation({
    mutationFn: (connectorId: string) =>
      api.delete(`/connectors/${connectorId}/configure?agentId=${agentId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["connectors"] }),
  });

  const mine = (connectors ?? []).filter((c) =>
    c.attachedAgents?.some((a: any) => a.id === agentId),
  );
  const shared = (connectors ?? []).filter((c) => c.connected);

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-soft">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="font-semibold">{t("conn.title")}</h2>
        <Button asChild variant="ghost" size="sm">
          <Link href="/connectors">
            {t("conn.manage")} <ExternalLink />
          </Link>
        </Button>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{t("conn.agentSectionDesc")}</p>

      {isLoading && <div className="h-20 animate-pulse rounded-xl bg-muted" />}
      {isError && <ErrorState onRetry={() => refetch()} />}

      {!isLoading && !isError && mine.length === 0 && shared.length === 0 && (
        // Bo'sh holat — harakatga chorlaydi, shunchaki "yo'q" demaydi.
        <div className="rounded-xl border border-dashed p-6 text-center">
          <Plug className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t("conn.agentEmpty")}</p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link href="/connectors">{t("conn.connect")}</Link>
          </Button>
        </div>
      )}

      {mine.length > 0 && (
        <div className="space-y-1.5">
          <p className="label-mono">{t("conn.agentOnly")}</p>
          {mine.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 rounded-xl bg-muted px-3 py-2">
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <Bot className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{c.name}</span>
                <RiskBadge tier={connectorRiskTier(c)} label={t(`risk.${connectorRiskTier(c)}`)} />
              </span>
              <Button
                variant="destructive-ghost"
                size="sm"
                onClick={() => detach.mutate(c.id)}
                loading={detach.isPending && detach.variables === c.id}
              >
                <Unplug /> {t("conn.detach")}
              </Button>
            </div>
          ))}
        </div>
      )}

      {shared.length > 0 && (
        <div className="mt-4 space-y-1.5">
          <p className="label-mono">{t("conn.sharedWithAll")}</p>
          {shared.map((c) => (
            <div key={c.id} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
              <Plug className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{c.name}</span>
              <RiskBadge tier={connectorRiskTier(c)} label={t(`risk.${connectorRiskTier(c)}`)} />
            </div>
          ))}
          <p className="pt-1 text-xs text-muted-foreground">{t("conn.sharedHint")}</p>
        </div>
      )}
    </div>
  );
}
