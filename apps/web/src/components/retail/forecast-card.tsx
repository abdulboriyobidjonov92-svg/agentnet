"use client";
import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { TrendingDown } from "lucide-react";
import { ShareButton } from "@/components/share/share-button";
import { URGENCY_STYLE, type ProductForecast } from "./retail-types";

// Bashorat: har tovar necha kunda tugaydi
export function ForecastCard() {
  const api = useApiClient();
  const { t, locale } = useT();
  const { data: forecast } = useQuery({
    queryKey: ["retail-forecast"],
    queryFn: () => api.get<{ products: ProductForecast[] }>("/retail/forecast"),
  });

  return (
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
  );
}
