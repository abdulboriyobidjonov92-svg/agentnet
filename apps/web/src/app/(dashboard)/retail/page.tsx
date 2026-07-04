"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { Camera, ShoppingCart, Package, BellRing, Loader2, Send, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/error-state";

/**
 * S4: Retail Intelligence — kamera+inventar fuziyasi UI.
 * Kamera hodisasi simulyatori haqiqiy CV-webhook bilan bir xil endpointga uradi.
 */
export default function RetailPage() {
  const api = useApiClient();
  const qc = useQueryClient();
  const { t } = useT();
  const [saleSku, setSaleSku] = useState("");
  const [visionType, setVisionType] = useState("shelf_empty");
  const [visionSku, setVisionSku] = useState("");
  const [channel, setChannel] = useState("telegram");
  const [target, setTarget] = useState("");

  const { data: products, isError: productsError, refetch: refetchProducts } = useQuery({ queryKey: ["retail-products"], queryFn: () => api.get<any[]>("/retail/products") });
  const { data: alerts } = useQuery({ queryKey: ["retail-alerts"], queryFn: () => api.get<any[]>("/retail/alerts"), refetchInterval: 5000 });
  const { data: settings } = useQuery({ queryKey: ["retail-settings"], queryFn: () => api.get<any>("/retail/settings") });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["retail-products"] });
    qc.invalidateQueries({ queryKey: ["retail-alerts"] });
  };

  const seedMutation = useMutation({ mutationFn: () => api.post("/retail/seed-demo", {}), onSuccess: invalidate });
  const saleMutation = useMutation({
    mutationFn: (sku: string) => api.post("/retail/sales", { sku, qty: 1 }),
    onSuccess: invalidate,
  });
  const visionMutation = useMutation({
    mutationFn: () => api.post("/retail/vision-events", { type: visionType, sku: visionSku || undefined, camera: "cam-1", confidence: 0.9 }),
    onSuccess: invalidate,
  });
  const settingsMutation = useMutation({
    mutationFn: () => api.patch("/retail/settings", { channel, target, autoNotify: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["retail-settings"] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("retail.title")}</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">{t("retail.subtitle")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Inventar */}
        <div className="rounded-2xl border bg-card p-5 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="inline-flex items-center gap-2 font-semibold"><Package className="h-4 w-4 text-primary" /> {t("retail.products")}</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
            >
              {seedMutation.isPending ? "…" : t("retail.seed")}
            </Button>
          </div>
          {productsError ? (
            <ErrorState onRetry={() => refetchProducts()} />
          ) : !products?.length ? (
            <p className="py-6 text-center text-sm text-muted-foreground">—</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="py-2 font-medium">{p.name}</td>
                    <td className="py-2 font-mono text-xs text-muted-foreground">{p.sku}</td>
                    <td className={`py-2 text-right font-semibold ${p.stock <= p.reorderLevel ? "text-amber-500" : ""} ${p.stock === 0 ? "text-destructive" : ""}`}>
                      {p.stock} dona
                    </td>
                    <td className="py-2 pl-3 text-right">
                      <button
                        onClick={() => saleMutation.mutate(p.sku)}
                        disabled={saleMutation.isPending || p.stock === 0}
                        title={t("retail.sale")}
                        aria-label={t("retail.sale")}
                        className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition hover:bg-primary/20 disabled:opacity-40"
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Kamera hodisasi + kanal sozlamasi */}
        <div className="space-y-6">
          <div className="rounded-2xl border bg-card p-5 shadow-soft">
            <h2 className="mb-3 inline-flex items-center gap-2 font-semibold"><Camera className="h-4 w-4 text-primary" /> {t("retail.vision")}</h2>
            <div className="flex flex-col gap-3 sm:flex-row">
              <select value={visionType} onChange={(e) => setVisionType(e.target.value)} className="rounded-xl border bg-background px-3 py-2 text-sm outline-none">
                <option value="shelf_empty">shelf_empty (javon bo'sh)</option>
                <option value="item_pickup">item_pickup (tovar olindi)</option>
                <option value="shelf_restocked">shelf_restocked (to'ldirildi)</option>
                <option value="person_loitering">person_loitering</option>
              </select>
              <select value={visionSku} onChange={(e) => setVisionSku(e.target.value)} className="flex-1 rounded-xl border bg-background px-3 py-2 text-sm outline-none">
                <option value="">SKU tanlang…</option>
                {products?.map((p) => <option key={p.sku} value={p.sku}>{p.sku} — {p.name}</option>)}
              </select>
              <Button
                size="icon"
                onClick={() => visionMutation.mutate()}
                disabled={visionMutation.isPending}
                aria-label={t("retail.vision")}
              >
                {visionMutation.isPending ? <Loader2 className="animate-spin" /> : <Send />}
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Haqiqiy CV servis xuddi shu webhook'ka uradi: <code className="rounded bg-muted px-1">POST /api/retail/vision-events</code>
            </p>
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-soft">
            <h2 className="mb-3 font-semibold">{t("retail.settings")}</h2>
            <div className="flex flex-col gap-3 sm:flex-row">
              <select value={channel} onChange={(e) => setChannel(e.target.value)} className="rounded-xl border bg-background px-3 py-2 text-sm outline-none">
                <option value="telegram">Telegram</option>
                <option value="sms">SMS (Eskiz)</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
              </select>
              <Input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder={settings?.target ?? "chat_id / telefon / email"}
                className="flex-1"
              />
              <Button variant="outline" onClick={() => settingsMutation.mutate()}>
                OK
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Alertlar */}
      <div className="rounded-2xl border bg-card p-5 shadow-soft">
        <h2 className="mb-3 inline-flex items-center gap-2 font-semibold"><BellRing className="h-4 w-4 text-primary" /> {t("retail.alerts")}</h2>
        {!alerts?.length ? (
          <p className="py-6 text-center text-sm text-muted-foreground">—</p>
        ) : (
          <div className="space-y-3">
            {alerts.map((a) => (
              <div key={a.id} className="flex items-start gap-3 rounded-xl border p-3">
                <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${a.severity === "critical" ? "text-destructive" : a.severity === "warning" ? "text-amber-500" : "text-primary"}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{a.title}</span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{a.kind}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${a.delivery === "sent" ? "bg-emerald-500/15 text-emerald-500" : "bg-secondary text-muted-foreground"}`}>
                      {a.channel}: {a.delivery}
                    </span>
                    {a.method && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs opacity-60">{a.method}</span>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{a.body}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
