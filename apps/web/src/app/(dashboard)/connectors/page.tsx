"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { Plug, CheckCircle2, KeyRound, FileWarning, X, Loader2 } from "lucide-react";

/** S2: Connector SDK UI — katalog, ulanish, holat. */
export default function ConnectorsPage() {
  const api = useApiClient();
  const qc = useQueryClient();
  const { t } = useT();
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saveResult, setSaveResult] = useState<string | null>(null);

  const { data: connectors } = useQuery({
    queryKey: ["connectors"],
    queryFn: () => api.get<any[]>("/connectors/mine"),
  });

  const saveMutation = useMutation({
    mutationFn: () => api.post<any>(`/connectors/${selected.id}/configure`, { config: form }),
    onSuccess: (res) => {
      setSaveResult(res.status === "connected" ? "connected" : `needs: ${res.missing?.join(", ")}`);
      qc.invalidateQueries({ queryKey: ["connectors"] });
    },
    onError: (e: any) => setSaveResult(e.message),
  });

  const categories = [...new Set((connectors ?? []).map((c) => c.category))];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("conn.title")}</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">{t("conn.subtitle")}</p>
      </div>

      {categories.map((cat) => (
        <div key={cat}>
          <h2 className="mb-3 font-semibold capitalize">{cat}</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(connectors ?? [])
              .filter((c) => c.category === cat)
              .map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setSelected(c); setForm({}); setSaveResult(null); }}
                  className="flex flex-col rounded-2xl border bg-card p-5 text-left shadow-soft transition hover:shadow-lift"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Plug className="h-5 w-5" />
                    </div>
                    <StatusBadge c={c} t={t} />
                  </div>
                  <h3 className="font-semibold">{c.name}</h3>
                  <p className="mt-1 flex-1 text-sm text-muted-foreground">{c.description}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {c.region && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{c.region}</span>}
                    {c.actions?.slice(0, 3).map((a: any) => (
                      <span key={a.id} className="rounded-full bg-secondary px-2 py-0.5 text-xs">{a.id}</span>
                    ))}
                  </div>
                </button>
              ))}
          </div>
        </div>
      ))}

      {/* Konfiguratsiya paneli */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelected(null)}>
          <div className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-2xl border bg-card p-6 shadow-lift" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold">{selected.name}</h3>
                <p className="text-sm text-muted-foreground">{selected.description}</p>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            {selected.availability === "agreement_required" && (
              <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                <FileWarning className="mb-1 h-4 w-4 text-amber-500" />
                {t("conn.agreement")} — action-sxema tayyor; rasmiy kelishuv imzolangach jonli ishlaydi.
              </div>
            )}

            <div className="space-y-3">
              {selected.auth.fields.map((f: any) => (
                <div key={f.key}>
                  <label className="mb-1 block text-sm font-medium">
                    {f.label} {f.required && <span className="text-destructive">*</span>}
                  </label>
                  <input
                    type={f.secret ? "password" : "text"}
                    placeholder={f.placeholder ?? ""}
                    value={form[f.key] ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary"
                  />
                  {f.help && <p className="mt-1 text-xs text-muted-foreground">{f.help}</p>}
                </div>
              ))}
            </div>

            <div className="mt-4">
              <h4 className="mb-2 text-sm font-semibold">{t("conn.actions")}</h4>
              <div className="space-y-2">
                {selected.actions.map((a: any) => (
                  <div key={a.id} className="rounded-xl bg-muted p-3 text-xs">
                    <span className="font-mono font-semibold text-primary">{a.id}</span>
                    <span className="ml-2 text-muted-foreground">{a.description}</span>
                    <span className="ml-2 opacity-60">→ {a.returns}</span>
                  </div>
                ))}
              </div>
            </div>

            {saveResult && (
              <p className={`mt-3 text-sm ${saveResult === "connected" ? "text-emerald-500" : "text-amber-500"}`}>
                {saveResult === "connected" ? `✓ ${t("conn.connected")}` : saveResult}
              </p>
            )}

            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition hover:brightness-110 disabled:opacity-60"
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              {t("conn.save")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ c, t }: { c: any; t: (k: string) => string }) {
  if (c.availability === "agreement_required")
    return <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-500">{t("conn.agreement")}</span>;
  if (c.connected)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-500">
        <CheckCircle2 className="h-3 w-3" /> {t("conn.connected")}
      </span>
    );
  if (c.status === "needs_credentials")
    return <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-500">{t("conn.needsCreds")}</span>;
  return <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{t("conn.connect")}</span>;
}
