"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { Package, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { useRetailInvalidate } from "./use-retail-invalidate";

// Inventar
export function ProductsCard() {
  const api = useApiClient();
  const { t } = useT();
  const invalidate = useRetailInvalidate();

  const { data: products, isError: productsError, refetch: refetchProducts } = useQuery({
    queryKey: ["retail-products"],
    queryFn: () => api.get<any[]>("/retail/products"),
  });

  const seedMutation = useMutation({ mutationFn: () => api.post("/retail/seed-demo", {}), onSuccess: invalidate });
  const saleMutation = useMutation({
    mutationFn: (sku: string) => api.post("/retail/sales", { sku, qty: 1 }),
    onSuccess: invalidate,
  });

  return (
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
  );
}
