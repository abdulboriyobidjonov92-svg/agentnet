"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useApiClient, apiErrorMessage } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { toast } from "@/components/ui/toast";
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
  slug: string;
  type: string;
  icon?: string | null;
  description?: string | null;
  order: number;
  _count: { agents: number; products: number };
}

type FormState = {
  name: string;
  slug: string;
  type: string;
  icon: string;
  description: string;
  order: number;
};

const EMPTY_FORM: FormState = { name: "", slug: "", type: "product", icon: "", description: "", order: 0 };

export default function AdminCategoriesPage() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const { t } = useT();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);

  const { data, isError, isLoading, refetch } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => api.get<Category[]>("/admin/categories"),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-categories"] });

  const createMutation = useMutation({
    mutationFn: (dto: Partial<FormState>) => api.post("/admin/categories", dto),
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      toast({ title: t("common.save") });
    },
    onError: (e) => setError(apiErrorMessage(e, t)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Partial<FormState> }) => api.patch(`/admin/categories/${id}`, dto),
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      toast({ title: t("common.save") });
    },
    onError: (e) => setError(apiErrorMessage(e, t)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/categories/${id}`),
    onSuccess: () => {
      invalidate();
      setPendingDelete(null);
      toast({ title: t("common.delete") });
    },
    onError: (e) => toast({ title: apiErrorMessage(e, t), variant: "destructive" }),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
    setDialogOpen(true);
  };

  const openEdit = (c: Category) => {
    setEditing(c);
    setForm({ name: c.name, slug: c.slug, type: c.type, icon: c.icon ?? "", description: c.description ?? "", order: c.order });
    setError(null);
    setDialogOpen(true);
  };

  const submit = () => {
    const dto: Partial<FormState> = {
      name: form.name.trim(),
      slug: form.slug.trim() || undefined,
      type: form.type,
      icon: form.icon.trim() || undefined,
      description: form.description.trim() || undefined,
      order: Number(form.order) || 0,
    };
    if (editing) updateMutation.mutate({ id: editing.id, dto });
    else createMutation.mutate(dto);
  };

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t("admin.categories.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("admin.categories.subtitle")}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus /> {t("admin.categories.add")}
        </Button>
      </div>

      {data.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">{t("admin.categories.empty")}</Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {data.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {c.icon && <span className="text-lg">{c.icon}</span>}
                  <div>
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-xs text-muted-foreground">/{c.slug}</p>
                  </div>
                </div>
                <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  {t(`admin.categories.type.${c.type}`)}
                </span>
              </div>
              {c.description && <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{c.description}</p>}
              <div className="mt-3 flex items-center justify-between">
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span>{t("admin.categories.agentsCount").replace("{n}", String(c._count.agents))}</span>
                  <span>{t("admin.categories.productsCount").replace("{n}", String(c._count.products))}</span>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => openEdit(c)} aria-label={t("common.edit")}>
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setPendingDelete(c)}
                    aria-label={t("common.delete")}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t("admin.categories.edit") : t("admin.categories.add")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("admin.categories.name")}</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("admin.categories.icon")}</label>
                <Input className="w-20 text-center" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="🏷️" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("admin.categories.slug")}</label>
              <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder={form.name ? undefined : "auto"} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("admin.categories.type")}</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="flex h-11 w-full rounded-xl border bg-background px-4 text-sm outline-none"
                >
                  <option value="product">{t("admin.categories.type.product")}</option>
                  <option value="agent">{t("admin.categories.type.agent")}</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("admin.categories.order")}</label>
                <Input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("admin.categories.description")}</label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button
              onClick={submit}
              disabled={!form.name.trim() || createMutation.isPending || updateMutation.isPending}
            >
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.delete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.categories.deleteConfirm").replace("{name}", pendingDelete?.name ?? "")}
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
