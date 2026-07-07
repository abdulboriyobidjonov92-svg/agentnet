"use client";
import { use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useApiClient } from "@/lib/api-client";
import { AgentForm } from "@/components/agents/agent-form";
import { ArrowLeft, Globe, EyeOff } from "lucide-react";
import Link from "next/link";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";

export default function AgentSettingsPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = use(params);
  const router = useRouter();
  const api = useApiClient();
  const qc = useQueryClient();
  const { t } = useT();

  const { data: agent, isLoading } = useQuery({
    queryKey: ["agent", agentId],
    queryFn: () => api.get<any>(`/agents/${agentId}`),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.patch<any>(`/agents/${agentId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent", agentId] });
      router.push(`/agents/${agentId}`);
    },
  });

  // Shablonga aylantirish — narx YUBORILMAYDI: backend agentning o'zining
  // allaqachon to'langan creation/monthly narxini saqlab qoladi (Y4).
  const publishMutation = useMutation({
    mutationFn: () => api.post<any>(`/marketplace/${agentId}/publish`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agent", agentId] }),
  });

  const unpublishMutation = useMutation({
    mutationFn: () => api.delete(`/marketplace/${agentId}/publish`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agent", agentId] }),
  });

  if (isLoading) return <div className="h-96 animate-pulse rounded-2xl border" />;

  return (
    <div className="max-w-2xl space-y-8">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon-sm" aria-label={t("common.back")}>
          <Link href={`/agents/${agentId}`}>
            <ArrowLeft />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("form.editTitle")}</h1>
          <p className="text-sm text-muted-foreground">{agent?.name}</p>
        </div>
      </div>

      {agent && (
        <AgentForm
          defaultValues={agent}
          onSubmit={updateMutation.mutateAsync}
          isLoading={updateMutation.isPending}
          submitLabel={t("form.save")}
        />
      )}

      <div className="rounded-2xl border bg-card p-6 shadow-soft">
        <h2 className="mb-1 font-semibold">{t("nav.marketplace")}</h2>
        <p className="mb-4 text-sm text-muted-foreground">{t("market.convertToTemplateDesc")}</p>
        {agent?.isPublished ? (
          <Button variant="outline" onClick={() => unpublishMutation.mutate()} disabled={unpublishMutation.isPending}>
            <EyeOff /> {t("market.installed")} ✓
          </Button>
        ) : (
          <Button onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending}>
            <Globe /> {t("market.convertToTemplate")}
          </Button>
        )}
      </div>
    </div>
  );
}
