"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Raqobatchi narx monitoringi — kunlik cron + qo'lda tekshirish
export function CompetitorsCard() {
  const api = useApiClient();
  const qc = useQueryClient();
  const { t } = useT();
  const [compSku, setCompSku] = useState("");
  const [compName, setCompName] = useState("");
  const [compUrl, setCompUrl] = useState("");
  const [compPrice, setCompPrice] = useState("");

  const { data: products } = useQuery({ queryKey: ["retail-products"], queryFn: () => api.get<any[]>("/retail/products") });
  const { data: compSources } = useQuery({ queryKey: ["retail-competitors"], queryFn: () => api.get<any[]>("/retail/competitors") });
  const { data: compChecks } = useQuery({ queryKey: ["retail-competitor-checks"], queryFn: () => api.get<any[]>("/retail/competitors/checks") });

  const addCompMutation = useMutation({
    mutationFn: () =>
      api.post("/retail/competitors", {
        sku: compSku,
        name: compName,
        url: compUrl || undefined,
        manualPrice: compPrice ? Number(compPrice) : undefined,
      }),
    onSuccess: () => {
      setCompName("");
      setCompUrl("");
      setCompPrice("");
      qc.invalidateQueries({ queryKey: ["retail-competitors"] });
    },
  });
  const checkNowMutation = useMutation({
    mutationFn: () => api.post("/retail/competitors/check-now", {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["retail-competitor-checks"] });
      qc.invalidateQueries({ queryKey: ["retail-alerts"] });
    },
  });

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="inline-flex items-center gap-2 font-semibold"><Store className="h-4 w-4 text-primary" /> {t("retail.competitors")}</h2>
        <Button variant="outline" size="sm" onClick={() => checkNowMutation.mutate()} disabled={checkNowMutation.isPending}>
          {checkNowMutation.isPending ? "…" : t("retail.competitors.checkNow")}
        </Button>
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <select value={compSku} onChange={(e) => setCompSku(e.target.value)} className="rounded-xl border bg-background px-3 py-2 text-sm outline-none">
          <option value="">SKU…</option>
          {products?.map((p) => <option key={p.sku} value={p.sku}>{p.sku} — {p.name}</option>)}
        </select>
        <Input value={compName} onChange={(e) => setCompName(e.target.value)} placeholder={t("retail.competitors.name")} className="sm:w-40" />
        <Input value={compUrl} onChange={(e) => setCompUrl(e.target.value)} placeholder={t("retail.competitors.url")} className="flex-1" />
        <Input value={compPrice} onChange={(e) => setCompPrice(e.target.value)} placeholder={t("retail.competitors.manualPrice")} type="number" className="sm:w-40" />
        <Button
          onClick={() => addCompMutation.mutate()}
          disabled={addCompMutation.isPending || !compSku || !compName || (!compUrl && !compPrice)}
        >
          {t("retail.competitors.add")}
        </Button>
      </div>

      {!compSources?.length ? (
        <p className="py-4 text-center text-sm text-muted-foreground">{t("retail.competitors.empty")}</p>
      ) : (
        <table className="mb-4 w-full text-sm">
          <tbody>
            {compSources.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="py-2 font-mono text-xs text-muted-foreground">{s.sku}</td>
                <td className="py-2 font-medium">{s.name}</td>
                <td className="py-2 text-right text-xs text-muted-foreground">
                  {s.url ?? (s.manualPrice ? `${Math.round(s.manualPrice / 100)} so'm` : "—")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="border-t pt-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">{t("retail.competitors.checks")}</p>
        {!compChecks?.length ? (
          <p className="py-2 text-center text-sm text-muted-foreground">{t("retail.competitors.checks.empty")}</p>
        ) : (
          <div className="space-y-1.5">
            {compChecks.slice(0, 8).map((c: any) => (
              <div key={c.id} className="flex items-center justify-between text-xs">
                <span className="font-mono text-muted-foreground">{c.sku}</span>
                <span className={c.ok ? "text-foreground" : "text-destructive"}>
                  {c.ok ? `${c.price != null ? Math.round(c.price / 100) + " so'm" : "—"}` : c.error}
                </span>
                <span className="text-muted-foreground">{new Date(c.checkedAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
