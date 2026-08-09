"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DataTable, type Column } from "@/components/admin/data-table";
import { useAdminList } from "@/components/admin/use-admin-list";
import { AdminPageHeader, RoleBadge, useDebounced } from "@/components/admin/admin-ui";
import { formatSom } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { DangerousActionDialog, type DangerousKind } from "@/components/admin/dangerous-action-dialog";
import { ImpersonateDialog } from "@/components/admin/impersonate-dialog";
import { useApiClient } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";

type Role = "OWNER" | "ADMIN" | "SUPPORT" | "MEMBER" | "VIEWER";

interface AdminUser {
  id: string;
  email: string;
  phone: string | null;
  name: string | null;
  role: Role;
  plan: string;
  platformPlan: string;
  platformPlanFrozen: boolean;
  /** A13: pul API'dan SATR sifatida keladi. */
  balanceTiyin: string;
  twoFactorEnabled: boolean;
  blockedAt: string | null;
  blockedReason: string | null;
  createdAt: string;
}

const ROLES = ["OWNER", "ADMIN", "SUPPORT", "MEMBER", "VIEWER"] as const;

/**
 * SEC-12 §9 — rol ierarxiyasi (server `role-rank.ts` bilan bir xil tartib).
 *
 * BU XAVFSIZLIK CHORASI EMAS — server har so'rovda o'zi tekshiradi. Bu
 * faqat "bosib bo'lmaydigan tugmani ko'rsatmaslik" uchun: operator
 * qaytarilishi aniq bo'lgan amalni boshlamasin.
 */
const ROLE_RANK: Record<Role, number> = { OWNER: 0, ADMIN: 1, SUPPORT: 2, MEMBER: 3, VIEWER: 4 };
const IMPERSONATION_ROLES: Role[] = ["OWNER", "ADMIN", "SUPPORT"];
const WRITE_ACTION_ROLES: Role[] = ["OWNER", "ADMIN"];

const outranks = (actor: Role | undefined, target: Role) =>
  !!actor && ROLE_RANK[actor] < ROLE_RANK[target];

