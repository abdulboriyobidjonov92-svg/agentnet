"use client";
import { useT } from "@/lib/i18n/client";
import { ForecastCard } from "@/components/retail/forecast-card";
import { ReorderPlanCard } from "@/components/retail/reorder-plan-card";
import { ProductsCard } from "@/components/retail/products-card";
import { VisionSimulatorCard } from "@/components/retail/vision-simulator-card";
import { CameraCard } from "@/components/retail/camera-card";
import { NotificationSettingsCard } from "@/components/retail/notification-settings-card";
import { AlertsCard } from "@/components/retail/alerts-card";
import { CompetitorsCard } from "@/components/retail/competitors-card";

/**
 * S4: Retail Intelligence — kamera+inventar fuziyasi UI.
 * Kamera hodisasi simulyatori haqiqiy CV-webhook bilan bir xil endpointga uradi.
 */
export default function RetailPage() {
  const { t } = useT();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("retail.title")}</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">{t("retail.subtitle")}</p>
      </div>

      <ForecastCard />
      <ReorderPlanCard />

      <div className="grid gap-6 lg:grid-cols-2">
        <ProductsCard />
        <div className="space-y-6">
          <VisionSimulatorCard />
          <CameraCard />
          <NotificationSettingsCard />
        </div>
      </div>

      <AlertsCard />
      <CompetitorsCard />
    </div>
  );
}
