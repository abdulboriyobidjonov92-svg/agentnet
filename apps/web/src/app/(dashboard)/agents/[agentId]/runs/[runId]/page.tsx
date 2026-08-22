"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useApiClient } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { StateBadge, type RunState } from "@/components/ui/status";
import { StepCard, type ExecutionEvent } from "@/components/chat/step-card";

/**
 * UI-4 — "Agent nima qildi?" (to'liq ijro izi).
 *
 * Chatdagi qadam-kartalari faqat foydalanuvchi uchun ma'noli hodisalarni
 * ko'rsatadi; bu sahifada BUTUN zanjir bor (`MODEL_*`, `RUN_*` ham) —
 * chunki bu yerda savol boshqa: "aynan nima bo'ldi va nima qancha vaqt oldi?".
 *
 * Contract A39 (feature freeze) buzilmaydi: bu yangi VERTIKAL emas, mavjud
 * agent sahifasining qatlami (MASTER_ROADMAP §11 `Observe` bosqichi).
 */

interface RunDetail {
  id: string;
  agentId: string;
  status: "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  startedAt: string;
  endedAt: string | null;
  stepCount: number;
  totalCostTiyin: string;
  events: ExecutionEvent[];
}

/** Backend holati → UI-1 holat tokeni. */
const STATE: Record<RunDetail["status"], RunState> = {
  RUNNING: "running",
  COMPLETED: "success",
  FAILED: "failed",
  CANCELLED: "cancelled",
};

export default function RunTracePage({
  params,
}: {
  params: Promise<{ agentId: string; runId: string }>;
}) {
  const { agentId, runId } = use(params);
  const api = useApiClient();
  const { t } = useT();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["run", runId],
    queryFn: () => api.get<RunDetail>(`/runs/${runId}`),
    // Ijro hali ketayotgan bo'lsa yangilanib turadi; tugagach to'xtaydi.
    refetchInterval: (q) => (q.state.data?.status === "RUNNING" ? 2_000 : false),
  });

  const durationMs =
    data?.endedAt && data?.startedAt
      ? new Date(data.endedAt).getTime() - new Date(data.startedAt).getTime()
      : null;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon-sm" aria-label={t("common.back")}>
          <Link href={`/agents/${agentId}`}>
            <ArrowLeft />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{t("trace.title")}</h1>
          <p className="truncate font-mono text-xs text-muted-foreground">{runId}</p>
        </div>
      </div>

      {isLoading && <div className="h-64 animate-pulse rounded-2xl border" />}
      {isError && <ErrorState onRetry={() => refetch()} />}

      {data && (
        <>
          {/* Yakun: holat · davomiylik · qadam soni · narx */}
          <div className="grid gap-3 rounded-2xl border bg-card p-5 sm:grid-cols-4">
            <Metric label={t("trace.status")}>
              <StateBadge state={STATE[data.status]} label={t(`state.${STATE[data.status]}`)} />
            </Metric>
            <Metric label={t("trace.duration")}>
              <span className="nums">{durationMs != null ? `${(durationMs / 1000).toFixed(2)}s` : "—"}</span>
            </Metric>
            <Metric label={t("trace.steps")}>
              <span className="nums">{data.stepCount}</span>
            </Metric>
            <Metric label={t("trace.cost")}>
              {/* Tiyin → so'm. BigInt satr sifatida keladi (JSON-xavfsiz). */}
              <span className="nums">
                {(Number(data.totalCostTiyin) / 100).toLocaleString()} {t("trace.som")}
              </span>
            </Metric>
          </div>

          {/* To'liq zanjir */}
          {data.events.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              {t("trace.empty")}
            </div>
          ) : (
            <ol className="space-y-2">
              {data.events.map((e) => (
                <li key={e.id} className="flex items-start gap-3">
                  <span className="nums mt-2 w-6 shrink-0 text-right text-xs text-muted-foreground">
                    {e.seq}
                  </span>
                  <span className="min-w-0 flex-1">
                    <StepCard event={e} />
                  </span>
                </li>
              ))}
            </ol>
          )}

          {/* `seq` teshigi — UI TAXMIN QILMAYDI, ochiq aytadi. */}
          {hasGap(data.events) && (
            <p className="rounded-xl border border-warn/30 bg-warn/10 p-3 text-xs">
              {t("trace.gapWarning")}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Metric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="label-mono mb-1.5">{label}</p>
      {children}
    </div>
  );
}

/** `seq` uzluksizmi — yozilmagan hodisa bo'lsa foydalanuvchi bilishi kerak. */
function hasGap(events: ExecutionEvent[]): boolean {
  for (let i = 1; i < events.length; i++) {
    if (events[i].seq !== events[i - 1].seq + 1) return true;
  }
  return false;
}
