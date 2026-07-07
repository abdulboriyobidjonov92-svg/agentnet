"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/api-client";
import { AgentForm } from "@/components/agents/agent-form";
import { AgentComposer } from "@/components/agents/agent-composer";
import { Fireworks } from "@/components/three/fireworks";
import { ArrowLeft, Boxes } from "lucide-react";
import Link from "next/link";
import { useT } from "@/lib/i18n/client";

const AgentMotif = dynamic(() => import("@/components/three/agent-motif"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-breathe rounded-full bg-primary/5 blur-2xl" />,
});

export default function NewAgentPage() {
  const router = useRouter();
  const api = useApiClient();
  const qc = useQueryClient();
  const { t } = useT();
  const [tools, setTools] = useState<string[]>([]);
  const [burst, setBurst] = useState(0);
  // Bir marta generatsiya qilinadi — tugma ikki marta bosilsa ham (yoki
  // tarmoq qayta urinishi) yaratish narxi IKKINCHI marta yechilmasligi uchun.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post<any>("/agents", { ...data, idempotencyKey }),
    onSuccess: (agent) => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      // Muvaffaqiyat fireworks, keyin agent sahifasiga o'tish
      setBurst((b) => b + 1);
      setTimeout(() => router.push(`/agents/${agent.id}`), 900);
    },
  });

  return (
    <div className="space-y-6">
      <Fireworks trigger={burst} />
      <div className="flex items-center gap-4">
        <Link href="/agents" className="rounded-xl border p-2.5 transition hover:bg-muted">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("form.createTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("form.createSub")}</p>
        </div>
      </div>

      {/* Y9: bir-klik agent — tabiiy til → tayyor agent taklifi + narx */}
      <AgentComposer />

      {/* Ajratgich — pastda qo'lda (no-code) sozlash imkoni saqlanadi */}
      <div className="flex items-center gap-4 py-1">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{t("compose.orManual")}</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        {/* Chap: no-code konfiguratsiya */}
        <AgentForm
          onSubmit={createMutation.mutateAsync}
          isLoading={createMutation.isPending}
          error={createMutation.error?.message}
          onToolsChange={setTools}
        />

        {/* O'ng: jonli 3D ko'rinish — sozlagani sari yig'iladi */}
        <div className="lg:sticky lg:top-6 lg:h-[calc(100vh-8rem)]">
          <div className="relative flex h-72 flex-col overflow-hidden rounded-2xl border border-white/10 glass-panel lg:h-full">
            <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3 text-sm font-semibold">
              <Boxes className="h-4 w-4 text-primary" /> {t("form.livePreview")}
            </div>
            <div className="relative flex-1">
              <AgentMotif tools={tools} className="!absolute !inset-0" />
              <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-background/50 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
                {tools.length > 0
                  ? t("form.previewTools").replace("{n}", String(tools.length))
                  : t("form.previewEmpty")}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
