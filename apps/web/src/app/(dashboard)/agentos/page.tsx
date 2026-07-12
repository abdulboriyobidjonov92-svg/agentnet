"use client";
import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/api-client";
import { Loader2 } from "lucide-react";
import { ErrorState } from "@/components/ui/error-state";
import { WorkspaceSetup } from "@/components/agentos/workspace-setup";
import { CommandCenter } from "@/components/agentos/command-center";

export default function AgentOsPage() {
  const api = useApiClient();

  const { data: workspace, isLoading, isError: wsError, refetch: refetchWs } = useQuery({
    queryKey: ["agentos-workspace"],
    queryFn: () => api.get<any>("/agentos/workspace"),
  });
  const { data: history } = useQuery({
    queryKey: ["agentos-history"],
    queryFn: () => api.get<any[]>("/agentos/history"),
    enabled: !!workspace,
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (wsError) {
    return <ErrorState onRetry={() => refetchWs()} className="mx-auto max-w-xl" />;
  }

  // ---- Ish maydoni yo'q: setup ekрани ----
  if (!workspace) {
    return <WorkspaceSetup />;
  }

  // ---- Ish maydoni bor: buyruq markazi (command center) ----
  return <CommandCenter workspace={workspace} history={history} />;
}
