"use client";
import { useApiClient } from "@/lib/api-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";
import { ErrorState } from "@/components/ui/error-state";

// Admin (OWNER) — foydalanuvchi fikrlari ro'yxati + holat boshqaruvi
interface FeedbackItem {
  id: string;
  kind: string;
  message: string;
  page?: string | null;
  locale?: string | null;
  status: string;
  createdAt: string;
  user?: { email?: string; name?: string } | null;
}

export function AdminFeedbackTab() {
  const { t } = useT();
  const api = useApiClient();
  const queryClient = useQueryClient();
  const { data, isError, refetch } = useQuery({
    queryKey: ["admin-feedback"],
    queryFn: () => api.get<FeedbackItem[]>("/feedback"),
  });

  const setStatus = async (id: string, status: string) => {
    await api.patch(`/feedback/${id}/status`, { status });
    queryClient.invalidateQueries({ queryKey: ["admin-feedback"] });
  };

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (!data) return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  if (data.length === 0)
    return <p className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground shadow-soft">{t("admin.fb.empty")}</p>;

  const KIND_LABEL: Record<string, string> = {
    suggestion: t("help.fb.kind.suggestion"),
    bug: t("help.fb.kind.bug"),
    question: t("help.fb.kind.question"),
  };

  return (
    <div className="space-y-3">
      {data.map((f) => (
        <div key={f.id} className="rounded-2xl border bg-card p-4 shadow-soft">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-md bg-primary/10 px-2 py-0.5 font-medium text-primary">
              {KIND_LABEL[f.kind] ?? f.kind}
            </span>
            <span className="text-muted-foreground">{f.user?.email ?? "—"}</span>
            {f.page && <span className="font-mono text-muted-foreground/70">{f.page}</span>}
            <span className="ml-auto text-muted-foreground/60">{new Date(f.createdAt).toLocaleString()}</span>
          </div>
          <p className="whitespace-pre-wrap text-sm">{f.message}</p>
          <div className="mt-3 flex items-center gap-2">
            {["new", "seen", "resolved"].map((s) => (
              <button
                key={s}
                onClick={() => setStatus(f.id, s)}
                className={cn(
                  "rounded-md border px-2 py-0.5 text-xs transition",
                  f.status === s ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`admin.fb.status.${s}`)}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
