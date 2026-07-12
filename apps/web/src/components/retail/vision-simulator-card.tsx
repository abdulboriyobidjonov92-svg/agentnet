"use client";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { Camera, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRetailInvalidate } from "./use-retail-invalidate";

// Kamera hodisasi simulyatori — haqiqiy CV-webhook bilan bir xil endpointga uradi
export function VisionSimulatorCard() {
  const api = useApiClient();
  const { t } = useT();
  const invalidate = useRetailInvalidate();
  const [visionType, setVisionType] = useState("shelf_empty");
  const [visionSku, setVisionSku] = useState("");

  const { data: products } = useQuery({ queryKey: ["retail-products"], queryFn: () => api.get<any[]>("/retail/products") });

  const visionMutation = useMutation({
    mutationFn: () => api.post("/retail/vision-events", { type: visionType, sku: visionSku || undefined, camera: "cam-1", confidence: 0.9 }),
    onSuccess: invalidate,
  });

  return (
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
  );
}
