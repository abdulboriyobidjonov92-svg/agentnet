"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { Camera, ShoppingCart, Package, BellRing, Loader2, Send, AlertTriangle, TrendingDown, Check, X, Store, Video, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/error-state";
import { ShareButton } from "@/components/share/share-button";

type CameraStatus = {
  camera_id: string;
  status: "connecting" | "running" | "error" | "stopped";
  detail?: string;
  events_sent?: number;
};

const CAMERA_STATUS_STYLE: Record<CameraStatus["status"], string> = {
  connecting: "bg-amber-500/15 text-amber-500",
  running: "bg-emerald-500/15 text-emerald-500",
  error: "bg-destructive/15 text-destructive",
  stopped: "bg-secondary text-muted-foreground",
};

type ProductForecast = {
  sku: string;
  name: string;
  stock: number;
  dailyVelocity: number;
  daysUntilStockout: number | null;
  stockoutDate: string | null;
  urgency: "critical" | "warning" | "ok" | "stale";
};

const URGENCY_STYLE: Record<ProductForecast["urgency"], string> = {
  critical: "bg-destructive/15 text-destructive",
  warning: "bg-amber-500/15 text-amber-500",
  ok: "bg-emerald-500/15 text-emerald-500",
  stale: "bg-secondary text-muted-foreground",
};

/**
 * S4: Retail Intelligence — kamera+inventar fuziyasi UI.
 * Kamera hodisasi simulyatori haqiqiy CV-webhook bilan bir xil endpointga uradi.
 */
