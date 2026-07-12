"use client";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { Loader2, Unplug, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CAMERA_STATUS_STYLE, type CameraStatus } from "./retail-types";

// Haqiqiy IP-kamera — simulyatordan aniq ajratilgan, alohida bo'lim
export function CameraCard() {
  const api = useApiClient();
  const { t } = useT();
  const [cameraId, setCameraId] = useState("cam-1");
  const [rtspUrl, setRtspUrl] = useState("");

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

  return (
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
  );
}
