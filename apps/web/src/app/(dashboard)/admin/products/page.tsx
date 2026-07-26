"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useApiClient, apiErrorMessage } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
}

interface Product {
  id: string;
  name: string;
  sku: string;
  description?: string | null;
  priceTiyin: number;
  stock: number;
  imageUrl?: string | null;
  isActive: boolean;
  categoryId?: string | null;
  category?: { id: string; name: string; icon?: string | null } | null;
}

type FormState = {
  name: string;
  sku: string;
  description: string;
  priceSom: string;
  stock: string;
  imageUrl: string;
  isActive: boolean;
  categoryId: string;
};

const EMPTY_FORM: FormState = { name: "", sku: "", description: "", priceSom: "0", stock: "0", imageUrl: "", isActive: true, categoryId: "" };

export default function AdminProductsPage() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const { t } = useT();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);

  const { data: categories } = useQuery({
    queryKey: ["admin-categories", "product"],
    queryFn: () => api.get<Category[]>("/admin/categories?type=product"),
  });

  const { data, isError, isLoading, refetch } = useQuery({
    queryKey: ["admin-products", search],
    queryFn: () => api.get<Product[]>(`/admin/products${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-products"] });

  const toDto = (f: FormState) => ({
    name: f.name.trim(),
    sku: f.sku.trim(),
    description: f.description.trim() || undefined,
    priceTiyin: Math.round((Number(f.priceSom) || 0) * 100),
    stock: Number(f.stock) || 0,
    imageUrl: f.imageUrl.trim() || undefined,
    isActive: f.isActive,
    categoryId: f.categoryId || undefined,
  });

  const createMutation = useMutation({
    mutationFn: (dto: ReturnType<typeof toDto>) => api.post("/admin/products", dto),
    onSuccess: () => { invalidate(); setDialogOpen(false); toast({ title: t("common.save") }); },
    onError: (e) => setError(apiErrorMessage(e, t)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: ReturnType<typeof toDto> }) => api.patch(`/admin/products/${id}`, dto),
    onSuccess: () => { invalidate(); setDialogOpen(false); toast({ title: t("common.save") }); },
    onError: (e) => setError(apiErrorMessage(e, t)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/products/${id}`),
    onSuccess: () => { invalidate(); setPendingDelete(null); toast({ title: t("common.delete") }); },
    onError: (e) => toast({ title: apiErrorMessage(e, t), variant: "destructive" }),
  });

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setError(null); setDialogOpen(true); };
  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name, sku: p.sku, description: p.description ?? "",
      priceSom: String(Math.round(p.priceTiyin / 100)), stock: String(p.stock),
      imageUrl: p.imageUrl ?? "", isActive: p.isActive, categoryId: p.categoryId ?? "",
    });
    setError(null);
    setDialogOpen(true);
  };

  const submit = () => {
    const dto = toDto(form);
    if (editing) updateMutation.mutate({ id: editing.id, dto });
    else createMutation.mutate(dto);
  };

  if (isError) return <ErrorState onRetry={() => refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t("admin.products.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("admin.products.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("admin.products.searchPlaceholder")}
            className="w-64"
          />
          <Button onClick={openCreate}>
            <Plus /> {t("admin.products.add")}
          </Button>
        </div>
      </div>

      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : data.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">{t("admin.products.empty")}</Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="p-3">{t("admin.products.name")}</th>
                <th className="p-3">{t("admin.products.sku")}</th>
                <th className="p-3">{t("admin.products.category")}</th>
                <th className="p-3 text-right">{t("admin.products.price")}</th>
                <th className="p-3 text-right">{t("admin.products.stock")}</th>
                <th className="p-3">{t("admin.products.active")}</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="p-3 font-medium">{p.name}</td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{p.sku}</td>
                  <td className="p-3 text-muted-foreground">
                    {p.category ? `${p.category.icon ?? ""} ${p.category.name}` : t("admin.products.noCategory")}
                  </td>
                  <td className="p-3 text-right tabular-nums">{Math.round(p.priceTiyin / 100).toLocaleString("ru-RU")}</td>
                  <td className="p-3 text-right tabular-nums">{p.stock}</td>
                  <td className="p-3">
                    <Badge variant={p.isActive ? "ok" : "outline"}>
                      {p.isActive ? t("admin.products.active") : t("admin.products.inactive")}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(p)} aria-label={t("common.edit")}>
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setPendingDelete(p)}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t("admin.products.edit") : t("admin.products.add")}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("admin.products.name")}</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("admin.products.sku")}</label>
                <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("admin.products.price")}</label>
                <Input type="number" value={form.priceSom} onChange={(e) => setForm({ ...form, priceSom: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("admin.products.stock")}</label>
                <Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("admin.products.category")}</label>
                <select
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  className="flex h-11 w-full rounded-xl border bg-background px-2 text-sm outline-none"
                >
                  <option value="">{t("admin.products.noCategory")}</option>
                  {categories?.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("admin.products.imageUrl")}</label>
              <Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://…" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("admin.products.description")}</label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              {t("admin.products.active")}
            </label>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button
              onClick={submit}
              disabled={!form.name.trim() || !form.sku.trim() || createMutation.isPending || updateMutation.isPending}
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
              {t("admin.products.deleteConfirm").replace("{name}", pendingDelete?.name ?? "")}
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