export default function RetailPage() {
  const api = useApiClient();
  const qc = useQueryClient();
  const { t, locale } = useT();
  const [visionType, setVisionType] = useState("shelf_empty");
  const [visionSku, setVisionSku] = useState("");
  const [cameraId, setCameraId] = useState("cam-1");
  const [rtspUrl, setRtspUrl] = useState("");
  const [channel, setChannel] = useState("telegram");
  const [target, setTarget] = useState("");
  const [compSku, setCompSku] = useState("");
  const [compName, setCompName] = useState("");
  const [compUrl, setCompUrl] = useState("");
  const [compPrice, setCompPrice] = useState("");

  const { data: products, isError: productsError, refetch: refetchProducts } = useQuery({ queryKey: ["retail-products"], queryFn: () => api.get<any[]>("/retail/products") });
  const { data: alerts } = useQuery({ queryKey: ["retail-alerts"], queryFn: () => api.get<any[]>("/retail/alerts"), refetchInterval: 5000 });
  const { data: settings } = useQuery({ queryKey: ["retail-settings"], queryFn: () => api.get<any>("/retail/settings") });
  const { data: forecast } = useQuery({ queryKey: ["retail-forecast"], queryFn: () => api.get<{ products: ProductForecast[] }>("/retail/forecast") });
  const { data: reorderPlan, refetch: refetchReorderPlan } = useQuery({ queryKey: ["retail-reorder-plan"], queryFn: () => api.get<{ drafts: any[] }>("/retail/reorder-plan") });
  const { data: compSources } = useQuery({ queryKey: ["retail-competitors"], queryFn: () => api.get<any[]>("/retail/competitors") });
  const { data: compChecks } = useQuery({ queryKey: ["retail-competitor-checks"], queryFn: () => api.get<any[]>("/retail/competitors/checks") });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["retail-products"] });
    qc.invalidateQueries({ queryKey: ["retail-alerts"] });
    qc.invalidateQueries({ queryKey: ["retail-forecast"] });
    qc.invalidateQueries({ queryKey: ["retail-reorder-plan"] });
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

  const { data: cameraStatus, refetch: refetchCameraStatus } = useQuery({
    queryKey: ["retail-camera-status", cameraId],
    queryFn: () => api.get<{ cameras: CameraStatus[] }>(`/retail/camera/status`),
    refetchInterval: 3000,
  });
  const activeCamera = cameraStatus?.cameras?.find((c) => c.camera_id === cameraId);
  const connectCameraMutation = useMutation({
    mutationFn: () => api.post("/retail/camera/connect", { cameraId, rtspUrl }),
    onSuccess: () => refetchCameraStatus(),
  });
  const disconnectCameraMutation = useMutation({
    mutationFn: () => api.post("/retail/camera/disconnect", { cameraId }),
    onSuccess: () => refetchCameraStatus(),
  });
  const settingsMutation = useMutation({
    mutationFn: () => api.patch("/retail/settings", { channel, target, autoNotify: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["retail-settings"] }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/retail/reorder-plan/${id}/confirm`, {}),
    onSuccess: () => refetchReorderPlan(),
  });
  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.post(`/retail/reorder-plan/${id}/cancel`, {}),
    onSuccess: () => refetchReorderPlan(),
  });

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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("retail.title")}</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">{t("retail.subtitle")}</p>
      </div>

      {/* Bashorat: har tovar necha kunda tugaydi */}
      <div className="rounded-2xl border bg-card p-5 shadow-soft">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="inline-flex items-center gap-2 font-semibold"><TrendingDown className="h-4 w-4 text-primary" /> {t("retail.forecast")}</h2>
          {forecast?.products?.length ? (
            <ShareButton
              variant="ghost"
              payload={{
                kind: "retail_forecast",
                title: t("retail.share.title"),
                subtitle: new Date().toLocaleDateString(locale === "uz" ? "uz-UZ" : locale === "ru" ? "ru-RU" : "en-US"),
                metrics: [
                  { label: t("retail.share.tracked"), value: String(forecast.products.length) },
                  { label: t("retail.forecast.status.critical"), value: String(forecast.products.filter((f) => f.urgency === "critical").length) },
                  { label: t("retail.forecast.status.warning"), value: String(forecast.products.filter((f) => f.urgency === "warning").length) },
                  { label: t("retail.forecast.status.ok"), value: String(forecast.products.filter((f) => f.urgency === "ok").length) },
                ],
              }}
            />
          ) : null}
        </div>
        {!forecast?.products?.length ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("retail.forecast.empty")}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {forecast.products.map((f) => (
              <div key={f.sku} className="rounded-xl border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{f.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{f.sku}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${URGENCY_STYLE[f.urgency]}`}>
                    {t(`retail.forecast.status.${f.urgency}`)}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("retail.forecast.stock")}: <span className="font-semibold text-foreground">{f.stock}</span></span>
                  <span className="text-muted-foreground">
                    {t("retail.forecast.days")}: <span className="font-semibold text-foreground">{f.daysUntilStockout ?? "—"}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Avtonom buyurtma qoralamalari — egasi tasdiqlamaguncha yuborilmaydi */}
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
                        className="hit-target rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition hover:bg-primary/20 disabled:opacity-40"
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

          {/* Haqiqiy IP-kamera — simulyatordan aniq ajratilgan, alohida bo'lim */}
          <div className="rounded-2xl border border-primary/30 bg-card p-5 shadow-soft">
            <h2 className="mb-1 inline-flex items-center gap-2 font-semibold"><Video className="h-4 w-4 text-primary" /> {t("retail.camera.real")}</h2>
            <p className="mb-3 text-xs text-muted-foreground">{t("retail.camera.beta")}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                value={cameraId}
                onChange={(e) => setCameraId(e.target.value)}
                placeholder={t("retail.camera.id")}
                className="sm:w-32"
              />
              <Input
                value={rtspUrl}
                onChange={(e) => setRtspUrl(e.target.value)}
                placeholder={`${t("retail.camera.rtspUrl")} (rtsp://192.168.1.x:554/stream)`}
                className="flex-1"
              />
              {activeCamera?.status === "running" || activeCamera?.status === "connecting" ? (
                <Button
                  variant="outline"
                  onClick={() => disconnectCameraMutation.mutate()}
                  disabled={disconnectCameraMutation.isPending}
                >
                  {disconnectCameraMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="mr-1 h-3.5 w-3.5" />}
                  {t("retail.camera.disconnect")}
                </Button>
              ) : (
                <Button
                  onClick={() => connectCameraMutation.mutate()}
                  disabled={connectCameraMutation.isPending || !cameraId || !rtspUrl}
                >
                  {connectCameraMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="mr-1 h-3.5 w-3.5" />}
                  {t("retail.camera.connect")}
                </Button>
              )}
            </div>
            {activeCamera && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CAMERA_STATUS_STYLE[activeCamera.status]}`}>
                  {t(`retail.camera.status.${activeCamera.status}`)}
                </span>
                {activeCamera.status === "running" && (
                  <span className="text-xs text-muted-foreground">
                    {activeCamera.events_sent ?? 0} {t("retail.camera.eventsSent")}
                  </span>
                )}
                {activeCamera.status === "error" && activeCamera.detail && (
                  <span className="text-xs text-destructive">{activeCamera.detail}</span>
                )}
              </div>
            )}
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

      {/* Raqobatchi narx monitoringi — kunlik cron + qo'lda tekshirish */}
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
    </div>
  );
}
