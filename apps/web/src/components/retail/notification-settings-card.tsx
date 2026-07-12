"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function NotificationSettingsCard() {
  const api = useApiClient();
  const qc = useQueryClient();
  const { t } = useT();
  const [channel, setChannel] = useState("telegram");
  const [target, setTarget] = useState("");

  const { data: settings } = useQuery({ queryKey: ["retail-settings"], queryFn: () => api.get<any>("/retail/settings") });

  const settingsMutation = useMutation({
    mutationFn: () => api.patch("/retail/settings", { channel, target, autoNotify: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["retail-settings"] }),
  });

  return (
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
  );
}
