"use client";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/api-client";
import { ChatInterface } from "@/components/chat/chat-interface";
import { ArrowLeft, Bot, Settings, ShieldCheck } from "lucide-react";
import Link from "next/link";

export default function AgentChatPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = use(params);
  const api = useApiClient();

  const { data: agent, isLoading } = useQuery({
    queryKey: ["agent", agentId],
    queryFn: () => api.get<any>(`/agents/${agentId}`),
  });

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (!agent) return <div className="py-12 text-center text-muted-foreground">404</div>;

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/agents" className="rounded-xl border p-2.5 transition hover:bg-muted">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-semibold leading-tight">{agent.name}</h1>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{agent.model}</span>
              {agent.halalFilterEnabled && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                  <ShieldCheck className="h-3 w-3" /> Halal
                </span>
              )}
            </div>
          </div>
        </div>
        <Link href={`/agents/${agentId}/settings`} className="rounded-xl border p-2.5 transition hover:bg-muted">
          <Settings className="h-4 w-4 text-muted-foreground" />
        </Link>
      </div>

      <div className="min-h-0 flex-1">
        <ChatInterface agentId={agentId} agentDefinition={agent} />
      </div>
    </div>
  );
}