export default function AdminUsersPage() {
  const { t, locale } = useT();
  const api = useApiClient();
  const [role, setRole] = useState<string>("");
  const [rawQuery, setRawQuery] = useState("");
  // SEC-11: tanlangan xavfli amal (dialog server oqimini boshqaradi).
  const [danger, setDanger] = useState<
    { kind: DangerousKind; target: AdminUser; newRole?: string } | null
  >(null);
  // SEC-12: impersonation boshlash dialogi.
  const [impersonate, setImpersonate] = useState<AdminUser | null>(null);
  // Qidiruv har harfda so'rov yubormaydi.
  const q = useDebounced(rawQuery, 350);

  // Operatorning O'ZI: qaysi amallar ko'rsatilishini hal qilish uchun
  // (rol profil-cookie'da yo'q — u avtorizatsiya kaliti, serverdan olinadi).
  const me = useQuery({
    queryKey: ["me", "admin-actions"],
    queryFn: () => api.get<{ id: string; email: string; role: Role }>("/users/me"),
    staleTime: 5 * 60_000,
  });
  const myRole = me.data?.role;

  const [blocked, setBlocked] = useState<string>("");

  const list = useAdminList<AdminUser>(["admin", "users"], "/admin/users", { role, q, blocked });

  const columns: Column<AdminUser>[] = [
    {
      id: "user",
      header: t("admin.colUser"),
      cell: (u) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{u.name || u.email}</p>
          {u.name && <p className="truncate text-xs text-muted-foreground">{u.email}</p>}
        </div>
      ),
    },
    {
      id: "role",
      header: t("admin.colRole"),
      cell: (u) => (
        <div className="flex flex-wrap items-center gap-1">
          <RoleBadge role={u.role} />
          {u.blockedAt && (
            <Badge variant="danger" title={u.blockedReason ?? undefined}>
              {t("admin.blocked")}
            </Badge>
          )}
        </div>
      ),
    },
    {
      id: "plan",
      header: t("admin.colPlan"),
      secondary: true,
      cell: (u) => (
        <div className="flex flex-wrap items-center gap-1">
          <Badge variant="outline">{u.plan}</Badge>
          {u.platformPlan !== "none" && (
            <Badge variant={u.platformPlanFrozen ? "warn" : "primary"}>{u.platformPlan}</Badge>
          )}
        </div>
      ),
    },
    {
      id: "2fa",
      header: t("admin.col2fa"),
      secondary: true,
      cell: (u) =>
        u.twoFactorEnabled ? (
          <Badge variant="ok">{t("admin.on")}</Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      id: "balance",
      header: t("admin.colBalance"),
      align: "right",
      cell: (u) => <span className="nums tabular-nums">{formatSom(u.balanceTiyin)}</span>,
    },
    {
      id: "actions",
      header: t("admin.colActions"),
      align: "right",
      cell: (u) => {
        const isSelf = u.id === me.data?.id;
        // §9/§24: aktor nishondan QAT'IY yuqori bo'lishi shart, o'ziga —
        // hech qachon. Server ham AYNAN shu qoidani qo'llaydi.
        const canTouch = !isSelf && outranks(myRole, u.role);
        const canImpersonate =
          canTouch && !!myRole && IMPERSONATION_ROLES.includes(myRole) && !u.blockedAt;
        const canWrite = canTouch && !!myRole && WRITE_ACTION_ROLES.includes(myRole);

        return (
          <div className="flex flex-wrap justify-end gap-1.5">
            {/* Rol tanlash -> darhol tasdiqlash oqimi ochiladi (faqat OWNER) */}
            {myRole === "OWNER" && !isSelf && (
              <select
                value=""
                onChange={(e) =>
                  e.target.value &&
                  setDanger({ kind: "role_assign", target: u, newRole: e.target.value })
                }
                aria-label={t("admin.actionRole")}
                className="h-8 rounded-lg border bg-card px-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-vein-cyan"
              >
                <option value="">{t("admin.actionRole")}</option>
                {ROLES.filter((r) => r !== u.role).map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            )}

            {canImpersonate && (
              <Button
                variant="outline"
                className="h-8 gap-1 px-2 text-xs"
                onClick={() => setImpersonate(u)}
              >
                <Eye className="h-3.5 w-3.5" />
                {t("imp.action")}
              </Button>
            )}

            {canWrite && (
              <Button
                variant="outline"
                className="h-8 px-2 text-xs"
                onClick={() => setDanger({ kind: "credit_manual", target: u })}
              >
                {t("admin.actionCredit")}
              </Button>
            )}

            {canWrite && (
              <Button
                variant="destructive-ghost"
                className="h-8 px-2 text-xs"
                onClick={() =>
                  setDanger({ kind: u.blockedAt ? "user_unblock" : "user_block", target: u })
                }
              >
                {u.blockedAt ? t("admin.actionUnblock") : t("admin.actionBlock")}
              </Button>
            )}

            {myRole === "OWNER" && !isSelf && (
              <Button
                variant="destructive-ghost"
                className="h-8 px-2 text-xs"
                onClick={() => setDanger({ kind: "session_revoke", target: u })}
              >
                {t("admin.actionRevoke")}
              </Button>
            )}
          </div>
        );
      },
    },
    {
      id: "created",
      header: t("admin.colCreated"),
      align: "right",
      secondary: true,
      cell: (u) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {new Date(u.createdAt).toLocaleDateString(locale)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title={t("admin.navUsers")}
        subtitle={t("admin.usersSubtitle")}
        total={list.total}
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            placeholder={t("admin.usersSearch")}
            aria-label={t("admin.usersSearch")}
            className="pl-9"
          />
        </div>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          aria-label={t("admin.colRole")}
          className="h-10 rounded-xl border bg-card px-3 text-sm text-foreground outline-none transition focus-visible:ring-1 focus-visible:ring-vein-cyan"
        >
          <option value="">{t("admin.allRoles")}</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          value={blocked}
          onChange={(e) => setBlocked(e.target.value)}
          aria-label={t("admin.blockedFilter")}
          className="h-10 rounded-xl border bg-card px-3 text-sm text-foreground outline-none transition focus-visible:ring-1 focus-visible:ring-vein-cyan"
        >
          <option value="">{t("admin.blockedAll")}</option>
          <option value="1">{t("admin.blockedOnly")}</option>
          <option value="0">{t("admin.blockedNone")}</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        rows={list.rows}
        rowKey={(u) => u.id}
        isLoading={list.isLoading}
        isError={list.isError}
        onRetry={() => list.refetch()}
        hasMore={list.hasNextPage}
        isLoadingMore={list.isFetchingNextPage}
        onLoadMore={() => list.fetchNextPage()}
        emptyText={t("admin.usersEmpty")}
      />

      {danger && (
        <DangerousActionDialog
          kind={danger.kind}
          target={{ id: danger.target.id, email: danger.target.email }}
          newRole={danger.newRole}
          onClose={() => setDanger(null)}
        />
      )}

      {impersonate && (
        <ImpersonateDialog
          target={{ id: impersonate.id, email: impersonate.email, name: impersonate.name }}
          actorEmail={me.data?.email ?? ""}
          onClose={() => setImpersonate(null)}
        />
      )}
    </div>
  );
}
