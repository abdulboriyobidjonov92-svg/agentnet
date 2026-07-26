"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, Pencil } from "lucide-react";
import { useApiClient, apiErrorMessage } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";

interface Category {
  id: string;
  name: string;
}

interface AdminAgent {
  id: string;
  name: string;
  description?: string | null;
  isPublished: boolean;
  verified: boolean;
  frozen: boolean;
  halalFilterEnabled: boolean;
  marketplacePrice: number | null;
  installCount: number;
  categoryId?: string | null;
  category?: { id: string; name: string } | null;
  user: { id: string; email: string; name?: string | null };
}

function ToggleBadge({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-2 py-0.5 text-[11px] font-medium transition",
        active ? "border-ok/40 bg-ok/10 text-ok" : "border-muted-foreground/20 text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

export default function AdminAgentsPage() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const { t } = useT();

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<AdminAgent | null>(null);
  const [form, setForm] = useState({ marketplacePrice: "0", categoryId: "" });
  const [pendingDelete, setPendingDelete] = useState<AdminAgent | null>(null);

  const { data: categories } = useQuery({
    queryKey: ["admin-categories", "agent"],
    queryFn: () => api.get<Category[]>("/admin/categories?type=agent"),
  });

  const { data, isError, isLoading, refetch } = useQuery({
    queryKey: ["admin-agents", search],
    queryFn: () => api.get<AdminAgent[]>(`/admin/agents${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-agents"] });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Record<string, unknown> }) => api.patch(`/admin/agents/${id}`, dto),
    onSuccess: () => invalidate(),
    onError: (e) => toast({ title: apiErrorMessage(e, t), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/agents/${id}`),
    onSuccess: () => { invalidate(); setPendingDelete(null); toast({ title: t("common.delete") }); },
    onError: (e) => toast({ title: apiErrorMessage(e, t), variant: "destructive" }),
  });

  const toggle = (agent: AdminAgent, field: "isPublished" | "verified" | "frozen" | "halalFilterEnabled") =>
    updateMutation.mutate({ id: agent.id, dto: { [field]: !agent[field] } });

  const openEdit = (a: AdminAgent) => {
    setEditing(a);
    setForm({ marketplacePrice: String(Math.round((a.marketplacePrice ?? 0) / 100)), categoryId: a.categoryId ?? "" });
  };

  const saveEdit = () => {
    if (!editing) return;
    updateMutation.mutate({
      id: editing.id,
      dto: { marketplacePrice: Math.round((Number(form.marketplacePrice) || 0) * 100), categoryId: form.categoryId || null },
    });
    setEditing(null);
  };

  if (isError) return <ErrorState onRetry={() => refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t("admin.agents.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("admin.agents.subtitle")}</p>
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("admin.agents.searchPlaceholder")}
          className="w-64"
        />
      </div>

      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : data.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">{t("admin.agents.empty")}</Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="p-3">{t("admin.products.name")}</th>
                <th className="p-3">{t("admin.agents.owner")}</th>
                <th className="p-3">{t("admin.agents.category")}</th>
                <th className="p-3 text-right">{t("admin.agents.price")}</th>
                <th className="p-3 text-right">{t("admin.agents.installs")}</th>
                <th className="p-3">{t("admin.agents.published")}</th>
                <th className="p-3">{t("admin.agents.verified")}</th>
                <th className="p-3">{t("admin.agents.frozen")}</th>
                <th className="p-3">{t("admin.agents.halal")}</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {data.map((a) => (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="p-3 font-medium">{a.name}</td>
                  <td className="p-3 text-xs text-muted-foreground">{a.user.email}</td>
                  <td className="p-3 text-muted-foreground">{a.category?.name ?? "—"}</td>
                  <td className="p-3 text-right tabular-nums">
                    {a.marketplacePrice ? Math.round(a.marketplacePrice / 100).toLocaleString("ru-RU") : "—"}
                  </td>
                  <td className="p-3 text-right tabular-nums">{a.installCount}</td>
                  <td className="p-3"><ToggleBadge active={a.isPublished} onClick={() => toggle(a, "isPublished")} label={t("admin.agents.published")} /></td>
                  <td className="p-3"><ToggleBadge active={a.verified} onClick={() => toggle(a, "verified")} label={t("admin.agents.verified")} /></td>
                  <td className="p-3">
                    <button
                      onClick={() => toggle(a, "frozen")}
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[11px] font-medium transition",
                        a.frozen ? "border-danger/40 bg-danger/10 text-danger" : "border-muted-foreground/20 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t("admin.agents.frozen")}
                    </button>
                  </td>
                  <td className="p-3"><ToggleBadge active={a.halalFilterEnabled} onClick={() => toggle(a, "halalFilterEnabled")} label={t("admin.agents.halal")} /></td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(a)} aria-label={t("common.edit")}>
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setPendingDelete(a)}
                        aria-label={t("common.delete")}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("admin.agents.price")}</label>
              <Input type="number" value={form.marketplacePrice} onChange={(e) => setForm({ ...form, marketplacePrice: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("admin.agents.category")}</label>
              <select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                className="flex h-11 w-full rounded-xl border bg-background px-2 text-sm outline-none"
              >
                <option value="">—</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>{t("common.cancel")}</Button>
            <Button onClick={saveEdit}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.delete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.agents.deleteConfirm").replace("{name}", pendingDelete?.name ?? "")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction destructive onClick={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}>
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
