"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { Package, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { URGENCY_STYLE, type ProductForecast } from "./retail-types";

// Avtonom buyurtma qoralamalari — egasi tasdiqlamaguncha yuborilmaydi
export function ReorderPlanCard() {
  const api = useApiClient();
  const { t } = useT();
  const { data: reorderPlan, refetch: refetchReorderPlan } = useQuery({
    queryKey: ["retail-reorder-plan"],
    queryFn: () => api.get<{ drafts: any[] }>("/retail/reorder-plan"),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/retail/reorder-plan/${id}/confirm`, {}),
    onSuccess: () => refetchReorderPlan(),
  });
  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.post(`/retail/reorder-plan/${id}/cancel`, {}),
    onSuccess: () => refetchReorderPlan(),
  });

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-soft">
      <h2 className="mb-3 inline-flex items-center gap-2 font-semibold"><Package className="h-4 w-4 text-primary" /> {t("retail.reorder")}</h2>
      {!reorderPlan?.drafts?.length ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{t("retail.reorder.empty")}</p>
      ) : (
        <div className="space-y-3">
          {reorderPlan.drafts.map((d: any) => (
            <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{d.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${URGENCY_STYLE[d.urgency as ProductForecast["urgency"]]}`}>
                    {t(`retail.forecast.status.${d.urgency}`)}
                  </span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{d.orderQty} {t("retail.reorder.qty")}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{d.message}</p>
              </div>
              {d.status === "pending" ? (
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    onClick={() => approveMutation.mutate(d.id)}
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                  >
                    <Check className="mr-1 h-3.5 w-3.5" /> {t("retail.reorder.approve")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => rejectMutation.mutate(d.id)}
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                  >
                    <X className="mr-1 h-3.5 w-3.5" /> {t("retail.reorder.reject")}
                  </Button>
                </div>
              ) : (
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${d.status === "approved" ? "bg-emerald-500/15 text-emerald-500" : "bg-secondary text-muted-foreground"}`}>
                  {d.status === "approved" ? t("retail.reorder.approved") : t("retail.reorder.rejected")}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
