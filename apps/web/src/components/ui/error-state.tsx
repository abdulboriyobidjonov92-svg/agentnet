"use client";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/**
 * Yagona xato holati — data-fetch muvaffaqiyatsiz bo'lganda.
 * Nima bo'lganini aytadi va qayta urinish imkonini beradi.
 */
export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  const { t } = useT();
  return (
    <div
      role="alert"
      className={cn(
        "rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center",
        className,
      )}
    >
      <AlertTriangle className="mx-auto h-6 w-6 text-destructive" />
      <p className="mt-3 text-sm font-semibold">{t("common.errorTitle")}</p>
      <p className="mt-1 text-xs text-muted-foreground">{message ?? t("common.error")}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-4">
          <RotateCcw /> {t("common.retry")}
        </Button>
      )}
    </div>
  );
}
