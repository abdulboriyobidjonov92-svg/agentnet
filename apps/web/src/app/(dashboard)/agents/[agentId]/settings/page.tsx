"use client";
import { use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useApiClient } from "@/lib/api-client";
import { AgentForm } from "@/components/agents/agent-form";
import { ArrowLeft, Globe, EyeOff } from "lucide-react";
import Link from "next/link";
import { useT } from "@/lib/i18n/client";

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

  const publishMutation = useMutation({
    mutationFn: () => api.post<any>(`/marketplace/${agentId}/publish`, { price: 0 }),
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
        <Link href={`/agents/${agentId}`} className="rounded-xl border p-2.5 transition hover:bg-muted">
          <ArrowLeft className="h-4 w-4" />
        </Link>
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
        <p className="mb-4 text-sm text-muted-foreground">{t("market.subtitle")}</p>
        {agent?.isPublished ? (
          <button onClick={() => unpublishMutation.mutate()} disabled={unpublishMutation.isPending} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition hover:bg-muted">
            <EyeOff className="h-4 w-4" /> {t("market.installed")} ✓
          </button>
        ) : (
          <button onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition hover:brightness-110">
            <Globe className="h-4 w-4" /> {t("market.builtin")}
          </button>
        )}
      </div>
    </div>
  );
}
