export type CameraStatus = {
  camera_id: string;
  status: "connecting" | "running" | "error" | "stopped";
  detail?: string;
  events_sent?: number;
};

export const CAMERA_STATUS_STYLE: Record<CameraStatus["status"], string> = {
  connecting: "bg-amber-500/15 text-amber-500",
  running: "bg-emerald-500/15 text-emerald-500",
  error: "bg-destructive/15 text-destructive",
  stopped: "bg-secondary text-muted-foreground",
};

export type ProductForecast = {
  sku: string;
  name: string;
  stock: number;
  dailyVelocity: number;
  daysUntilStockout: number | null;
  stockoutDate: string | null;
  urgency: "critical" | "warning" | "ok" | "stale";
};

export const URGENCY_STYLE: Record<ProductForecast["urgency"], string> = {
  critical: "bg-destructive/15 text-destructive",
  warning: "bg-amber-500/15 text-amber-500",
  ok: "bg-emerald-500/15 text-emerald-500",
  stale: "bg-secondary text-muted-foreground",
};
