"use client";
import { useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DataTable, type Column } from "@/components/admin/data-table";
import { useAdminList } from "@/components/admin/use-admin-list";
import { AdminPageHeader, useDebounced } from "@/components/admin/admin-ui";
import { useT } from "@/lib/i18n/client";

interface AdminAuditEntry {
  id: string;
  seq: number;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: { email: string; name: string | null } | null;
}

export default function AdminAuditPage() {
  const { t, locale } = useT();
  const [rawAction, setRawAction] = useState("");
  const [rawActor, setRawActor] = useState("");
  const action = useDebounced(rawAction, 350);
  const actorId = useDebounced(rawActor, 350);

  const list = useAdminList<AdminAuditEntry>(["admin", "audit"], "/admin/audit", {
    action,
    actorId,
  });

  const columns: Column<AdminAuditEntry>[] = [
    {
      id: "seq",
      header: "#",
      cell: (e) => <span className="nums text-xs tabular-nums text-muted-foreground">{e.seq}</span>,
    },
    {
      id: "action",
      header: t("admin.colAction"),
      cell: (e) => <code className="text-xs font-medium">{e.action}</code>,
    },
    {
      id: "actor",
      header: t("admin.colActor"),
      cell: (e) => (
        <span className="truncate text-xs text-muted-foreground">
          {e.actor?.email ?? e.actorId}
        </span>
      ),
    },
    {
      id: "resource",
      header: t("admin.colResource"),
      secondary: true,
      cell: (e) => (
        <div className="flex items-center gap-1.5">
          <Badge variant="outline">{e.resourceType}</Badge>
          {e.resourceId && (
            <code className="truncate text-[11px] text-muted-foreground">{e.resourceId}</code>
          )}
        </div>
      ),
    },
    {
      id: "when",
      header: t("admin.colWhen"),
      align: "right",
      cell: (e) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {new Date(e.createdAt).toLocaleString(locale)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title={t("admin.navAudit")}
        subtitle={t("admin.auditSubtitle")}
        total={list.total}
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={rawAction}
            onChange={(e) => setRawAction(e.target.value)}
            placeholder={t("admin.auditActionFilter")}
            aria-label={t("admin.auditActionFilter")}
            className="pl-9"
          />
        </div>
        <Input
          value={rawActor}
          onChange={(e) => setRawActor(e.target.value)}
          placeholder={t("admin.auditActorFilter")}
          aria-label={t("admin.auditActorFilter")}
          className="sm:max-w-[260px]"
        />
      </div>

      <DataTable
        columns={columns}
        rows={list.rows}
        rowKey={(e) => e.id}
        isLoading={list.isLoading}
        isError={list.isError}
        onRetry={() => list.refetch()}
        hasMore={list.hasNextPage}
        isLoadingMore={list.isFetchingNextPage}
        onLoadMore={() => list.fetchNextPage()}
        emptyText={t("admin.auditEmpty")}
      />
    </div>
  );
}
