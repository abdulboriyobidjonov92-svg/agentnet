"use client";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/admin/data-table";
import { useAdminList } from "@/components/admin/use-admin-list";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

interface AdminFeedback {
  id: string;
  kind: string;
  status: "new" | "seen" | "resolved";
  message: string;
  page: string | null;
  locale: string | null;
  createdAt: string;
  user: { email: string; name: string | null } | null;
}

const STATUSES = ["new", "seen", "resolved"] as const;

const STATUS_VARIANT: Record<AdminFeedback["status"], "primary" | "warn" | "ok"> = {
  new: "primary",
  seen: "warn",
  resolved: "ok",
};

export default function AdminFeedbackPage() {
  const { t, locale } = useT();
  const [status, setStatus] = useState<string>("");

  const list = useAdminList<AdminFeedback>(["admin", "feedback"], "/admin/feedback", { status });

  const columns: Column<AdminFeedback>[] = [
    {
      id: "status",
      header: t("admin.colStatus"),
      cell: (f) => <Badge variant={STATUS_VARIANT[f.status]}>{f.status}</Badge>,
    },
    { id: "kind", header: t("admin.colKind"), cell: (f) => <Badge variant="outline">{f.kind}</Badge> },
    {
      id: "message",
      header: t("admin.colMessage"),
      cell: (f) => <p className="line-clamp-2 max-w-xl text-sm">{f.message}</p>,
    },
    {
      id: "from",
      header: t("admin.colFrom"),
      secondary: true,
      cell: (f) => (
        <span className="truncate text-xs text-muted-foreground">
          {f.user?.email ?? t("admin.anonymous")}
        </span>
      ),
    },
    {
      id: "when",
      header: t("admin.colWhen"),
      align: "right",
      secondary: true,
      cell: (f) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {new Date(f.createdAt).toLocaleDateString(locale)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title={t("admin.navFeedback")}
        subtitle={t("admin.feedbackSubtitle")}
        total={list.total}
      />

      {/* Holat filtri — segment tugmalar (kam variant, tez almashtirish) */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("admin.colStatus")}>
        {["", ...STATUSES].map((s) => (
          <button
            key={s || "all"}
            onClick={() => setStatus(s)}
            aria-pressed={status === s}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-vein-cyan",
              status === s
                ? "border-transparent bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {s === "" ? t("admin.allStatuses") : s}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={list.rows}
        rowKey={(f) => f.id}
        isLoading={list.isLoading}
        isError={list.isError}
        onRetry={() => list.refetch()}
        hasMore={list.hasNextPage}
        isLoadingMore={list.isFetchingNextPage}
        onLoadMore={() => list.fetchNextPage()}
        emptyText={t("admin.feedbackEmpty")}
      />
    </div>
  );
}
